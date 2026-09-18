/**
 * MyLove Graph - the card inside SillyTavern's extension settings.
 *
 * This is the "main menu": a small poster-styled panel with a breathing heart
 * sigil, the language switch, every appearance toggle, and the two engines that
 * fill the map - the offline chronicle and the model-driven director.
 */

import { el, clear, icon } from './dom.js';
import { t, applyI18n, onLanguageChange, setLanguage, LANGUAGES } from './i18n.js';
import {
    getSettings,
    save,
    animationsEnabled,
    setActiveBoard,
    perChatBoards,
    copyGlobalBoard,
} from './state.js';
import { updateFab, resetFabPosition } from './fab.js';
import { toast } from './host.js';
import * as chronicle from './chronicle.js';
import * as director from './director.js';
import * as llm from './llm.js';
import * as model from './model.js';

let container = null;
let body = null;
let inner = null;
let onOpen = () => {};

function toggleRow(labelKey, get, set) {
    const input = el('input', {
        type: 'checkbox',
        checked: get(),
        onChange: () => {
            set(input.checked);
            save();
        },
    });
    return el('label.mlg-opt', {}, [
        input,
        el('span.mlg-opt-box', { 'aria-hidden': 'true' }),
        el('span.mlg-opt-label', { text: t(labelKey) }),
    ]);
}

function segmented(options, getValue, setValue) {
    const row = el('div.mlg-segment.mlg-segment--sm');
    const buttons = [];
    for (const option of options) {
        const button = el('button.mlg-segment-btn', {
            type: 'button',
            text: option.label,
            title: option.title || '',
            'data-active': String(getValue() === option.value),
            onTap: () => {
                setValue(option.value);
                save();
                buttons.forEach(b => (b.dataset.active = String(b === button)));
            },
        });
        buttons.push(button);
        row.appendChild(button);
    }
    return row;
}

/**
 * A labelled text field. It commits on change (blur or Enter), never on every
 * keystroke: saving re-renders this card, and a card that re-renders under your
 * fingers is a card you cannot type into.
 */
function textRow(labelKey, get, set, { type = 'text', placeholderKey = '', hintKey = '' } = {}) {
    const input = el('input.mlg-input.mlg-input--sm', {
        type,
        value: get() || '',
        placeholder: placeholderKey ? t(placeholderKey) : '',
        autocomplete: 'off',
        spellcheck: false,
        onChange: () => {
            set(input.value.trim());
            save();
        },
    });
    return el('label.mlg-set-field', {}, [
        el('span.mlg-set-label', { text: t(labelKey) }),
        input,
        hintKey ? el('span.mlg-set-note', { text: t(hintKey) }) : null,
    ]);
}

function numberRow(labelKey, get, set, { min = 1, max = 999, step = 1 } = {}) {
    const input = el('input.mlg-input.mlg-input--num', {
        type: 'number',
        value: String(get()),
        min: String(min),
        max: String(max),
        step: String(step),
        onChange: () => {
            const value = Number(input.value);
            if (Number.isFinite(value)) set(Math.min(max, Math.max(min, Math.round(value))));
            save();
        },
    });
    return el('label.mlg-set-field.mlg-set-field--num', {}, [
        el('span.mlg-set-label', { text: t(labelKey) }),
        input,
    ]);
}

function selectRow(labelKey, options, get, set, { hintKey = '', emptyKey = '' } = {}) {
    const select = el('select.mlg-input.mlg-input--sm.mlg-select', {
        onChange: () => {
            set(select.value);
            save();
        },
    });
    if (emptyKey) select.appendChild(el('option', { value: '', text: t(emptyKey) }));
    for (const option of options) {
        const item = el('option', { value: option.value, text: option.label });
        if (option.value === get()) item.selected = true;
        select.appendChild(item);
    }
    if (!options.some(option => option.value === get())) select.value = '';
    return el('label.mlg-set-field', {}, [
        el('span.mlg-set-label', { text: t(labelKey) }),
        select,
        hintKey ? el('span.mlg-set-note', { text: t(hintKey) }) : null,
    ]);
}

/* ------------------------------------------------------------- the sections */

