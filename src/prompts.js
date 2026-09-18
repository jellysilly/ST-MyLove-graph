/**
 * MyLove Graph - what the director actually asks the model.
 *
 * Everything here is plain text assembly: a digest of the scenes that are new,
 * the cast the board already knows about, and a strict JSON shape to answer in.
 * The prompts are deliberately small and blunt so that a cheap, fast model on a
 * second connection profile can keep up with the story.
 */

import { REL_TYPES } from './model.js';

const LANGUAGE_NAMES = {
    en: 'English',
    ru: 'Russian (Русский)',
};

/** The language the model should write its prose in. */
export function languageName(id) {
    return LANGUAGE_NAMES[id] || LANGUAGE_NAMES.en;
}

/** Cuts a message down to something a prompt can afford to carry. */
function condense(text, limit = 700) {
    const cleaned = String(text || '')
        // Reasoning blocks and HTML are noise for this task.
        .replace(/<(think|thinking|reasoning)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/?[a-z][^>]*>/gi, ' ')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (cleaned.length <= limit) return cleaned;
    return cleaned.slice(0, limit).replace(/\s+\S*$/, '') + ' …';
}

/**
 * Renders chat messages [from, to) as a numbered scene log.
 *
 * When the window does not fit the character budget the *oldest* lines are
 * dropped: what just happened matters more than what happened ten scenes ago.
 * @returns {{text: string, first: number, last: number, count: number}}
 */
export function sceneDigest(messages, from, to, { maxChars = 9000, userName = 'You' } = {}) {
    const lines = [];
    let used = 0;
    let first = to;

    for (let i = to - 1; i >= from; i--) {
        const message = messages[i];
        if (!message || message.is_system) continue;
        const body = condense(message.mes);
        if (!body) continue;
        const who = message.is_user ? (message.name || userName) : (message.name || 'Narrator');
        const line = `#${i + 1} ${who}: ${body}`;
        if (used + line.length > maxChars && lines.length) break;
        used += line.length + 1;
        lines.push(line);
        first = i;
    }

    lines.reverse();
    return {
        text: lines.join('\n'),
        first: first + 1,
        last: to,
        count: lines.length,
    };
}

/** The cast the board already knows, so the model updates instead of duplicating. */
export function castDigest(nodes, { limit = 60 } = {}) {
    if (!nodes.length) return '(nobody yet)';
    return nodes.slice(0, limit).map(node => {
        const bits = [];
        if (node.kind === 'persona') bits.push('the user');
        else if (node.kind === 'char') bits.push('character card');
        if (node.role) bits.push(node.role);
        if (node.aliases) bits.push(`also: ${node.aliases}`);
        return `- ${node.name}${bits.length ? ' (' + bits.join('; ') + ')' : ''}`;
    }).join('\n');
}

/** The bonds already drawn, in one line each. */
export function bondDigest(edges, nameOf, { limit = 60 } = {}) {
    if (!edges.length) return '(none yet)';
    return edges.slice(0, limit).map(edge => {
        const arrow = edge.dir === 'a2b' ? '->' : edge.dir === 'b2a' ? '<-' : '<->';
        const label = edge.note ? ` "${edge.note}"` : '';
        const held = edge.locked ? ' [locked by the user - do not change]' : '';
        return `- ${nameOf(edge.a)} ${arrow} ${nameOf(edge.b)}: ${edge.type} ${Math.round(edge.strength || 50)}${label}${held}`;
    }).join('\n');
}

const SYSTEM = [
    'You are the Chronicler of a roleplay: a cold, precise analyst.',
    'You read scene logs and report who is in them and how they feel about each other.',
    'You never continue the story, never write dialogue, never give advice, never explain yourself.',
    'You answer with one JSON object and nothing else - no prose, no code fences, no comments.',
].join(' ');

/**
 * The main pass: who walked into the story, and what is happening between them.
 *
 * @param {object} options
 * @param {string} options.scenes   numbered scene log
 * @param {string} options.cast     the cast already on the board
 * @param {string} options.bonds    the bonds already drawn
 * @param {string} options.title    what this roleplay is called
 * @param {string} options.lang     language id for the prose fields
 * @param {boolean} options.newSouls  may the director introduce people
 * @param {boolean} options.newBonds  may the director draw new bonds
 * @param {boolean} options.profiles  may the director write character profiles
 * @param {number} options.maxNew     cap on newly introduced people
 * @returns {{system: string, prompt: string}}
 */
