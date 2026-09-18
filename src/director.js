/**
 * MyLove Graph - the director: the cast written by a model, from the chat.
 *
 * The chronicle (chronicle.js) counts words and never leaves the browser. The
 * director does the same job with a language model reading over its shoulder,
 * which is what makes it able to tell that "the innkeeper" from scene four is
 * the same woman the party now calls Marta, that she is frightened rather than
 * hostile, and to write down who she is.
 *
 * Everything it knows comes from the open chat:
 *
 *   1. Every few messages it hands the new scenes to a model with the cast and
 *      the bonds already on the board.
 *   2. The model answers with JSON: who is in the story, and what is going on
 *      between them.
 *   3. New souls walk onto this chat's board with a role and a short profile;
 *      the bonds between them are drawn, re-coloured or cut.
 *   4. A story log records what changed, scene by scene.
 *
 * The model it uses is a setting, not a given: SillyTavern's current connection,
 * a separate connection profile (so a small fast model keeps the map while the
 * good one keeps telling the story), or a bare OpenAI-compatible endpoint.
 *
 * Nothing the user wrote is ever overwritten - a hand-edited soul keeps their
 * words, and a locked bond is left out of the prompt entirely.
 */

import { chat, chatId, userName, chatTitle, hostBusy } from './host.js';
import { getSettings, save, saveQuiet, suspendNotify, resumeNotify } from './state.js';
import { generate, parseJson, readiness, targetLabel, busy as wireBusy, abort as abortWire } from './llm.js';
import { directorPrompt, dossierPrompt, sceneDigest, castDigest, bondDigest } from './prompts.js';
import { buildCast } from './chronicle.js';
import { tokenize } from './lexicon.js';
import * as model from './model.js';

const LOG = '[MyLove Graph]';

/** Messages re-read at the start of a pass, so a scene is never cut in half. */
const OVERLAP = 4;
/** The shortest gap between two automatic passes, whatever the chat does. */
const COOLDOWN = 15000;
/** ST is answering: wait this long and look again. */
const BUSY_RETRY = 4000;
const MAX_CHATS = 8;
const MAX_LOG = 40;
const MAX_CHARACTERS = 40;
const MAX_RELATIONS = 60;

const listeners = new Set();
let queued = 0;
let running = false;
let cancelled = false;
/** How many times in a row a pass has stepped aside for the host's own reply. */
let busyWaits = 0;
/** Enough tries to sit out one reply; after that the next message asks again. */
const MAX_BUSY_WAITS = 6;

/* ------------------------------------------------------------- bookkeeping */

function chatKey() {
    return chatId() || 'default';
}

function record(id = chatKey()) {
    const chats = getSettings().ai.chats;
    if (!chats[id] || typeof chats[id] !== 'object') chats[id] = {};
    const entry = chats[id];
    if (typeof entry.analyzed !== 'number') entry.analyzed = 0;
    if (typeof entry.runs !== 'number') entry.runs = 0;
    if (typeof entry.lastAt !== 'number') entry.lastAt = 0;
    if (typeof entry.error !== 'string') entry.error = '';
    if (!Array.isArray(entry.log)) entry.log = [];
    return entry;
}

/** Keeps the settings file from carrying the log of every chat ever opened. */
function pruneChats(currentId) {
    const chats = getSettings().ai.chats;
    const keys = Object.keys(chats);
    if (keys.length <= MAX_CHATS) return;
    keys.sort((a, b) => (chats[b]?.lastAt || 0) - (chats[a]?.lastAt || 0));
    for (const key of keys.slice(MAX_CHATS)) {
        if (key !== currentId) delete chats[key];
    }
}

function emit(event) {
    for (const fn of listeners) {
        try {
            fn(event);
        } catch (err) {
            console.error(LOG, 'director listener failed', err);
        }
    }
}

export function onDirector(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/* ----------------------------------------------------------------- reading */

const list = value => (Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? Object.values(value) : []));

function text(value, limit) {
    const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!clean || clean === '-' || /^(none|n\/a|unknown|null)$/i.test(clean)) return '';
    return clean.length > limit ? clean.slice(0, limit).replace(/\s+\S*$/, '') + '…' : clean;
}

function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.6;
    // Some models answer 0-100 where 0-1 was asked for.
    return model.clamp(number > 1 ? number / 100 : number, 0, 1);
}

