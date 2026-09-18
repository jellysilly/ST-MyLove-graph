/**
 * MyLove Graph - the chronicle: bonds that grow out of the roleplay.
 *
 * Instead of dropping the whole cast on the board with ready-made relationships,
 * story mode reads the chat as it happens and lets the map fill in behind it:
 *
 *   1. A soul appears the first time they speak or are spoken about.
 *   2. Two souls who keep sharing scenes build up "heat". Past a threshold the
 *      first faint spark is drawn between them.
 *   3. Every further scene pushes that spark along - it thickens, reaches across
 *      to the other side and finally settles into a bond, while the words used
 *      in those scenes vote on what kind of bond it is.
 *   4. A pair nobody writes about any more slowly cools off again.
 *
 * Everything is derived from the chat with no model calls, so it costs a few
 * milliseconds per message and works offline. Anything the user edits by hand is
 * locked and never touched again.
 */

import { chat, chatId, characters, userName } from './host.js';
import { getSettings, saveQuiet, storyPace, suspendNotify, resumeNotify } from './state.js';
import { scoreText, tokenize, isNeutral } from './lexicon.js';
import * as model from './model.js';

const LOG = '[MyLove Graph]';

/* How the numbers were chosen: with the default pace a pair that shares a scene
 * in roughly every other message reaches a full bond after ~40 messages, which
 * is about one good chapter of roleplay. */
const REVEAL_WEIGHT = 2.4;   // heat needed before a spark is drawn at all
const START_PROGRESS = 9;    // how visible that first spark is
const GAIN = 5.2;            // progress per unit of heat
const DECAY_EVERY = 40;      // run the cooling pass this often (messages)
const DECAY_AFTER = 70;      // messages of silence before a bond cools
const DECAY_STEP = 2.5;
const MIN_PROGRESS = 6;
const MAX_PENDING = 50;
/** Heat this stale never became a bond and never will; forget the pair. */
const PENDING_TTL = 150;
/**
 * How much of the older mood survives each new scene. Without this a bond would
 * be defined by its first chapter forever; with it, a friendship that turns into
 * a romance eventually reads as a romance.
 */
const VOTE_MEMORY = 0.94;
const MAX_CHATS = 6;
const CHAPTER_SIZE = 50;

const WEIGHT = {
    address: 1,      // the speaker names someone
    mention: 0.42,   // two names share a message
    exchange: 0.55,  // two souls speaking back to back
};

const listeners = new Set();
let queued = 0;
let replaying = false;

/* ------------------------------------------------------------------- cast */

/**
 * Builds the lookup used to spot who a message is about.
 *
 * Keys are matched against single lowercase tokens: the full name, each word of
 * it, and a stem (the word minus its last letter) so Russian cases still land on
 * the right character. Anything ambiguous between two souls is dropped rather
 * than guessed.
 *
 * Exported because the director needs the very same lookup: when a model
 * reports "Ария", that has to land on the card named "Aria" instead of walking
 * a second copy of her onto the board.
 */
export function buildCast() {
    const AMBIGUOUS = Symbol('ambiguous');
    const index = new Map();
    const people = [];
    const known = new Set();

    const add = (key, person) => {
        if (!key || key.length < 3) return;
        const current = index.get(key);
        // Ambiguity is about two *souls* sharing a word, never about the same
        // soul being described twice (a board node and its character card).
        if (current === undefined) index.set(key, person);
        else if (current !== AMBIGUOUS && current.id !== person.id) index.set(key, AMBIGUOUS);
    };

    const register = person => {
        if (!person.name || known.has(person.id)) return;
        known.add(person.id);
        people.push(person);
        const names = [person.name, ...String(person.aliases || '').split(/[,;|/]/)];
        for (const raw of names) {
            const name = String(raw || '').toLowerCase().trim();
            if (!name) continue;
            add(name, person);
            for (const word of tokenize(name)) {
                if (word.length < 3) continue;
                add(word, person);
                // The stem catches declensions: "Борису", "Бориса", "Borise".
                if (word.length >= 4) add(word.slice(0, -1), person);
            }
        }
    };

    // Souls already on the board come first: they own their names.
    for (const node of model.nodes()) {
        register({ id: node.id, name: node.name, kind: node.kind, avatar: node.avatar, aliases: node.aliases });
    }
    for (const char of characters()) {
        if (!char?.name) continue;
        register({
            id: model.characterNodeId(char.avatar, char.name),
            name: char.name,
            kind: 'char',
            avatar: char.avatar || null,
        });
    }
    register({ id: model.PERSONA_ID, name: userName(), kind: 'persona' });

    return {
        people,
        /**
         * @returns {object|null} the person a token points at, or null.
         *
         * The token is also tried with its last few letters shaved off, because
         * a name in running text is rarely in its dictionary form: "Борису",
         * "Бориса" and "Borises" all have to find Boris.
         */
        match(token) {
            for (let cut = 0; cut <= 3; cut++) {
                const length = token.length - cut;
                if (length < 3) break;
                const hit = index.get(cut ? token.slice(0, length) : token);
                if (hit === AMBIGUOUS) return null;
                if (hit) return hit;
            }
            return null;
        },
        /** Exact lookup by a speaker label, which is never a partial word. */
        exact(name) {
            const hit = index.get(String(name || '').toLowerCase().trim());
            if (!hit || hit === AMBIGUOUS) return null;
            return hit;
        },
    };
}

