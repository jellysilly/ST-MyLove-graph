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