/** Folds the names a model reports into the aliases a node already carries. */
function mergeAliases(node, reported, reportedName) {
    const seen = new Set();
    const keep = [];
    const push = raw => {
        const value = text(raw, 40);
        if (!value) return;
        const key = value.toLowerCase();
        if (key === String(node.name || '').toLowerCase() || seen.has(key)) return;
        seen.add(key);
        keep.push(value);
    };
    for (const part of String(node.aliases || '').split(/[,;|/]/)) push(part);
    for (const part of list(reported)) push(part);
    // The spelling the story actually used is worth remembering too.
    push(reportedName);
    const next = keep.slice(0, 8).join(', ');
    if (next !== node.aliases) node.aliases = next;
}

/**
 * The lookup the whole pass shares: a name the model reported -> a node.
 *
 * Names are resolved against the same index the chronicle uses (board, cards,
 * persona, aliases), so a soul is never walked onto the board twice under two
 * spellings of the same name.
 */
function resolver(index) {
    const cast = buildCast();
    const reported = new Map();
    const settings = getSettings();

    const nodeFor = person => {
        if (!person?.id) return null;
        const existing = model.findNode(person.id);
        if (existing) return { node: existing, created: false };
        // A character card the board had not met yet arrives with its avatar.
        const node = model.addNode({
            id: person.id,
            kind: person.kind || 'npc',
            name: person.name,
            avatar: person.avatar || null,
            color: person.kind === 'persona' ? '#ffd1e6' : '',
            origin: 'ai',
            seen: index,
        }, true);
        return { node, created: true };
    };

    return {
        /**
         * @param {string} name as the model spelled it
         * @param {{create?: boolean, kind?: string}} [options]
         * @returns {{node: object, created: boolean}|null}
         */
        find(name, options = {}) {
            const clean = text(name, 60);
            if (!clean) return null;
            const key = clean.toLowerCase();
            if (reported.has(key)) return { node: reported.get(key), created: false };

            let person = cast.exact(clean);
            if (!person) {
                // "Captain Marta" when the board only knows "Marta".
                for (const token of tokenize(clean)) {
                    if (token.length < 3) continue;
                    person = cast.match(token);
                    if (person) break;
                }
            }
            if (person) {
                const hit = nodeFor(person);
                if (hit) reported.set(key, hit.node);
                return hit;
            }
            if (!options.create || !settings.ai.newSouls) return null;

            const node = model.addNode({
                kind: 'npc',
                name: clean,
                origin: 'ai',
                seen: index,
            }, true);
            reported.set(key, node);
            return { node, created: true };
        },
    };
}

/** Writes what the model said about one person onto their node. */
function describe(node, raw, index) {
    const ai = getSettings().ai;
    // A soul the user has edited by hand keeps their words; the director is
    // only allowed to fill in what is still blank.
    const free = !node.edited;

    if (ai.profiles) {
        const role = text(raw.role, 60);
        if (role && (free || !node.role)) node.role = role;

        const bio = text(raw.summary ?? raw.description ?? raw.bio, 400);
        if (bio && (free || !node.bio)) node.bio = bio;

        const traits = list(raw.traits).map(item => text(item, 24)).filter(Boolean).slice(0, 6);
        if (traits.length && (free || !node.traits?.length)) node.traits = traits;
    }

    mergeAliases(node, raw.aka ?? raw.aliases, raw.name);
    node.lastAi = index;
    if (node.missing && node.kind === 'npc') node.missing = false;
}

/**
 * Folds one answer from the model into the board.
 * @returns {{souls:number, updated:number, bonds:number, changed:number, cut:number}}
 */
