/**
 * MyLove Graph - the data model: souls (nodes) and bonds (edges).
 */

import { getGraph, save, saveQuiet } from './state.js';
import {
    characters,
    groups,
    userName,
    userAvatarFile,
    characterAvatarUrl,
    characterAvatarFallback,
    personaAvatarUrl,
    personaAvatarFallback,
} from './host.js';

export const REL_TYPES = ['love', 'close', 'friendly', 'tense'];

/**
 * Relationship styling. Bonds are encoded three ways at once - colour, line
 * width and dash pattern - so they stay readable on small screens and for
 * colour-blind readers.
 */
export const REL_META = {
    love: {
        color: '#ff2d78',
        glow: '#ff85bb',
        width: 3.2,
        dash: null,
        rest: 130,
        glyph: '♥',
        order: 0,
    },
    close: {
        color: '#b46bff',
        glow: '#dcb4ff',
        width: 2.4,
        dash: null,
        rest: 165,
        glyph: '✿',
        order: 1,
    },
    friendly: {
        color: '#4fd6c8',
        glow: '#a6f2e9',
        width: 1.9,
        dash: [8, 7],
        rest: 200,
        glyph: '◇',
        order: 2,
    },
    tense: {
        color: '#ff6a3d',
        glow: '#ffb495',
        width: 2.1,
        dash: [2, 7],
        rest: 250,
        glyph: '✕',
        order: 3,
    },
};

export const NODE_ACCENTS = [
    '#ff2d78', '#ff7ab8', '#b46bff', '#7f8cff',
    '#4fd6c8', '#63e08a', '#ffc24d', '#ff6a3d',
];