export function directorPrompt({
    scenes,
    cast,
    bonds,
    title = '',
    lang = 'en',
    newSouls = true,
    newBonds = true,
    profiles = true,
    maxNew = 6,
}) {
    const language = languageName(lang);
    const types = REL_TYPES.join(' | ');

    const rules = [
        'Report ONLY people who actually appear, speak or are named in the scenes above. Never invent anyone.',
        newSouls
            ? `You may introduce people the cast list does not have yet - at most ${maxNew} of them, the ones that matter.`
            : 'Do NOT introduce anyone new: report only people already in the cast list.',
        'Reuse the exact spelling from the cast list for anyone already there, so they are recognised and not duplicated.',
        'Narrators, crowds, "the guards" and other faceless groups are not characters. Skip them.',
        profiles
            ? 'For every character give a "role" of two or three words and a "summary" of one or two sentences, built only from what the scenes show.'
            : 'Leave "role" and "summary" empty.',
        newBonds
            ? 'Report a relation only for pairs the scenes actually say something about.'
            : 'Report relations only for pairs that already exist in the bond list.',
        'A relation marked [locked by the user] must be left out entirely.',
        `"type" is one of: ${types}. Use "none" when the scenes show the bond is over.`,
        '"strength" is 1-100: how intense the bond is. "confidence" is 0-1: how sure the scenes make you.',
        '"dir" is "both" when it goes both ways, "a2b" when only a feels it, "b2a" when only b does.',
        '"label" is at most four words, e.g. "unrequited", "sworn enemies", "childhood friends".',
        '"events" are at most three short lines, each one thing that changed between these people in these scenes.',
        `Write "role", "summary", "traits", "label" and "events" in ${language}. Keep "name", "type" and "dir" exactly as specified.`,
    ].filter(Boolean);

    const shape = `{
  "characters": [
    { "name": "string", "aka": ["other spellings"], "kind": "npc" | "character", "role": "string", "summary": "string", "traits": ["short", "words"] }
  ],
  "relations": [
    { "a": "name", "b": "name", "type": "${types} | none", "strength": 1-100, "dir": "both" | "a2b" | "b2a", "label": "string", "confidence": 0-1 }
  ],
  "events": ["string"]
}`;

    const prompt = [
        title ? `# Roleplay\n${title}` : '',
        `# Cast already on the map\n${cast}`,
        `# Bonds already drawn\n${bonds}`,
        `# New scenes\n${scenes || '(nothing new)'}`,
        `# Your task\nRead the new scenes and report the cast and their relationships.`,
        `# Answer with exactly this JSON shape\n${shape}`,
        `# Rules\n${rules.map(rule => '- ' + rule).join('\n')}`,
    ].filter(Boolean).join('\n\n');

    return { system: SYSTEM, prompt };
}

/**
 * The close-up: everything the story lets us say about one person.
 * @returns {{system: string, prompt: string}}
 */
export function dossierPrompt({ name, scenes, cast, bonds, lang = 'en' }) {
    const language = languageName(lang);
    const shape = `{
  "role": "two or three words",
  "summary": "one or two sentences",
  "appearance": "one or two sentences",
  "personality": "one or two sentences",
  "goal": "what they are after, one sentence",
  "secret": "what they keep to themselves, one sentence, or \\"\\" if the story never hints at one",
  "voice": "how they speak, one short sentence",
  "traits": ["short", "words"],
  "aka": ["other spellings the story uses"]
}`;

    const prompt = [
        `# Person\n${name}`,
        `# Cast around them\n${cast}`,
        `# Their bonds\n${bonds}`,
        `# Scenes they are in\n${scenes || '(none)'}`,
        `# Your task\nWrite a short dossier on ${name}, built ONLY from what these scenes show. Where the story says nothing, leave the field as an empty string instead of inventing.`,
        `# Answer with exactly this JSON shape\n${shape}`,
        `# Rules\n- Write every value in ${language}.\n- No prose outside the JSON.`,
    ].join('\n\n');

    return { system: SYSTEM, prompt };
}