function apply(data, index) {
    const ai = getSettings().ai;
    const find = resolver(index);
    const counts = { souls: 0, updated: 0, bonds: 0, changed: 0, cut: 0 };

    suspendNotify();
    try {
        for (const raw of list(data.characters ?? data.cast).slice(0, MAX_CHARACTERS)) {
            if (!raw || typeof raw !== 'object') continue;
            if (counts.souls >= Math.max(1, ai.maxNew)) {
                // The crowd cap is about *new* faces; known ones still update.
                const known = find.find(raw.name, { create: false });
                if (!known) continue;
                describe(known.node, raw, index);
                counts.updated++;
                continue;
            }
            const hit = find.find(raw.name, { create: true });
            if (!hit) continue;
            describe(hit.node, raw, index);
            if (hit.created) counts.souls++;
            else counts.updated++;
        }

        for (const raw of list(data.relations ?? data.bonds).slice(0, MAX_RELATIONS)) {
            if (!raw || typeof raw !== 'object') continue;
            const a = find.find(raw.a ?? raw.from, { create: false });
            const b = find.find(raw.b ?? raw.to, { create: false });
            if (!a || !b || a.node.id === b.node.id) continue;

            const existing = model.findEdge(a.node.id, b.node.id);
            // A bond the user wired up by hand is theirs, full stop.
            if (existing?.locked) continue;

            const type = String(raw.type || '').toLowerCase().trim();
            if (!model.REL_TYPES.includes(type)) {
                // "none" / "ended": the story says this bond is over.
                if (existing && ['none', 'ended', 'gone', 'broken'].includes(type) && existing.origin !== 'manual') {
                    model.removeEdge(existing.id);
                    counts.cut++;
                }
                continue;
            }

            const confidence = clamp01(raw.confidence ?? raw.certainty ?? 0.7);
            if (confidence < (ai.minConfidence ?? 0)) continue;
            if (!existing && !ai.newBonds) continue;

            const strength = model.clamp(Math.round(Number(raw.strength ?? raw.intensity) || 50), 1, 100);
            const dir = ['both', 'a2b', 'b2a'].includes(raw.dir) ? raw.dir : 'both';

            model.upsertEdge({
                a: a.node.id,
                b: b.node.id,
                type,
                strength,
                dir,
                note: text(raw.label ?? raw.note, 48),
                origin: 'ai',
                // A bond the model is sure about is drawn as a settled one; a
                // guess still shows as a spark that has to earn its place.
                progress: model.clamp(Math.round(confidence * 100), 25, 100),
                confidence,
                hits: (existing?.hits || 0) + 1,
                since: existing?.since ?? index,
                lastAt: index,
            }, true);

            if (existing) counts.changed++;
            else counts.bonds++;
        }
    } finally {
        resumeNotify();
    }

    return counts;
}

/** Keeps the last few beats the model reported, newest first. */
function pushLog(entry, events, index) {
    for (const event of list(events).slice(0, 3)) {
        const line = text(event, 160);
        if (!line) continue;
        if (entry.log[0]?.text === line) continue;
        entry.log.unshift({ at: Date.now(), index, text: line });
    }
    if (entry.log.length > MAX_LOG) entry.log.length = MAX_LOG;
}

/* ------------------------------------------------------------- the passes */

/**
 * Reads a slice of the chat and folds what the model says into the board.
 *
 * @param {{from?: number, to?: number, silent?: boolean}} [options]
 * @returns {Promise<object|null>} what changed, or null when there was nothing to read
 */
export async function analyze(options = {}) {
    const settings = getSettings();
    const ai = settings.ai;
    if (running) return null;

    const ready = readiness();
    if (!ready.ok) throw new Error(ready.reason);

    const messages = chat();
    const id = chatKey();
    const entry = record(id);

    // A cancel that arrived while nothing was running must not follow us into
    // this pass; from here on it means "stop what I am starting now".
    cancelled = false;

    const to = Math.min(options.to ?? messages.length, messages.length);
    if (entry.analyzed > messages.length) {
        // Messages were deleted or swiped away: never count anything twice.
        entry.analyzed = messages.length;
    }
    const window = Math.max(4, ai.window || 30);
    const start = options.from ?? Math.max(entry.analyzed - OVERLAP, to - window);
    const from = Math.max(0, Math.min(start, to));
    if (to <= 0 || from >= to) return null;

    const digest = sceneDigest(messages, from, to, {
        maxChars: Math.max(1200, ai.maxChars || 9000),
        userName: userName(),
    });
    if (!digest.count) {
        entry.analyzed = to;
        return null;
    }

    const nodes = model.nodes();
    const { system, prompt } = directorPrompt({
        scenes: digest.text,
        cast: castDigest(nodes),
        bonds: bondDigest(model.edges(), model.nodeName),
        title: chatTitle(),
        lang: ai.lang === 'auto' ? settings.lang : ai.lang,
        newSouls: ai.newSouls,
        newBonds: ai.newBonds,
        profiles: ai.profiles,
        maxNew: ai.maxNew,
    });

    running = true;
    emit({ busy: true, phase: 'reading', from: digest.first, to: digest.last });

    try {
        const answer = await generate({ system, prompt, maxTokens: ai.maxTokens });
        if (cancelled) return null;

        const data = parseJson(answer);
        if (!data || typeof data !== 'object') {
            throw new Error('the model did not answer with JSON');
        }

        const counts = apply(data, Math.max(0, to - 1));
        entry.analyzed = to;
        entry.runs++;
        entry.lastAt = Date.now();
        entry.error = '';
        pushLog(entry, data.events ?? data.beats, to);
        pruneChats(id);
        save();

        const result = { ...counts, busy: false, phase: 'done', applied: to, total: messages.length };
        if (!options.silent) emit(result);
        return result;
    } catch (err) {
        const message = String(err?.message || err);
        entry.error = message;
        saveQuiet();
        emit({ busy: false, phase: 'failed', error: message });
        throw err;
    } finally {
        running = false;
    }
}