/** Makes sure a matched person has a node, creating it the moment they appear. */
function ensureNode(person, index, state) {
    if (!person?.id) return null;
    let node = state.byId.get(person.id);
    if (node) {
        if (node.missing && person.avatar) node.missing = false;
        return node;
    }
    node = model.createNode({
        id: person.id,
        kind: person.kind || 'npc',
        name: person.name,
        avatar: person.avatar || null,
        color: person.kind === 'persona' ? '#ffd1e6' : '',
        origin: 'story',
        seen: index,
    });
    model.nodes().push(node);
    state.byId.set(node.id, node);
    state.added++;
    return node;
}

/* ---------------------------------------------------------------- folding */

function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
}

function addVotes(target, votes, weight) {
    for (const type of model.REL_TYPES) {
        target[type] = (target[type] || 0) * VOTE_MEMORY + (votes[type] || 0) * weight;
    }
}

/** The type the accumulated votes point at, with hysteresis against flapping. */
function decideType(votes, current) {
    let best = current || 'friendly';
    let bestScore = -1;
    for (const type of model.REL_TYPES) {
        const score = votes[type] || 0;
        if (score > bestScore) {
            bestScore = score;
            best = type;
        }
    }
    if (!current || best === current) return best;
    // A new front-runner has to clearly beat the incumbent before the bond
    // changes colour - relationships should not flip on a single harsh word.
    return bestScore > (votes[current] || 0) * 1.15 + 0.6 ? best : current;
}

function strengthFor(progress, votes, type) {
    const total = model.REL_TYPES.reduce((acc, key) => acc + (votes[key] || 0), 0) || 1;
    const dominance = (votes[type] || 0) / total;
    return model.clamp(Math.round(30 + progress * 0.52 + dominance * 18), 5, 100);
}

/** Folds one interaction into the graph: a pending spark, or an existing bond. */
function touchPair(aId, bId, weight, votes, index, state) {
    if (!aId || !bId || aId === bId) return;
    const pace = storyPace();
    const edge = state.edgeOf(aId, bId);

    if (edge) {
        edge.lastAt = index;
        // Hand-made, hand-edited and director-written bonds are not the word
        // counter's to steer - it only notes that the pair is still in play.
        if (edge.locked || edge.origin !== 'story') return;
        edge.hits = (edge.hits || 0) + 1;
        if (!edge.votes) edge.votes = { love: 0, close: 0, friendly: 0, tense: 0 };
        addVotes(edge.votes, votes, weight);
        edge.progress = model.clamp((edge.progress || 0) + GAIN * weight * pace, 0, 100);
        edge.type = decideType(edge.votes, edge.type);
        edge.strength = strengthFor(edge.progress, edge.votes, edge.type);

        // Who keeps reaching out? A bond only one of them ever feeds is drawn
        // one-way, which is how unrequited feelings show up on the board.
        if (aId === edge.a) edge.initA = (edge.initA || 0) + weight;
        else edge.initB = (edge.initB || 0) + weight;
        if (edge.hits >= 6) {
            const initA = edge.initA || 0;
            const initB = edge.initB || 0;
            if (initA > initB * 4) edge.dir = 'a2b';
            else if (initB > initA * 4) edge.dir = 'b2a';
            else edge.dir = 'both';
        }
        state.touched++;
        return;
    }

    const key = pairKey(aId, bId);
    const slot = state.pending[key] || (state.pending[key] = {
        w: 0, love: 0, close: 0, friendly: 0, tense: 0, at: index, a: aId,
    });
    slot.w += weight;
    slot.at = index;
    addVotes(slot, votes, weight);

    if (slot.w < REVEAL_WEIGHT) return;

    // Heat has built up long enough: the first spark becomes visible.
    const pairVotes = { love: slot.love, close: slot.close, friendly: slot.friendly, tense: slot.tense };
    const type = decideType(pairVotes, null);
    model.upsertEdge({
        a: slot.a === bId ? bId : aId,
        b: slot.a === bId ? aId : bId,
        type,
        strength: strengthFor(START_PROGRESS, pairVotes, type),
        dir: 'both',
        origin: 'story',
        progress: START_PROGRESS,
        votes: pairVotes,
        hits: 1,
        since: index,
        lastAt: index,
    });
    delete state.pending[key];
    state.revealed++;
}