function boardSection(settings) {
    return el('div.mlg-set-group', {}, [
        el('span.mlg-set-title', { text: t('set.scope') }),
        el('p.mlg-set-hint', { text: t('set.scopeHint') }),
        toggleRow('set.scope', () => perChatBoards(), value => {
            settings.behaviour.scope = value ? 'chat' : 'global';
            setActiveBoard();
        }),
        perChatBoards()
            ? el('button.mlg-btn.mlg-btn--ghost.mlg-btn--sm', {
                type: 'button',
                text: t('set.copyBoard'),
                onTap: () => {
                    if (!window.confirm(t('confirm.copyBoard'))) return;
                    const copied = copyGlobalBoard();
                    toast(t('toast.copied', { nodes: copied.nodes, edges: copied.edges }));
                    refreshSettings();
                },
            })
            : null,
    ]);
}

/** Where the director sends its requests - the heart of this whole section. */
function sourceControls(ai) {
    if (ai.source === 'profile') {
        const profiles = llm.connectionProfiles();
        if (!llm.profilesSupported() || !profiles.length) {
            return el('p.mlg-set-warn', { text: t('ai.noProfiles') });
        }
        return el('div.mlg-set-stack', {}, [
            selectRow(
                'ai.profile',
                profiles.map(profile => ({
                    value: profile.id,
                    label: profile.model ? `${profile.name} · ${profile.model}` : profile.name,
                })),
                () => ai.profileId,
                value => (ai.profileId = value),
                { hintKey: 'ai.profileHint', emptyKey: 'ai.profilePick' },
            ),
            toggleRow('ai.usePreset', () => ai.usePreset, value => (ai.usePreset = value)),
        ]);
    }

    if (ai.source === 'custom') {
        return el('div.mlg-set-stack', {}, [
            textRow('ai.url', () => ai.custom.url, value => (ai.custom.url = value), {
                type: 'url',
                placeholderKey: 'ai.urlPh',
            }),
            textRow('ai.model', () => ai.custom.model, value => (ai.custom.model = value), {
                placeholderKey: 'ai.modelPh',
            }),
            textRow('ai.key', () => ai.custom.key, value => (ai.custom.key = value), {
                type: 'password',
                placeholderKey: 'ai.keyPh',
            }),
            el('p.mlg-set-note', { text: t('ai.customHint') }),
        ]);
    }

    return el('p.mlg-set-note', { text: t('ai.sourceHint') });
}

