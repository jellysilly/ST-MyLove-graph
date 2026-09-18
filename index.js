/**
 * MyLove Graph - a visual map of the bonds between every character and NPC.
 *
 * Entry point: wires the SillyTavern host into the extension's own modules.
 * Every ST integration point is optional, so a missing API degrades into a
 * smaller feature set instead of breaking the extension.
 */

import { setHost, on as onStEvent } from './src/host.js';
import { initState, getSettings, save, onStateChange, storyEnabled } from './src/state.js';
import { setLanguage } from './src/i18n.js';
import { el, icon } from './src/dom.js';
import { initViewport } from './src/viewport.js';
import * as model from './src/model.js';
import * as chronicle from './src/chronicle.js';
import * as panel from './src/panel.js';
import { createFab, updateFab, setFabVisible } from './src/fab.js';
import { mountSettings, refreshSettings } from './src/settingsUi.js';

const LOG = '[MyLove Graph]';

/* --------------------------------------------------- SillyTavern bindings */

/**
 * Loads ST's core modules. They are imported dynamically so that a path or API
 * change downgrades the extension to localStorage instead of killing it.
 */
async function connectHost() {
    let extensions = null;
    let script = null;

    try {
        extensions = await import('../../../extensions.js');
    } catch (err) {
        console.warn(LOG, 'extensions.js is unavailable, running standalone', err);
    }
    try {
        script = await import('../../../../script.js');
    } catch (err) {
        console.warn(LOG, 'script.js is unavailable, running standalone', err);
    }

    setHost({
        getContext: extensions?.getContext || window.SillyTavern?.getContext || null,
        eventSource: script?.eventSource || null,
        eventTypes: script?.event_types || null,
        userAvatar: script?.user_avatar || null,
    });

    if (extensions?.extension_settings && script?.saveSettingsDebounced) {
        const namespace = 'mylove_graph';
        if (!extensions.extension_settings[namespace]) extensions.extension_settings[namespace] = {};
        return {
            root: extensions.extension_settings[namespace],
            save: script.saveSettingsDebounced,
        };
    }
    return null;
}

/* ------------------------------------------------------------ UI mounting */

function openGraph() {
    setFabVisible(false);
    panel.open();
}

function closeGraph() {
    panel.close();
    setFabVisible(true);
}

function toggleGraph() {
    if (panel.isOpen()) closeGraph();
    else openGraph();
}

/** Adds the entry to the wand (extensions) menu above the message bar. */
function mountWandItem() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;
    if (document.getElementById('mlg_wand_item')) return true;

    const item = el('div.list-group-item.flex-container.flexGap5.mlg-wand-item', {
        id: 'mlg_wand_item',
        tabindex: '0',
        title: 'MyLove Graph',
        // onTap, not onClick: on phones the host can swallow the touch sequence
        // before a click is ever synthesised.
        onTap: () => {
            // Close the wand popup the way ST's own entries do.
            menu.style.display = 'none';
            openGraph();
        },
        onKeydown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                menu.style.display = 'none';
                openGraph();
            }
        },
    }, [
        el('span.mlg-wand-icon', { 'aria-hidden': 'true' }, [icon('heart', 16)]),
        el('span', { text: 'MyLove Graph' }),
    ]);

    item.hidden = !getSettings().ui.wandButton;
    menu.appendChild(item);
    return true;
}

/**
 * ST builds its settings column asynchronously, so retry for a while before
 * giving up on the drawer and the wand entry.
 */
function mountWhenReady() {
    let attempts = 0;
    let settingsDone = false;
    let wandDone = false;

    const tryMount = () => {
        if (!settingsDone) {
            mountSettings(openGraph);
            settingsDone = !!document.querySelector('.mlg-settings');
        }
        if (!wandDone) wandDone = mountWandItem();
        if ((settingsDone && wandDone) || ++attempts > 60) {
            clearInterval(timer);
        }
    };

    const timer = setInterval(tryMount, 500);
    tryMount();
}

