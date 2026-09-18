/**
 * MyLove Graph - persistent state.
 *
 * The extension prefers SillyTavern's own settings store so the graph travels
 * with the user profile. When that store is unavailable (older builds, or the
 * module loaded outside ST) it falls back to localStorage so nothing is lost.
 *
 * Boards are per chat by default: every roleplay writes its own map, so the
 * cast of one story never leaks into another. A single shared board is still
 * one toggle away (`behaviour.scope = 'global'`).
 */

import { chatId } from './host.js';

export const NAMESPACE = 'mylove_graph';
const LOCAL_KEY = 'mylove_graph_settings';
const SCHEMA_VERSION = 2;
/** How many chat boards are kept around before the coldest ones are dropped. */
const MAX_BOARDS = 10;

/** @type {{root: object, save: Function}|null} */
let bridge = null;
let settings = null;
let saveTimer = 0;
let suspended = 0;
let missedEmit = false;
/** The chat whose board is live right now ('' means the shared board). */
let activeBoardId = '';
const listeners = new Set();
const boardListeners = new Set();

export function defaultSettings() {
    return {
        version: SCHEMA_VERSION,
        lang: 'en',
        ui: {
            floatingButton: true,
            wandButton: true,
            fab: { x: null, y: null, side: '', ratio: null },
            animations: true,
            lite: 'auto',
            labels: true,
            avatars: true,
            curved: true,
            legend: true,
        },
        behaviour: {
            autoSync: true,
            /** 'chat': a board per roleplay. 'global': one board for everything. */
            scope: 'chat',
        },
        /**
         * Story mode: bonds are not drawn up front, they grow out of the
         * roleplay itself. `chats` is a free-form map of chat id -> reading
         * progress, pruned in chronicle.js.
         */
        story: {
            enabled: true,
            cast: true,
            mentions: true,
            fade: true,
            pace: 'normal',
            depth: 500,
            chats: {},
        },
        /**
         * The director: a language model reads the roleplay and writes the cast
         * and their bonds itself. It can run on SillyTavern's current
         * connection, on a separate connection profile (a different model, so
         * the story keeps the main one), or on a bare OpenAI-compatible
         * endpoint.
         */
        ai: {
            enabled: false,
            /** Run by itself as the chat grows, or only when asked. */
            auto: true,
            /** 'main' | 'profile' | 'custom' */
            source: 'main',
            /** Connection profile id, when source is 'profile'. */
            profileId: '',
            /** Let the profile's own preset/instruct shape the request. */
            usePreset: false,
            custom: {
                url: '',
                key: '',
                model: '',
            },
            /** Messages between two automatic passes. */
            every: 6,
            /** How many messages one pass reads. */
            window: 30,
            /** How many messages a full re-read goes back through. */
            depth: 200,
            /** Character budget for the scene digest handed to the model. */
            maxChars: 9000,
            maxTokens: 900,
            temperature: 0.5,
            /** 'auto' follows the interface language. */
            lang: 'auto',
            /** What the director is allowed to write. */
            newSouls: true,
            newBonds: true,
            profiles: true,
            /** New souls one pass may bring in, so a crowd scene cannot flood. */
            maxNew: 6,
            /** Relations the model is unsure about are dropped. */
            minConfidence: 0.35,
            /** Free-form map of chat id -> director progress and story log. */
            chats: {},
        },
        filters: {
            love: true,
            close: true,
            friendly: true,
            tense: true,
            orphans: true,
        },
        /** The shared board, and the one used when no chat is open. */
        graph: {
            nodes: [],
            edges: [],
        },
        /** Free-form map of chat id -> { nodes, edges, updated }. */
        boards: {},
    };
}

/** Copies a free-form map defensively - unserialisable values are dropped. */
function cloneMap(value) {
    try {
        return JSON.parse(JSON.stringify(value)) || {};
    } catch {
        return {};
    }
}

