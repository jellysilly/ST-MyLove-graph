/**
 * MyLove Graph - persistent state.
 *
 * The extension prefers SillyTavern's own settings store so the graph travels
 * with the user profile. When that store is unavailable (older builds, or the
 * module loaded outside ST) it falls back to localStorage so nothing is lost.
 */

export const NAMESPACE = 'mylove_graph';
const LOCAL_KEY = 'mylove_graph_settings';
const SCHEMA_VERSION = 1;

/** @type {{root: object, save: Function}|null} */
let bridge = null;
let settings = null;
let saveTimer = 0;
const listeners = new Set();

export function defaultSettings() {
    return {
        version: SCHEMA_VERSION,
        lang: 'en',
        ui: {
            floatingButton: true,
            wandButton: true,
            fab: { x: null, y: null },
            animations: true,
            lite: 'auto',
            labels: true,
            avatars: true,
            curved: true,
            legend: true,
        },
        behaviour: {
            autoSync: true,
        },
        filters: {
            love: true,
            close: true,
            friendly: true,
            tense: true,
            orphans: true,
        },
        graph: {
            nodes: [],
            edges: [],
        },
    };
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
            if (value !== null && typeof value === 'object') merge(current, value);
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

    settings = merge(defaults, stored);
    // Positions are stored per node, so the arrays survive the merge untouched.
    if (!Array.isArray(settings.graph.nodes)) settings.graph.nodes = [];
    if (!Array.isArray(settings.graph.edges)) settings.graph.edges = [];

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

export function getGraph() {
    return getSettings().graph;
}

/** Persists the settings, debounced, and notifies subscribers immediately. */
export function save(notify = true) {
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
    if (notify) emit();
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