/**
 * Keeps the pending table small - it rides along in the settings file. Pairs
 * that went cold long ago are dropped, then only the warmest survive.
 */
function prunePending(pending, index) {
    let keys = Object.keys(pending).filter(key => index - (pending[key].at || 0) <= PENDING_TTL);
    if (keys.length > MAX_PENDING) {
        keys.sort((a, b) => (pending[b].w || 0) - (pending[a].w || 0));
        keys = keys.slice(0, MAX_PENDING);
    }
    const kept = {};
    for (const key of keys) kept[key] = pending[key];
    return kept;
}

/** Bonds nobody has written about in a long while quietly cool down. */
function decay(index, state) {
    if (!getSettings().story.fade) return;
    for (const edge of model.edges()) {
        if (edge.origin !== 'story' || edge.locked) continue;
        const silence = index - (edge.lastAt ?? index);
        if (silence < DECAY_AFTER) continue;
        const next = Math.max(MIN_PROGRESS, (edge.progress ?? 100) - DECAY_STEP);
        if (next === edge.progress) continue;
        edge.progress = next;
        edge.strength = strengthFor(next, edge.votes || {}, edge.type);
        state.touched++;
    }
}

function foldMessage(message, index, state) {
    if (!message || message.is_system) return;
    const text = String(message.mes || '');
    if (!text.trim()) return;

    const settings = getSettings();
    const speakerPerson = message.is_user
        ? { id: model.PERSONA_ID, name: userName(), kind: 'persona' }
        : (state.cast.exact(message.name) || (message.name
            ? { id: 'npc:' + String(message.name).toLowerCase().trim(), name: String(message.name).trim(), kind: 'npc' }
            : null));

    const speaker = ensureNode(speakerPerson, index, state);
    const speakerId = speaker?.id || null;

    // Who else is this message about?
    const mentioned = new Map();
    if (settings.story.mentions) {
        for (const token of tokenize(text)) {
            if (token.length < 3) continue;
            const person = state.cast.match(token);
            if (!person || person.id === speakerId) continue;
            if (!mentioned.has(person.id)) mentioned.set(person.id, person);
        }
    }

    const votes = scoreText(text);
    // Simply sharing a scene says something, but far less than an actual word.
    if (isNeutral(votes)) votes.friendly = 0.6;

    const ids = [];
    for (const person of mentioned.values()) {
        const node = ensureNode(person, index, state);
        if (node) ids.push(node.id);
    }

    if (speakerId) {
        for (const id of ids) touchPair(speakerId, id, WEIGHT.address, votes, index, state);
        // Two souls answering each other are sharing the scene, named or not.
        if (state.lastSpeaker && state.lastSpeaker !== speakerId) {
            touchPair(state.lastSpeaker, speakerId, WEIGHT.exchange, votes, index, state);
        }
        state.lastSpeaker = speakerId;
    }

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            touchPair(ids[i], ids[j], WEIGHT.mention, votes, index, state);
        }
    }

    if (index > 0 && index % DECAY_EVERY === 0) decay(index, state);
}

/* ------------------------------------------------------------------ state */

function chatRecord(id) {
    const chats = getSettings().story.chats;
    if (!chats[id]) chats[id] = { applied: 0, pending: {}, lastSpeaker: '', updated: Date.now() };
    const record = chats[id];
    if (typeof record.applied !== 'number') record.applied = 0;
    if (!record.pending || typeof record.pending !== 'object') record.pending = {};
    return record;
}

/** Keeps only the handful of chats the user actually moves between. */
function pruneChats(currentId) {
    const chats = getSettings().story.chats;
    const keys = Object.keys(chats);
    if (keys.length <= MAX_CHATS) return;
    keys.sort((a, b) => (chats[b].updated || 0) - (chats[a].updated || 0));
    for (const key of keys.slice(MAX_CHATS)) {
        if (key !== currentId) delete chats[key];
    }
}

function makeState(record) {
    const byId = new Map(model.nodes().map(n => [n.id, n]));
    const edgeIndex = new Map();
    for (const edge of model.edges()) edgeIndex.set(pairKey(edge.a, edge.b), edge);
    return {
        cast: buildCast(),
        byId,
        pending: record.pending,
        lastSpeaker: record.lastSpeaker || '',
        added: 0,
        revealed: 0,
        touched: 0,
        edgeOf(a, b) {
            const found = edgeIndex.get(pairKey(a, b));
            if (found) return found;
            const live = model.findEdge(a, b);
            if (live) edgeIndex.set(pairKey(a, b), live);
            return live;
        },
    };
}