/**
 * Re-reads this chat from further back, rebuilding everything the director
 * wrote for it. Runs one window at a time so a long chat does not become one
 * enormous request.
 * @param {(progress: {done: number, of: number}) => void} [onProgress]
 */
export async function rebuild(onProgress) {
    const ai = getSettings().ai;
    const messages = chat();
    const id = chatKey();
    const entry = record(id);

    forgetBoard();
    entry.analyzed = 0;
    entry.log = [];
    entry.error = '';
    cancelled = false;

    const window = Math.max(4, ai.window || 30);
    const depth = Math.max(window, ai.depth || 200);
    const start = Math.max(0, messages.length - depth);
    const total = Math.max(1, Math.ceil((messages.length - start) / window));
    const summary = { souls: 0, updated: 0, bonds: 0, changed: 0, cut: 0, passes: 0 };

    for (let cursor = start, done = 0; cursor < messages.length; cursor += window, done++) {
        if (cancelled) break;
        onProgress?.({ done, of: total });
        emit({ busy: true, phase: 'rebuilding', done, of: total });
        const result = await analyze({ from: cursor, to: Math.min(cursor + window, messages.length), silent: true });
        if (!result) continue;
        for (const key of ['souls', 'updated', 'bonds', 'changed', 'cut']) summary[key] += result[key] || 0;
        summary.passes++;
    }

    cancelled = false;
    emit({ ...summary, busy: false, phase: 'rebuilt' });
    return summary;
}

/** Stops a rebuild: the request in flight is cut, and no further pass starts. */
export function cancel() {
    cancelled = true;
    abortWire();
}

/**
 * The close-up: asks the model for a full dossier on one soul, from the scenes
 * they actually appear in.
 * @param {string} nodeId
 */
export async function dossier(nodeId) {
    const settings = getSettings();
    const ai = settings.ai;
    const node = model.findNode(nodeId);
    if (!node) throw new Error('unknown soul');

    const ready = readiness();
    if (!ready.ok) throw new Error(ready.reason);

    const messages = chat();
    const names = [node.name, ...String(node.aliases || '').split(/[,;|/]/)]
        .map(part => String(part || '').toLowerCase().trim())
        .filter(part => part.length >= 3);

    // Only the scenes this person is actually in - a dossier built from the
    // whole chat is a dossier about the chat.
    const theirs = [];
    const depth = Math.max(40, ai.depth || 200);
    for (let i = Math.max(0, messages.length - depth); i < messages.length; i++) {
        const message = messages[i];
        if (!message || message.is_system) continue;
        const haystack = `${message.name || ''} ${message.mes || ''}`.toLowerCase();
        if (names.some(name => haystack.includes(name))) theirs.push(i);
    }
    if (!theirs.length) throw new Error('the story says nothing about them yet');

    const slice = theirs.slice(-40);
    const digest = sceneDigest(
        messages.map((message, i) => (slice.includes(i) ? message : { is_system: true })),
        slice[0],
        slice[slice.length - 1] + 1,
        { maxChars: Math.max(1200, ai.maxChars || 9000), userName: userName() },
    );

    const bonds = model.edgesOf(node.id);
    const { system, prompt } = dossierPrompt({
        name: node.name,
        scenes: digest.text,
        cast: castDigest(model.nodes().filter(other => other.id !== node.id), { limit: 24 }),
        bonds: bondDigest(bonds, model.nodeName),
        lang: ai.lang === 'auto' ? settings.lang : ai.lang,
    });

    running = true;
    emit({ busy: true, phase: 'dossier', id: node.id });
    try {
        const answer = await generate({ system, prompt, maxTokens: Math.max(400, ai.maxTokens) });
        const data = parseJson(answer);
        if (!data || typeof data !== 'object') throw new Error('the model did not answer with JSON');

        describe(node, data, messages.length - 1);
        const fields = ['appearance', 'personality', 'goal', 'secret', 'voice'];
        const written = {};
        for (const field of fields) {
            const value = text(data[field], 320);
            if (value) written[field] = value;
        }
        node.dossier = Object.keys(written).length ? { ...written, at: Date.now() } : node.dossier;
        save();
        emit({ busy: false, phase: 'dossierDone', id: node.id });
        return node;
    } catch (err) {
        emit({ busy: false, phase: 'failed', error: String(err?.message || err) });
        throw err;
    } finally {
        running = false;
    }
}