function directorSection(settings) {
    const ai = settings.ai;
    const state = director.status();
    const ready = llm.readiness();

    const busyLabel = state.busy ? t('ai.reading') : '';

    return el('div.mlg-set-group.mlg-set-group--ai', {}, [
        el('span.mlg-set-title', {}, [
            el('span.mlg-set-spark', { 'aria-hidden': 'true' }, [icon('spark', 13)]),
            ' ' + t('set.ai'),
        ]),
        el('p.mlg-set-hint', { text: t('ai.hint') }),

        toggleRow('ai.enable', () => ai.enabled, value => {
            ai.enabled = value;
            if (value) director.schedule(600);
        }),

        el('span.mlg-set-subtitle', { text: t('ai.source') }),
        segmented(
            [
                { value: 'main', label: t('ai.source.main') },
                { value: 'profile', label: t('ai.source.profile') },
                { value: 'custom', label: t('ai.source.custom') },
            ],
            () => ai.source,
            value => {
                ai.source = value;
                // The save that follows re-renders this card; doing it here
                // would tear the card down mid-click.
                setTimeout(refreshSettings, 0);
            },
        ),
        sourceControls(ai),

        el('p.mlg-set-stat', {
            'data-tone': ready.ok ? '' : 'warn',
            text: ready.ok
                ? t('ai.target', { target: llm.targetLabel() })
                : t('ai.failed', { error: t('ai.reason.' + ready.reason) }),
        }),
        busyLabel ? el('p.mlg-set-stat', { text: busyLabel }) : null,
        state.error ? el('p.mlg-set-warn', { text: t('ai.failed', { error: state.error }) }) : null,

        toggleRow('ai.auto', () => ai.auto, value => (ai.auto = value)),
        el('div.mlg-set-nums', {}, [
            numberRow('ai.every', () => ai.every, value => (ai.every = value), { min: 1, max: 100 }),
            numberRow('ai.window', () => ai.window, value => (ai.window = value), { min: 4, max: 200 }),
            numberRow('ai.depth', () => ai.depth, value => (ai.depth = value), { min: 20, max: 2000, step: 10 }),
            numberRow('ai.maxTokens', () => ai.maxTokens, value => (ai.maxTokens = value), { min: 128, max: 4000, step: 32 }),
            numberRow('ai.maxNew', () => ai.maxNew, value => (ai.maxNew = value), { min: 1, max: 20 }),
        ]),

        el('span.mlg-set-subtitle', { text: t('ai.writes') }),
        toggleRow('ai.newSouls', () => ai.newSouls, value => (ai.newSouls = value)),
        toggleRow('ai.newBonds', () => ai.newBonds, value => (ai.newBonds = value)),
        toggleRow('ai.profiles', () => ai.profiles, value => (ai.profiles = value)),

        el('span.mlg-set-subtitle', { text: t('ai.lang') }),
        segmented(
            [
                { value: 'auto', label: t('ai.lang.auto') },
                ...LANGUAGES.map(lang => ({ value: lang.id, label: lang.short })),
            ],
            () => ai.lang,
            value => (ai.lang = value),
        ),

        el('p.mlg-set-stat', {
            text: t('ai.stats', {
                read: state.analyzed,
                total: state.total,
                runs: state.runs,
                souls: state.souls,
                bonds: state.bonds,
            }),
        }),

        el('div.mlg-set-actions', {}, [
            el('button.mlg-btn.mlg-btn--ghost.mlg-btn--sm', {
                type: 'button',
                text: t('ai.test'),
                disabled: state.busy,
                onTap: async () => {
                    toast(t('ai.testing'));
                    try {
                        await director.test();
                        toast(t('ai.testOk', { target: llm.targetLabel() }), 'success');
                    } catch (err) {
                        toast(t('ai.testFail', { error: String(err?.message || err) }), 'error');
                    }
                    refreshSettings();
                },
            }),
            el('button.mlg-btn.mlg-btn--primary.mlg-btn--sm', {
                type: 'button',
                text: t('ai.analyze'),
                disabled: state.busy || !ready.ok,
                onTap: () => runAnalyze(),
            }),
            el('button.mlg-btn.mlg-btn--ghost.mlg-btn--sm', {
                type: 'button',
                text: t('ai.rebuild'),
                disabled: state.busy || !ready.ok,
                onTap: () => runRebuild(),
            }),
            el('button.mlg-btn.mlg-btn--danger.mlg-btn--sm', {
                type: 'button',
                text: t('ai.forget'),
                onTap: () => {
                    if (!window.confirm(t('ai.confirmForget'))) return;
                    director.forget();
                    refreshSettings();
                },
            }),
        ]),
    ]);
}

/* ------------------------------------------------------------- the actions */

async function runAnalyze() {
    toast(t('ai.reading'));
    try {
        const result = await director.analyze();
        toast(result
            ? t('ai.done', { souls: result.souls, bonds: result.bonds, changed: result.changed })
            : t('ai.nothing'));
    } catch (err) {
        toast(t('ai.failed', { error: String(err?.message || err) }), 'error');
    }
    refreshSettings();
}

async function runRebuild() {
    const state = director.status();
    const ai = getSettings().ai;
    const passes = Math.max(1, Math.ceil(Math.min(state.total, ai.depth) / Math.max(4, ai.window)));
    if (!window.confirm(t('ai.confirmRebuild', { n: passes }))) return;
    try {
        const result = await director.rebuild(progress => {
            toast(t('ai.rebuilding', { done: progress.done + 1, of: progress.of }));
        });
        toast(t('ai.done', { souls: result.souls, bonds: result.bonds, changed: result.changed }));
    } catch (err) {
        toast(t('ai.failed', { error: String(err?.message || err) }), 'error');
    }
    refreshSettings();
}