export function uid(prefix = 'n') {
    return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ nodes */

export function nodes() {
    return getGraph().nodes;
}

export function edges() {
    return getGraph().edges;
}

export function findNode(id) {
    return nodes().find(n => n.id === id) || null;
}

export function nodeName(id) {
    return findNode(id)?.name || '?';
}

export function createNode(patch = {}) {
    const node = {
        id: patch.id || uid('npc'),
        kind: patch.kind || 'npc',
        name: patch.name || 'Unnamed',
        role: patch.role || '',
        note: patch.note || '',
        avatar: patch.avatar || null,
        avatarUrl: patch.avatarUrl || '',
        color: patch.color || '',
        x: typeof patch.x === 'number' ? patch.x : null,
        y: typeof patch.y === 'number' ? patch.y : null,
        pinned: !!patch.pinned,
        missing: !!patch.missing,
    };
    return node;
}

export function addNode(patch) {
    const node = createNode(patch);
    nodes().push(node);
    save();
    return node;
}

export function removeNode(id) {
    const list = nodes();
    const index = list.findIndex(n => n.id === id);
    if (index >= 0) list.splice(index, 1);
    const bonds = edges();
    for (let i = bonds.length - 1; i >= 0; i--) {
        if (bonds[i].a === id || bonds[i].b === id) bonds.splice(i, 1);
    }
    save();
}

/** Resolves the avatar candidates for a node: primary URL plus a fallback. */
export function avatarSources(node) {
    if (!node) return [];
    if (node.avatarUrl) return [node.avatarUrl];
    if (node.kind === 'persona') {
        return [personaAvatarUrl(node.avatar), personaAvatarFallback(node.avatar)].filter(Boolean);
    }
    if (node.avatar) {
        return [characterAvatarUrl(node.avatar), characterAvatarFallback(node.avatar)].filter(Boolean);
    }
    return [];
}

/* ------------------------------------------------------------------ edges */

export function findEdge(a, b) {
    return edges().find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null;
}

export function edgesOf(id) {
    return edges().filter(e => e.a === id || e.b === id);
}

export function upsertEdge(patch) {
    const existing = patch.id ? edges().find(e => e.id === patch.id) : findEdge(patch.a, patch.b);
    if (existing) {
        Object.assign(existing, {
            a: patch.a ?? existing.a,
            b: patch.b ?? existing.b,
            type: REL_META[patch.type] ? patch.type : existing.type,
            strength: clamp(Number(patch.strength ?? existing.strength) || 50, 1, 100),
            dir: ['both', 'a2b', 'b2a'].includes(patch.dir) ? patch.dir : existing.dir,
            note: patch.note ?? existing.note,
        });
        save();
        return existing;
    }
    const edge = {
        id: uid('e'),
        a: patch.a,
        b: patch.b,
        type: REL_META[patch.type] ? patch.type : 'friendly',
        strength: clamp(Number(patch.strength) || 50, 1, 100),
        dir: ['both', 'a2b', 'b2a'].includes(patch.dir) ? patch.dir : 'both',
        note: patch.note || '',
    };
    edges().push(edge);
    save();
    return edge;
}

export function removeEdge(id) {
    const list = edges();
    const index = list.findIndex(e => e.id === id);
    if (index >= 0) {
        list.splice(index, 1);
        save();
    }
}

/* ---------------------------------------------------------------- metrics */

/** The relationship colour a node is drawn with: its strongest bond wins. */
export function dominantType(id) {
    let best = null;
    let bestScore = -1;
    for (const edge of edgesOf(id)) {
        const weight = (edge.strength || 50) * (edge.type === 'love' ? 1.25 : 1);
        if (weight > bestScore) {
            bestScore = weight;
            best = edge.type;
        }
    }
    return best;
}

/**
 * The three meters shown in the BASIS panel, each normalised to 0-100.
 * - affection: how much warmth flows through this character overall
 * - devotion: the single strongest positive bond
 * - tension: the accumulated friction
 */
export function nodeMetrics(id) {
    const own = edgesOf(id);
    const sum = (types, factor) => own
        .filter(e => types.includes(e.type))
        .reduce((acc, e) => acc + (e.strength || 50) * factor, 0);

    const affection = clamp(
        (sum(['love'], 1) + sum(['close'], 0.7) + sum(['friendly'], 0.35)) / 2.4,
        0,
        100,
    );

    let devotion = 0;
    for (const edge of own) {
        const factor = edge.type === 'love' ? 1 : edge.type === 'close' ? 0.72 : edge.type === 'friendly' ? 0.4 : 0;
        devotion = Math.max(devotion, (edge.strength || 50) * factor);
    }

    const tension = clamp(sum(['tense'], 1) / 1.5, 0, 100);

    return {
        affection: Math.round(affection),
        devotion: Math.round(devotion),
        tension: Math.round(tension),
        bonds: own.length,
    };
}

export function degree(id) {
    return edgesOf(id).length;
}

/* ------------------------------------------------------- SillyTavern sync */

const CHAR_PREFIX = 'char:';
const PERSONA_ID = 'persona:me';

export function characterNodeId(avatarFile, name) {
    return CHAR_PREFIX + (avatarFile || name || 'unknown');
}

/**
 * Pulls every character card (and the active persona) onto the board.
 * Existing nodes keep their position, notes and colour.
 * @returns {{added: number, updated: number, total: number}}
 */
export function syncCharacters({ addPersona = true } = {}) {
    const list = nodes();
    const byId = new Map(list.map(n => [n.id, n]));
    let added = 0;
    let updated = 0;
    const seen = new Set();

    for (const char of characters()) {
        if (!char || (!char.avatar && !char.name)) continue;
        const id = characterNodeId(char.avatar, char.name);
        seen.add(id);
        const existing = byId.get(id);
        if (existing) {
            if (existing.name !== char.name || existing.missing) updated++;
            existing.name = char.name || existing.name;
            existing.avatar = char.avatar || existing.avatar;
            existing.kind = 'char';
            existing.missing = false;
        } else {
            const node = createNode({
                id,
                kind: 'char',
                name: char.name || 'Unnamed',
                avatar: char.avatar || null,
            });
            list.push(node);
            byId.set(id, node);
            added++;
        }
    }

    if (addPersona) {
        const persona = byId.get(PERSONA_ID);
        const name = userName();
        if (persona) {
            persona.name = name;
            persona.avatar = userAvatarFile() || persona.avatar;
        } else {
            list.push(createNode({
                id: PERSONA_ID,
                kind: 'persona',
                name,
                avatar: userAvatarFile(),
                color: '#ffd1e6',
            }));
            added++;
        }
    }

    // Cards that disappeared stay on the board but are marked, so the bonds
    // that reference them are never silently destroyed.
    for (const node of list) {
        if (node.kind === 'char' && !seen.has(node.id)) node.missing = true;
    }

    if (added || updated) save();
    return { added, updated, total: list.length };
}

/** Adds the members of a group chat as nodes. */
export function importGroup(groupId) {
    const group = groups().find(g => String(g.id) === String(groupId));
    if (!group) return 0;
    const members = Array.isArray(group.members) ? group.members : [];
    const list = nodes();
    const known = new Set(list.map(n => n.id));
    let added = 0;

    for (const member of members) {
        const char = characters().find(c => c.avatar === member);
        const id = characterNodeId(member, char?.name);
        if (known.has(id)) continue;
        list.push(createNode({
            id,
            kind: 'char',
            name: char?.name || String(member).replace(/\.[^.]+$/, ''),
            avatar: member,
            missing: !char,
        }));
        known.add(id);
        added++;
    }
    if (added) save();
    return added;
}

/* -------------------------------------------------------- import / export */

export function exportGraph() {
    const graph = getGraph();
    return {
        format: 'mylove-graph',
        version: 1,
        exportedAt: new Date().toISOString(),
        nodes: graph.nodes,
        edges: graph.edges,
    };
}

/**
 * Replaces the board with an imported payload.
 * @returns {{nodes: number, edges: number}|null} null when the payload is not ours
 */
export function importGraph(payload) {
    if (!payload || payload.format !== 'mylove-graph' || !Array.isArray(payload.nodes)) return null;
    const graph = getGraph();
    const cleanNodes = payload.nodes
        .filter(n => n && n.id && n.name)
        .map(n => createNode(n));
    const ids = new Set(cleanNodes.map(n => n.id));
    const cleanEdges = (Array.isArray(payload.edges) ? payload.edges : [])
        .filter(e => e && ids.has(e.a) && ids.has(e.b) && e.a !== e.b)
        .map(e => ({
            id: e.id || uid('e'),
            a: e.a,
            b: e.b,
            type: REL_META[e.type] ? e.type : 'friendly',
            strength: clamp(Number(e.strength) || 50, 1, 100),
            dir: ['both', 'a2b', 'b2a'].includes(e.dir) ? e.dir : 'both',
            note: typeof e.note === 'string' ? e.note : '',
        }));

    graph.nodes = cleanNodes;
    graph.edges = cleanEdges;
    save();
    return { nodes: cleanNodes.length, edges: cleanEdges.length };
}

export function clearGraph() {
    const graph = getGraph();
    graph.nodes = [];
    graph.edges = [];
    save();
}

/** Stores layout positions without waking the whole UI. */
export function persistPositions() {
    saveQuiet();
}