/** A one-shot request that proves the wire works, without touching the board. */
export async function test() {
    const answer = await generate({
        system: 'You answer with one JSON object and nothing else.',
        prompt: 'Answer with exactly this JSON: {"ok": true}',
        maxTokens: 32,
        temperature: 0,
    });
    const data = parseJson(answer);
    if (!data) throw new Error(`no JSON in the answer: ${String(answer).slice(0, 120) || '(empty)'}`);
    return true;
}

/* ---------------------------------------------------------------- forgetting */

/** Drops what the director wrote on this board, leaving hand-made work alone. */
function forgetBoard() {
    const edges = model.edges();
    for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].origin === 'ai' && !edges[i].locked) edges.splice(i, 1);
    }
    const nodes = model.nodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (node.origin !== 'ai' || node.edited) continue;
        // A soul the director found but the user then wired up by hand stays.
        if (model.edgesOf(node.id).length) continue;
        nodes.splice(i, 1);
    }
}

/** Forgets the director's work on this board and its reading progress. */
export function forget() {
    forgetBoard();
    const id = chatKey();
    delete getSettings().ai.chats[id];
    save();
    emit({ busy: false, phase: 'forgotten' });
}

/* ------------------------------------------------------------------ status */

/** Everything the UI needs to show what the director is doing. */
export function status() {
    const settings = getSettings();
    const ai = settings.ai;
    const messages = chat();
    const entry = ai.chats[chatKey()];
    const ready = readiness();

    let souls = 0;
    let bonds = 0;
    for (const node of model.nodes()) if (node.origin === 'ai') souls++;
    for (const edge of model.edges()) if (edge.origin === 'ai') bonds++;

    return {
        enabled: !!ai.enabled,
        auto: !!ai.auto,
        source: ai.source,
        target: targetLabel(),
        ready: ready.ok,
        reason: ready.reason,
        busy: running || wireBusy(),
        analyzed: Math.min(entry?.analyzed || 0, messages.length),
        total: messages.length,
        pending: Math.max(0, messages.length - Math.min(entry?.analyzed || 0, messages.length)),
        runs: entry?.runs || 0,
        lastAt: entry?.lastAt || 0,
        error: entry?.error || '',
        log: entry?.log || [],
        souls,
        bonds,
    };
}

/** The story log of the open chat, newest first. */
export function storyLog() {
    return record().log.slice();
}

/* --------------------------------------------------------------- the pulse */

/**
 * The automatic pass. Called from ST's message events; does nothing at all
 * unless the director is on, configured, idle and far enough behind the chat.
 */
function pulse() {
    const ai = getSettings().ai;
    if (!ai.enabled || !ai.auto || running) return;
    if (!readiness().ok) return;

    const messages = chat();
    const entry = record();
    const behind = messages.length - Math.min(entry.analyzed, messages.length);
    if (behind < Math.max(1, ai.every || 6)) return;
    if (Date.now() - (entry.lastAt || 0) < COOLDOWN) return;
    // Never elbow the roleplay itself out of the way. The waiting is bounded:
    // if the host stays busy, the next message event brings us back here
    // anyway, and an unbounded retry would be a timer that never stops.
    if (hostBusy()) {
        if (busyWaits < MAX_BUSY_WAITS) {
            busyWaits++;
            schedule(BUSY_RETRY);
        }
        return;
    }
    busyWaits = 0;

    analyze().catch(err => console.warn(LOG, 'director pass failed', err));
}

/** Debounced entry point for ST's message events. */
export function schedule(delay = 1200) {
    if (!getSettings().ai.enabled) return;
    clearTimeout(queued);
    queued = setTimeout(() => {
        try {
            pulse();
        } catch (err) {
            console.error(LOG, 'director failed', err);
        }
    }, delay);
}