/* -------------------------------------------------------------- the render */

function renderBody() {
    if (!inner) return;
    const body = inner;
    clear(body);
    const settings = getSettings();

    const sigil = el('div.mlg-card-sigil', { 'aria-hidden': 'true' }, [
        el('span.mlg-card-halo'),
        icon('heart', 30),
    ]);

    body.appendChild(el('div.mlg-card', {}, [
        el('span.mlg-corner.tl'), el('span.mlg-corner.tr'),
        el('span.mlg-corner.bl'), el('span.mlg-corner.br'),
        el('div.mlg-card-main', {}, [
            sigil,
            el('div.mlg-card-text', {}, [
                el('span.mlg-kicker', { text: t('panel.kicker') }),
                el('h3.mlg-card-title', {}, [
                    el('span.mlg-title-my', { text: 'MyLove' }),
                    el('span.mlg-title-graph', { text: 'Graph' }),
                ]),
                el('p.mlg-card-tagline', { text: t('panel.tagline') }),
            ]),
        ]),
        el('p.mlg-card-hint', { text: t('set.hint') }),
        el('div.mlg-card-stats', {}, [
            el('span.mlg-card-stat', { text: t('set.stats', { nodes: model.nodes().length, edges: model.edges().length }) }),
            el('span.mlg-card-board', { text: t(perChatBoards() ? 'board.chat' : 'board.global') }),
            el('span.mlg-card-bars', { 'aria-hidden': 'true' }),
        ]),
        el('button.mlg-btn.mlg-btn--primary.mlg-card-open', {
            type: 'button',
            text: t('set.open'),
            onTap: () => onOpen(),
        }),
    ]));

    body.appendChild(el('div.mlg-set-group', {}, [
        el('span.mlg-set-title', { text: t('set.lang') }),
        segmented(
            LANGUAGES.map(lang => ({ value: lang.id, label: lang.label })),
            () => settings.lang,
            value => {
                settings.lang = value;
                setLanguage(value);
            },
        ),
    ]));

    body.appendChild(el('div.mlg-set-group', {}, [
        el('span.mlg-set-title', { text: t('set.appearance') }),
        toggleRow('set.fab', () => settings.ui.floatingButton, v => {
            settings.ui.floatingButton = v;
            updateFab();
        }),
        toggleRow('set.wand', () => settings.ui.wandButton, v => {
            settings.ui.wandButton = v;
            document.querySelectorAll('.mlg-wand-item').forEach(item => {
                item.hidden = !v;
            });
        }),
        toggleRow('set.anim', () => settings.ui.animations, v => {
            settings.ui.animations = v;
            updateFab();
        }),
        toggleRow('set.labels', () => settings.ui.labels, v => (settings.ui.labels = v)),
        toggleRow('set.avatars', () => settings.ui.avatars, v => (settings.ui.avatars = v)),
        toggleRow('set.curved', () => settings.ui.curved, v => (settings.ui.curved = v)),
        toggleRow('set.autosync', () => settings.behaviour.autoSync, v => (settings.behaviour.autoSync = v)),
    ]));

    body.appendChild(boardSection(settings));
    body.appendChild(directorSection(settings));

    const state = chronicle.status();
    body.appendChild(el('div.mlg-set-group', {}, [
        el('span.mlg-set-title', { text: t('set.story') }),
        el('p.mlg-set-hint', { text: t('set.storyHint') }),
        toggleRow('set.storyMode', () => settings.story.enabled, v => {
            settings.story.enabled = v;
            if (v) chronicle.advance();
        }),
        el('p.mlg-set-stat', {
            text: t('set.storyStats', {
                read: state.applied,
                total: state.total,
                chapter: state.chapter,
                sparks: state.sparks,
                settled: state.settled,
            }),
        }),
        toggleRow('set.storyCast', () => settings.story.cast, v => (settings.story.cast = v)),
        toggleRow('set.storyMentions', () => settings.story.mentions, v => (settings.story.mentions = v)),
        toggleRow('set.storyFade', () => settings.story.fade, v => (settings.story.fade = v)),
        el('span.mlg-set-subtitle', { text: t('set.storyPace') }),
        segmented(
            [
                { value: 'gentle', label: t('story.pace.gentle') },
                { value: 'normal', label: t('story.pace.normal') },
                { value: 'fast', label: t('story.pace.fast') },
            ],
            () => settings.story.pace,
            value => (settings.story.pace = value),
        ),
        el('div.mlg-set-actions', {}, [
            el('button.mlg-btn.mlg-btn--ghost.mlg-btn--sm', {
                type: 'button',
                text: t('set.storyRebuild'),
                disabled: state.busy,
                onTap: () => {
                    toast(t('story.rebuilding'));
                    chronicle.rebuild(result => {
                        toast(t('story.rebuilt', { bonds: result.revealed, souls: result.added }));
                        refreshSettings();
                    });
                },
            }),
            el('button.mlg-btn.mlg-btn--danger.mlg-btn--sm', {
                type: 'button',
                text: t('set.storyForget'),
                onTap: () => {
                    if (!window.confirm(t('confirm.forget'))) return;
                    chronicle.forget();
                    refreshSettings();
                },
            }),
        ]),
    ]));

    body.appendChild(el('div.mlg-set-group', {}, [
        el('span.mlg-set-title', { text: t('set.lite') }),
        segmented(
            [
                { value: 'auto', label: t('set.lite.auto') },
                { value: 'on', label: t('set.lite.on') },
                { value: 'off', label: t('set.lite.off') },
            ],
            () => settings.ui.lite,
            value => {
                settings.ui.lite = value;
                updateFab();
            },
        ),
        el('p.mlg-set-hint', { text: t('set.liteHint') }),
        el('button.mlg-btn.mlg-btn--ghost.mlg-btn--sm', {
            type: 'button',
            text: t('set.resetPos'),
            onTap: () => resetFabPosition(),
        }),
    ]));

    body.classList.toggle('mlg-no-anim', !animationsEnabled());
}