/** Deep-merges stored values over the defaults, keeping unknown keys out. */
function merge(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const key of Object.keys(target)) {
        const value = source[key];
        if (value === undefined) continue;
        const current = target[key];

        if (Array.isArray(current)) {
            if (Array.isArray(value)) target[key] = value;
            continue;
        }
        if (current !== null && typeof current === 'object') {
            if (value !== null && typeof value === 'object') {
                // An empty default means "free-form map" (story.chats, boards):
                // keep the stored keys instead of dropping everything we did
                // not declare.
                if (Object.keys(current).length === 0) target[key] = cloneMap(value);
                else merge(current, value);
            }
            continue;
        }
        // A null default (an unset position, say) accepts any primitive;
        // a typed default only accepts the same type.
        if (value === null) {
            target[key] = null;
        } else if (current === null || typeof current === typeof value) {
            if (typeof value !== 'object' && typeof value !== 'function') target[key] = value;
        } else if (typeof current === 'string' && typeof value === 'number') {
            target[key] = String(value);
        }
    }
    return target;
}

/**
 * Initialises the store.
 * @param {{root: object, save: Function}|null} storage host-provided bridge
 */
export function initState(storage) {
    bridge = storage;
    const defaults = defaultSettings();
    let stored = null;

    if (bridge?.root) {
        stored = bridge.root;
    } else {
        try {
            stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
        } catch {
            stored = null;
        }
    }

    const storedVersion = Number(stored?.version) || 1;
    settings = merge(defaults, stored);
    // Positions are stored per node, so the arrays survive the merge untouched.
    if (!Array.isArray(settings.graph.nodes)) settings.graph.nodes = [];
    if (!Array.isArray(settings.graph.edges)) settings.graph.edges = [];
    if (!settings.boards || typeof settings.boards !== 'object') settings.boards = {};

    // Boards used to be one shared map. Somebody who already has a board built
    // that way keeps it: switching to per-chat boards is their call, not ours.
    if (storedVersion < SCHEMA_VERSION && settings.graph.nodes.length) {
        settings.behaviour.scope = 'global';
    }
    settings.version = SCHEMA_VERSION;

    if (bridge?.root) {
        // Write the normalised shape back into the live ST settings object.
        for (const key of Object.keys(settings)) bridge.root[key] = settings[key];
        settings = bridge.root;
    }
    return settings;
}

export function getSettings() {
    if (!settings) settings = defaultSettings();
    return settings;
}

/* ------------------------------------------------------------------ boards */

function emptyBoard() {
    return { nodes: [], edges: [], updated: Date.now() };
}

/** Normalises a stored board, repairing anything that came back malformed. */
function fixBoard(board) {
    if (!board || typeof board !== 'object') return emptyBoard();
    if (!Array.isArray(board.nodes)) board.nodes = [];
    if (!Array.isArray(board.edges)) board.edges = [];
    return board;
}

/** True when every roleplay keeps its own board. */
export function perChatBoards() {
    return getSettings().behaviour.scope !== 'global';
}

/** The id of the board in use ('' for the shared one). */
export function activeBoard() {
    return activeBoardId;
}

/**
 * Points the extension at the board of a chat. Called whenever ST swaps the
 * chat under us, and once at boot.
 * @param {string} [id] chat id; omitted means "ask the host"
 * @returns {boolean} true when the live board actually changed
 */
export function setActiveBoard(id) {
    const wanted = perChatBoards() ? String(id ?? chatId() ?? '') : '';
    if (wanted === activeBoardId) return false;
    activeBoardId = wanted;
    if (wanted) {
        const boards = getSettings().boards;
        boards[wanted] = fixBoard(boards[wanted]);
        boards[wanted].updated = Date.now();
        pruneBoards(wanted);
    }
    for (const fn of boardListeners) {
        try {
            fn(activeBoardId);
        } catch (err) {
            console.error('[MyLove Graph] board listener failed', err);
        }
    }
    return true;
}

export function onBoardChange(fn) {
    boardListeners.add(fn);
    return () => boardListeners.delete(fn);
}

