/**
 * MyLove Graph - a thin, defensive wrapper around the SillyTavern host.
 *
 * Every ST API used here is optional: the extension degrades gracefully instead
 * of throwing when a build does not expose something.
 */

let host = {
    getContext: null,
    eventSource: null,
    eventTypes: null,
    userAvatar: null,
};

export function setHost(value) {
    host = { ...host, ...value };
}

/** @returns {any} the SillyTavern context, or null outside of ST. */
export function ctx() {
    try {
        return typeof host.getContext === 'function' ? host.getContext() : null;
    } catch {
        return null;
    }
}

export function characters() {
    const list = ctx()?.characters;
    return Array.isArray(list) ? list : [];
}

export function groups() {
    const list = ctx()?.groups;
    return Array.isArray(list) ? list : [];
}

/** The messages of the chat that is open right now. */
export function chat() {
    const context = ctx();
    const list = context?.chat;
    return Array.isArray(list) ? list : [];
}

/**
 * An id for the open chat. Group chats and solo chats report it differently
 * across ST builds, so every known spelling is tried.
 */
export function chatId() {
    const context = ctx();
    if (!context) return '';
    const id = context.groupId
        || (typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : null)
        || context.chatId
        || context.chat_id
        || '';
    return String(id || '');
}

export function userName() {
    return ctx()?.name1 || 'You';
}

export function userAvatarFile() {
    const context = ctx();
    return context?.userAvatar || context?.user_avatar || host.userAvatar || null;
}

/** Subscribes to an ST event if both the bus and the event name exist. */
export function on(eventName, handler) {
    const name = host.eventTypes?.[eventName];
    if (!name || !host.eventSource?.on) return () => {};
    host.eventSource.on(name, handler);
    return () => {
        try {
            host.eventSource.removeListener?.(name, handler);
        } catch {
            /* nothing to do */
        }
    };
}

/** Shows a toast through ST's toastr when present, otherwise logs. */
export function toast(message, type = 'info') {
    try {
        const fn = window.toastr?.[type] || window.toastr?.info;
        if (typeof fn === 'function') {
            fn.call(window.toastr, message, 'MyLove Graph', { timeOut: 3500 });
            return;
        }
    } catch {
        /* fall through */
    }
    console.info('[MyLove Graph]', message);
}

/** Builds the URL for a character avatar, preferring ST's thumbnail cache. */
export function characterAvatarUrl(file) {
    if (!file) return null;
    if (/^(https?:|data:|blob:)/.test(file)) return file;
    return `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`;
}

export function characterAvatarFallback(file) {
    if (!file || /^(https?:|data:|blob:)/.test(file)) return null;
    return `/characters/${encodeURIComponent(file)}`;
}

export function personaAvatarUrl(file) {
    if (!file) return null;
    if (/^(https?:|data:|blob:)/.test(file)) return file;
    return `/thumbnail?type=persona&file=${encodeURIComponent(file)}`;
}

export function personaAvatarFallback(file) {
    if (!file || /^(https?:|data:|blob:)/.test(file)) return null;
    return `/User Avatars/${encodeURIComponent(file)}`;
}

/* ------------------------------------------------- generation (the director)

 * Everything below is what the director needs to reach a model. Three routes
 * are supported, and every one of them is optional:
 *
 *   main    - whatever SillyTavern is connected to right now
 *   profile - a saved connection profile, so the map can be written by a
 *             different (cheaper, faster) model than the one telling the story
 *   custom  - a bare OpenAI-compatible endpoint, for local backends
 */

/** ST's own extension settings blob, where connection profiles live. */
export function extensionSettings() {
    const context = ctx();
    return context?.extensionSettings || context?.extension_settings || null;
}

/**
 * The saved connection profiles of this ST install.
 * @returns {Array<{id: string, name: string, api: string, model: string, preset: string}>}
 */
export function connectionProfiles() {
    const manager = extensionSettings()?.connectionManager;
    const list = Array.isArray(manager?.profiles) ? manager.profiles : [];
    return list
        .filter(profile => profile && profile.id)
        .map(profile => ({
            id: String(profile.id),
            name: profile.name || profile.id,
            api: profile.api || profile['api-url'] || '',
            model: profile.model || '',
            preset: profile.preset || '',
        }));
}

/** The connection profile ST itself is using, if any. */
export function activeProfileId() {
    return String(extensionSettings()?.connectionManager?.selectedProfile || '');
}

/** ST's helper for talking to a profile other than the active one. */
export function connectionService() {
    const service = ctx()?.ConnectionManagerRequestService;
    return typeof service?.sendRequest === 'function' ? service : null;
}

/** A label for the connection ST is on right now. */
export function mainApiLabel() {
    const context = ctx();
    const api = context?.mainApi || context?.main_api || '';
    const model = context?.onlineStatus && context.onlineStatus !== 'no_connection'
        ? context.onlineStatus
        : '';
    return [api, model].filter(Boolean).join(' · ');
}

/** True when ST is busy answering the user - the director waits its turn. */
export function hostBusy() {
    const context = ctx();
    try {
        if (typeof context?.isGenerating === 'function') return !!context.isGenerating();
        if (typeof context?.isGenerating === 'boolean') return context.isGenerating;
    } catch {
        /* fall through */
    }
    return false;
}

/**
 * Generates through the connection ST is on.
 *
 * Both entry points changed shape between ST releases (positional arguments
 * became a single options object), so the arity of the function decides how it
 * is called. Anything unexpected just means "this route is unavailable".
 */
export async function generateWithMain({ prompt, system = '', maxTokens = 800 }) {
    const context = ctx();
    if (!context) throw new Error('SillyTavern context unavailable');

    const raw = context.generateRaw;
    if (typeof raw === 'function') {
        const args = raw.length <= 1
            ? [{ prompt, systemPrompt: system, responseLength: maxTokens, trimNames: true }]
            : [prompt, null, false, false, system, maxTokens];
        return await raw.apply(context, args);
    }

    const quiet = context.generateQuietPrompt;
    if (typeof quiet === 'function') {
        const joined = system ? `${system}\n\n${prompt}` : prompt;
        const args = quiet.length <= 1
            ? [{ quietPrompt: joined, responseLength: maxTokens, skipWIAN: true }]
            : [joined, false, true, null, null, maxTokens];
        return await quiet.apply(context, args);
    }

    throw new Error('This SillyTavern build exposes no generation API');
}

/**
 * Generates through a saved connection profile.
 * @param {string} profileId
 */
export async function generateWithProfile(profileId, { prompt, system = '', maxTokens = 800, usePreset = false }) {
    const service = connectionService();
    if (!service) throw new Error('Connection profiles are not available in this SillyTavern build');
    if (!profileId) throw new Error('No connection profile selected');

    const joined = system ? `${system}\n\n${prompt}` : prompt;
    return await service.sendRequest(profileId, joined, maxTokens, {
        includePreset: !!usePreset,
        includeInstruct: !!usePreset,
    });
}

/** The name the open chat goes by - a character, or a group. */
export function chatTitle() {
    const context = ctx();
    if (!context) return '';
    if (context.groupId) {
        const group = groups().find(g => String(g.id) === String(context.groupId));
        if (group?.name) return group.name;
    }
    return context.name2 || '';
}
