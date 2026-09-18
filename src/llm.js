/**
 * MyLove Graph - the wire to a language model.
 *
 * The director needs a model to read the roleplay with, and the whole point of
 * this module is that it does not have to be *the* model. Three routes:
 *
 *   'main'    - SillyTavern's current connection. Nothing to configure, but
 *               every pass competes with the story for the same backend.
 *   'profile' - a saved connection profile. This is the interesting one: a
 *               small, cheap model can keep the map up to date while the good
 *               model stays free for the roleplay itself.
 *   'custom'  - a bare OpenAI-compatible endpoint (llama.cpp, Ollama, LM Studio,
 *               a proxy). Useful when connection profiles are not available.
 *
 * Requests are serialised: one pass at a time, never in parallel with itself.
 */

import {
    ctx,
    connectionProfiles,
    connectionService,
    activeProfileId,
    mainApiLabel,
    generateWithMain,
    generateWithProfile,
} from './host.js';
import { getSettings } from './state.js';

export const SOURCES = ['main', 'profile', 'custom'];

let chain = Promise.resolve();
let inFlight = 0;
let controller = null;

/* ------------------------------------------------------------- the target */

export { connectionProfiles };

export function profileById(id) {
    return connectionProfiles().find(profile => profile.id === id) || null;
}

/** True when this ST build can talk to profiles other than the active one. */
export function profilesSupported() {
    return !!connectionService();
}

/**
 * Can the director actually send anything right now?
 * @returns {{ok: boolean, reason: string}}
 */
export function readiness() {
    const ai = getSettings().ai;
    if (ai.source === 'profile') {
        if (!profilesSupported()) return { ok: false, reason: 'noProfiles' };
        if (!ai.profileId) return { ok: false, reason: 'noProfile' };
        if (!profileById(ai.profileId)) return { ok: false, reason: 'goneProfile' };
        return { ok: true, reason: '' };
    }
    if (ai.source === 'custom') {
        if (!ai.custom.url) return { ok: false, reason: 'noUrl' };
        if (!ai.custom.model) return { ok: false, reason: 'noModel' };
        return { ok: true, reason: '' };
    }
    if (!ctx()) return { ok: false, reason: 'noHost' };
    return { ok: true, reason: '' };
}

/** A short human description of where generation goes. */
export function targetLabel() {
    const ai = getSettings().ai;
    if (ai.source === 'profile') {
        const profile = profileById(ai.profileId);
        if (!profile) return ai.profileId || '—';
        return profile.model ? `${profile.name} · ${profile.model}` : profile.name;
    }
    if (ai.source === 'custom') {
        return ai.custom.model ? `${ai.custom.model}` : ai.custom.url || '—';
    }
    const active = profileById(activeProfileId());
    return active ? `${active.name}${active.model ? ' · ' + active.model : ''}` : (mainApiLabel() || 'SillyTavern');
}

export function busy() {
    return inFlight > 0;
}

/** Cancels whatever is in flight (a custom-endpoint request can be cut short). */
export function abort() {
    try {
        controller?.abort();
    } catch {
        /* nothing to do */
    }
    controller = null;
}

/* ------------------------------------------------------------- the sending */

/** Pulls the text out of whatever shape a backend answered with. */
function toText(result) {
    if (result === null || result === undefined) return '';
    if (typeof result === 'string') return result;
    if (Array.isArray(result)) return result.map(toText).filter(Boolean).join('\n');
    if (typeof result === 'object') {
        const direct = result.content ?? result.text ?? result.message?.content ?? result.response;
        if (typeof direct === 'string') return direct;
        const choice = Array.isArray(result.choices) ? result.choices[0] : null;
        if (choice) {
            const nested = choice.message?.content ?? choice.text ?? choice.delta?.content;
            if (typeof nested === 'string') return nested;
        }
    }
    return '';
}

/** Turns a base URL into a chat-completions endpoint, leaving full ones alone. */
export function completionsUrl(raw) {
    const url = String(raw || '').trim().replace(/\s+/g, '');
    if (!url) return '';
    if (/\/(chat\/)?completions\/?$/.test(url)) return url.replace(/\/$/, '');
    const base = url.replace(/\/+$/, '');
    if (/\/v\d+$/.test(base)) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
}

async function sendCustom({ prompt, system, maxTokens, temperature }) {
    const { custom } = getSettings().ai;
    const url = completionsUrl(custom.url);
    if (!url) throw new Error('No endpoint URL');

    controller = new AbortController();
    const headers = { 'Content-Type': 'application/json' };
    if (custom.key) headers.Authorization = `Bearer ${custom.key}`;

    const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
            model: custom.model,
            messages: [
                system ? { role: 'system', content: system } : null,
                { role: 'user', content: prompt },
            ].filter(Boolean),
            temperature,
            max_tokens: maxTokens,
            stream: false,
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? ' · ' + detail.slice(0, 200) : ''}`);
    }
    return toText(await response.json());
}

/**
 * Sends one request, queued behind any other.
 * @param {{system?: string, prompt: string, maxTokens?: number, temperature?: number}} request
 * @returns {Promise<string>} the model's answer, as text
 */
export function generate({ system = '', prompt, maxTokens, temperature }) {
    const ai = getSettings().ai;
    const limit = maxTokens || ai.maxTokens || 900;
    const heat = typeof temperature === 'number' ? temperature : (ai.temperature ?? 0.5);

    const run = async () => {
        const ready = readiness();
        if (!ready.ok) throw new Error(`director not configured (${ready.reason})`);

        inFlight++;
        try {
            if (ai.source === 'custom') {
                return toText(await sendCustom({ prompt, system, maxTokens: limit, temperature: heat }));
            }
            if (ai.source === 'profile') {
                return toText(await generateWithProfile(ai.profileId, {
                    prompt,
                    system,
                    maxTokens: limit,
                    usePreset: ai.usePreset,
                }));
            }
            return toText(await generateWithMain({ prompt, system, maxTokens: limit }));
        } finally {
            inFlight--;
            controller = null;
        }
    };

    // One at a time, and a failure never poisons the queue for the next caller.
    const next = chain.then(run, run);
    chain = next.catch(() => {});
    return next;
}

/* -------------------------------------------------------------- JSON tools */

/** Strips code fences and any prose the model wrapped its answer in. */
function unwrap(text) {
    let value = String(text || '').trim();
    const fence = value.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (fence) value = fence[1].trim();
    return value;
}

/**
 * Finds the first balanced {...} or [...] block, so trailing chatter ("Here you
 * go!") does not break the parse. Quotes and escapes are tracked, otherwise a
 * brace inside a character's name would end the block early.
 */
function carve(text) {
    const start = text.search(/[{[]/);
    if (start < 0) return '';
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === open) depth++;
        else if (char === close && --depth === 0) return text.slice(start, i + 1);
    }
    // Truncated by a token limit: close whatever is still open and hope.
    return depth > 0 ? text.slice(start) + close.repeat(depth) : '';
}

/** The usual model slips: trailing commas, smart quotes, stray comments. */
function repair(text) {
    return text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1');
}

/**
 * Parses a model answer into an object.
 * @returns {any|null} null when there is nothing parseable in there
 */
export function parseJson(text) {
    const body = carve(unwrap(text));
    if (!body) return null;
    for (const candidate of [body, repair(body)]) {
        try {
            return JSON.parse(candidate);
        } catch {
            /* try the repaired one */
        }
    }
    return null;
}