/** Keeps the settings file from growing a board for every chat ever opened. */
function pruneBoards(keepId) {
    const boards = getSettings().boards;
    const keys = Object.keys(boards);
    if (keys.length <= MAX_BOARDS) return;
    keys.sort((a, b) => (boards[b]?.updated || 0) - (boards[a]?.updated || 0));
    for (const key of keys.slice(MAX_BOARDS)) {
        if (key === keepId) continue;
        // A board somebody put work into by hand is never thrown away.
        const board = boards[key];
        const handmade = (board?.nodes || []).some(n => n.origin === 'manual' || n.edited)
            || (board?.edges || []).some(e => e.origin === 'manual' || e.locked);
        if (!handmade) delete boards[key];
    }
}

/** The board in play: this chat's own, or the shared one. */
export function getGraph() {
    const all = getSettings();
    if (!activeBoardId) return all.graph;
    const boards = all.boards;
    if (!boards[activeBoardId]) boards[activeBoardId] = emptyBoard();
    return fixBoard(boards[activeBoardId]);
}

/** The shared board, whatever is live right now. */
export function globalGraph() {
    return getSettings().graph;
}

/**
 * Copies the shared board onto the live one. Used when somebody switches to
 * per-chat boards and wants the map they already built to come along.
 * @returns {{nodes: number, edges: number}}
 */
export function copyGlobalBoard() {
    const source = getSettings().graph;
    const target = getGraph();
    if (target === source) return { nodes: 0, edges: 0 };
    try {
        target.nodes = JSON.parse(JSON.stringify(source.nodes || []));
        target.edges = JSON.parse(JSON.stringify(source.edges || []));
    } catch (err) {
        console.error('[MyLove Graph] failed to copy the board', err);
        return { nodes: 0, edges: 0 };
    }
    save();
    return { nodes: target.nodes.length, edges: target.edges.length };
}

/** Marks the live board as touched, so pruning keeps the ones in use. */
export function touchBoard() {
    if (!activeBoardId) return;
    const board = getSettings().boards[activeBoardId];
    if (board) board.updated = Date.now();
}

/* ------------------------------------------------------------------ saving */

/** Persists the settings, debounced, and notifies subscribers immediately. */
export function save(notify = true) {
    touchBoard();
    if (bridge?.save) {
        try {
            bridge.save();
        } catch (err) {
            console.error('[MyLove Graph] failed to save settings', err);
        }
    } else {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
            } catch (err) {
                console.error('[MyLove Graph] failed to save settings', err);
            }
        }, 400);
    }
    if (!notify) return;
    if (suspended) missedEmit = true;
    else emit();
}

/**
 * Holds back UI notifications while a batch of writes runs (the chronicle folds
 * hundreds of messages at a time; re-rendering after each one would crawl).
 */
export function suspendNotify() {
    suspended++;
}

export function resumeNotify() {
    if (suspended > 0) suspended--;
    if (suspended || !missedEmit) return;
    missedEmit = false;
    emit();
}

/** Saves without waking the UI - used for cheap things like node positions. */
export function saveQuiet() {
    save(false);
}

export function onStateChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function emit() {
    for (const fn of listeners) {
        try {
            fn(settings);
        } catch (err) {
            console.error('[MyLove Graph] state listener failed', err);
        }
    }
}

/* ---------------------------------------------------------------- readings */

/** Story mode: bonds surface as the roleplay goes on instead of all at once. */
export function storyEnabled() {
    return !!getSettings().story.enabled;
}

/** True when the director (a model reading the chat) is switched on. */
export function directorEnabled() {
    return !!getSettings().ai.enabled;
}

/** How fast bonds grow: gentle keeps it subtle, fast makes every scene count. */
export function storyPace() {
    const pace = getSettings().story.pace;
    if (pace === 'gentle') return 0.6;
    if (pace === 'fast') return 1.8;
    return 1;
}

/** True when the heavy effects should be skipped on this device. */
export function isLite() {
    const mode = getSettings().ui.lite;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return isTouchDevice();
}

export function isTouchDevice() {
    try {
        return window.matchMedia('(hover: none), (pointer: coarse)').matches
            || Math.min(window.innerWidth, window.innerHeight) < 600;
    } catch {
        return false;
    }
}

export function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** Animations are on only when the user wants them and the device tolerates them. */
export function animationsEnabled() {
    return getSettings().ui.animations && !prefersReducedMotion();
}
