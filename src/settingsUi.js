/**
 * MyLove Graph - the card inside SillyTavern's extension settings.
 *
 * This is the "main menu": a small poster-styled panel with a breathing heart
 * sigil, the language switch and every appearance toggle.
 */

import { el, clear, icon } from './dom.js';
import { t, applyI18n, onLanguageChange, setLanguage, LANGUAGES } from './i18n.js';
import { getSettings, save, animationsEnabled } from './state.js';
import { updateFab, resetFabPosition } from './fab.js';
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
            'data-active': String(getValue() === option.value),
            onClick: () => {
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
            el('span.mlg-card-bars', { 'aria-hidden': 'true' }),
        ]),
        el('button.mlg-btn.mlg-btn--primary.mlg-card-open', {
            type: 'button',
            text: t('set.open'),
            onClick: () => onOpen(),
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
            onClick: () => resetFabPosition(),
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

    container = el('div.mlg-settings.inline-drawer', {}, [
        el('div.inline-drawer-toggle.inline-drawer-header', {}, [
            el('b', {}, [
                el('span.mlg-drawer-heart', { 'aria-hidden': 'true' }, [icon('heart', 14)]),
                ' MyLove Graph',
            ]),
            el('div.inline-drawer-icon.fa-solid.fa-circle-chevron-down.down'),
        ]),
        body,
    ]);

    host.appendChild(container);
    renderBody();
    applyI18n(container);

    onLanguageChange(() => {
        renderBody();
        applyI18n(container);
    });
}

/** Re-renders the stats and control states (after a sync, for instance). */
export function refreshSettings() {
    if (container) renderBody();
}