/** Registers /mylove, if this ST build exposes a slash command API. */
function registerSlashCommand(context) {
    try {
        const { SlashCommandParser, SlashCommand } = context || {};
        if (SlashCommandParser?.addCommandObject && SlashCommand?.fromProps) {
            SlashCommandParser.addCommandObject(SlashCommand.fromProps({
                name: 'mylove',
                callback: () => {
                    toggleGraph();
                    return '';
                },
                helpString: 'Opens the MyLove Graph relationship map.',
            }));
            return;
        }
        if (typeof context?.registerSlashCommand === 'function') {
            context.registerSlashCommand('mylove', () => {
                toggleGraph();
                return '';
            }, [], 'Opens the MyLove Graph relationship map.', true, true);
        }
    } catch (err) {
        console.warn(LOG, 'slash command registration skipped', err);
    }
}

/* ----------------------------------------------------------- auto syncing */

let syncTimer = 0;

function scheduleAutoSync() {
    if (!getSettings().behaviour.autoSync) return;
    // Only keep an existing board up to date; never populate one the user has
    // not started themselves.
    if (!model.nodes().length) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        try {
            // In story mode with "only souls the story met" on, the cast walks
            // in on its own and a refresh just keeps the board current.
            const story = getSettings().story;
            model.syncCharacters({ addNew: !storyEnabled() || !story.cast });
            if (panel.isOpen()) panel.refresh();
            refreshSettings();
        } catch (err) {
            console.error(LOG, 'auto sync failed', err);
        }
    }, 800);
}

/* --------------------------------------------------------------- chronicle */

/** Wires the story reader to whatever message events this ST build exposes. */
function bindChronicle() {
    const tick = () => chronicle.schedule();
    for (const eventName of [
        'MESSAGE_RECEIVED',
        'MESSAGE_SENT',
        'CHARACTER_MESSAGE_RENDERED',
        'USER_MESSAGE_RENDERED',
        'MESSAGE_EDITED',
        'MESSAGE_DELETED',
        'MESSAGE_SWIPED',
        'GENERATION_ENDED',
    ]) {
        onStEvent(eventName, tick);
    }
    // A new chat is a new story: read it from its first line.
    onStEvent('CHAT_CHANGED', () => chronicle.schedule(900));

    chronicle.onChronicle(result => {
        if (!result) return;
        if (panel.isOpen()) panel.refresh();
        refreshSettings();
    });
}

/* ------------------------------------------------------------------ boot */

async function boot() {
    const bridge = await connectHost();
    initState(bridge);
    setLanguage(getSettings().lang);
    initViewport();

    createFab(toggleGraph);
    updateFab();
    mountWhenReady();

    onStateChange(() => {
        updateFab();
        refreshSettings();
        panel.refresh();
    });

    for (const eventName of ['CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_DUPLICATED', 'CHAT_CHANGED', 'GROUP_UPDATED']) {
        onStEvent(eventName, scheduleAutoSync);
    }
    onStEvent('APP_READY', () => {
        mountWandItem();
        scheduleAutoSync();
        chronicle.schedule(1200);
    });
    bindChronicle();
    // The chat may already be loaded when a build has no APP_READY event.
    chronicle.schedule(1500);

    try {
        const context = (window.SillyTavern?.getContext?.()) || null;
        registerSlashCommand(context);
    } catch (err) {
        console.warn(LOG, 'context unavailable for slash commands', err);
    }

    // The heart steps aside whenever the window is open, however it was closed
    // (button, Escape or the backdrop).
    panel.onVisibility(open => setFabVisible(!open));

    window.MyLoveGraph = {
        open: openGraph,
        close: closeGraph,
        toggle: toggleGraph,
        sync: () => model.syncCharacters(),
        instance: () => panel.instance(),
        export: () => model.exportGraph(),
        settings: getSettings,
        save,
        // The chronicle, for anyone who wants to drive it from a script.
        story: {
            read: () => chronicle.advance(),
            rebuild: done => chronicle.rebuild(done),
            forget: () => chronicle.forget(),
            status: () => chronicle.status(),
        },
    };

    console.log(LOG, 'ready');
}

boot().catch(err => console.error(LOG, 'failed to start', err));