function emit(result) {
    for (const fn of listeners) {
        try {
            fn(result);
        } catch (err) {
            console.error(LOG, 'chronicle listener failed', err);
        }
    }
}

/* -------------------------------------------------------------- the public */

const SLICE = 120;

export function onChronicle(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function finish(record, id, state, messages, extra) {
    record.applied = messages.length;
    record.pending = prunePending(state.pending, messages.length);
    record.lastSpeaker = state.lastSpeaker;
    record.updated = Date.now();
    pruneChats(id);
    const result = {
        added: state.added,
        revealed: state.revealed,
        touched: state.touched,
        applied: record.applied,
        ...extra,
    };
    if (state.added || state.revealed || state.touched || extra?.rebuilt) saveQuiet();
    emit(result);
    return result;
}

/**
 * Folds messages [from, end) into the graph.
 *
 * A short catch-up (a new reply arriving) runs straight through; a long one -
 * opening a chat with a thousand messages behind it - is sliced across timeouts
 * so the board fills in visibly instead of freezing the tab.
 */
function run(record, id, messages, from, extra, onDone) {
    const state = makeState(record);
    let cursor = from;

    const slice = () => {
        const until = Math.min(messages.length, cursor + SLICE);
        suspendNotify();
        try {
            for (; cursor < until; cursor++) foldMessage(messages[cursor], cursor, state);
        } finally {
            resumeNotify();
        }
    };

    if (messages.length - from <= SLICE) {
        slice();
        const result = finish(record, id, state, messages, extra);
        onDone?.(result);
        return result;
    }

    replaying = true;
    const step = () => {
        slice();
        if (cursor < messages.length) {
            setTimeout(step, 0);
            return;
        }
        replaying = false;
        onDone?.(finish(record, id, state, messages, extra));
    };
    setTimeout(step, 0);
    return null;
}

/**
 * Reads whatever is new in the open chat.
 * @returns {{added:number, revealed:number, touched:number, applied:number}|null}
 */
export function advance(onDone) {
    const settings = getSettings();
    if (!settings.story.enabled || replaying) return null;

    const messages = chat();
    const id = chatId() || 'default';
    const record = chatRecord(id);

    if (record.applied > messages.length) {
        // Messages were deleted or the chat was swapped underneath us: resume
        // from the new tip instead of counting anything twice.
        record.applied = messages.length;
        record.pending = {};
    }
    if (record.applied === messages.length) return null;

    return run(record, id, messages, record.applied, null, onDone);
}

/**
 * Re-reads the chat from the beginning, rebuilding every story bond.
 * @param {(result:object)=>void} [onDone]
 */
export function rebuild(onDone) {
    if (replaying) return;
    const settings = getSettings();
    const messages = chat();
    const id = chatId() || 'default';
    const record = chatRecord(id);

    // Story-made bonds are derived data: throw them away and read them back out
    // of the chat. Hand-made and hand-edited ones survive untouched.
    const edges = model.edges();
    for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].origin === 'story' && !edges[i].locked) edges.splice(i, 1);
    }
    record.applied = 0;
    record.pending = {};
    record.lastSpeaker = '';

    const depth = Math.max(50, settings.story.depth || 500);
    run(record, id, messages, Math.max(0, messages.length - depth), { rebuilt: true }, onDone);
}

/** Drops everything the chronicle ever wrote, leaving hand-made bonds alone. */
export function forget() {
    const edges = model.edges();
    for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].origin === 'story') edges.splice(i, 1);
    }
    const nodes = model.nodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (node.origin !== 'story') continue;
        // A soul the story brought in but the user then wired up by hand stays.
        if (model.edgesOf(node.id).length) continue;
        nodes.splice(i, 1);
    }
    getSettings().story.chats = {};
    saveQuiet();
    emit({ forgotten: true });
}

/** A reading of how far the chronicle has come, for the HUD and the settings. */
export function status() {
    const settings = getSettings();
    const messages = chat();
    const record = settings.story.chats[chatId() || 'default'];
    const applied = Math.min(record?.applied || 0, messages.length);
    let sparks = 0;
    let settled = 0;
    for (const edge of model.edges()) {
        if (edge.origin !== 'story') continue;
        if (model.stageOf(edge) === 'bond') settled++;
        else sparks++;
    }
    return {
        enabled: !!settings.story.enabled,
        applied,
        total: messages.length,
        chapter: Math.max(1, Math.ceil(applied / CHAPTER_SIZE)),
        sparks,
        settled,
        busy: replaying,
    };
}

/** Debounced entry point for ST's message events. */
export function schedule(delay = 450) {
    if (!getSettings().story.enabled) return;
    clearTimeout(queued);
    queued = setTimeout(() => {
        try {
            advance();
        } catch (err) {
            console.error(LOG, 'chronicle failed', err);
        }
    }, delay);
}