/** Mounts the drawer into ST's extension settings column. */
export function mountSettings(openHandler) {
    onOpen = openHandler;
    const host = document.getElementById('extensions_settings2')
        || document.getElementById('extensions_settings');
    if (!host || container) return;

    // ST toggles .inline-drawer-content with an inline display style, so all of
    // our own layout lives on a wrapper inside it.
    inner = el('div.mlg-root.mlg-settings-inner');
    body = el('div.inline-drawer-content', {}, [inner]);

    const chevron = el('div.inline-drawer-icon.fa-solid.fa-circle-chevron-down.down');
    const header = el('div.inline-drawer-toggle.inline-drawer-header', {
        onTap: () => ensureDrawerToggles(body, chevron),
    }, [
        el('b', {}, [
            el('span.mlg-drawer-heart', { 'aria-hidden': 'true' }, [icon('heart', 14)]),
            ' MyLove Graph',
        ]),
        chevron,
    ]);

    container = el('div.mlg-settings.inline-drawer', {}, [header, body]);

    host.appendChild(container);
    renderBody();
    applyI18n(container);

    onLanguageChange(() => {
        renderBody();
        applyI18n(container);
    });
}

/**
 * ST opens these drawers itself, through a delegated handler on
 * `.inline-drawer-toggle`. Not every build has that handler wired by the time a
 * third-party extension mounts - and when it is missing, the card simply never
 * opens. So: give ST a moment, and take over only if nothing happened.
 */
function ensureDrawerToggles(content, chevron) {
    const before = content.style.display;
    setTimeout(() => {
        const handled = content.style.display !== before
            || content.style.height
            || content.style.overflow;
        if (handled) return;
        const open = before === 'none' || before === '';
        content.style.display = open ? 'block' : 'none';
        chevron.classList.toggle('down', !open);
        chevron.classList.toggle('up', open);
    }, 90);
}

/** Re-renders the stats and control states (after a sync, for instance). */
export function refreshSettings() {
    if (!container) return;
    // Never yank an input out from under the person typing in it.
    const active = document.activeElement;
    if (active && container.contains(active) && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;
    renderBody();
    applyI18n(container);
}
