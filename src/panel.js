/**
 * MyLove Graph - the graph window: toolbar, stage, inspector and editors.
 */

import { el, clear, icon } from './dom.js';
import { t, applyI18n, onLanguageChange, setLanguage, getLanguage, LANGUAGES } from './i18n.js';
import {
    getSettings,
    save,
    isLite,
    animationsEnabled,
    isTouchDevice,
    storyEnabled,
} from './state.js';
import { LoveGraph } from './graph.js';
import { groups } from './host.js';
import { viewportRect } from './viewport.js';
import * as chronicle from './chronicle.js';
import * as director from './director.js';
import * as llm from './llm.js';
import * as model from './model.js';

let root = null;
let graph = null;
let stage = null;
let inspector = null;
let basis = null;
let legend = null;
let emptyState = null;
let searchBox = null;
let searchResults = null;
let toastLayer = null;
let modalLayer = null;
let menuLayer = null;
let openMenuEl = null;
let observer = null;
let selection = null;
let opened = false;
let didFirstSync = false;
let visibilityHandler = () => {};

const MOBILE_MENU_WIDTH = 560;

/* --------------------------------------------------------------- building */

function buildToolbarButton(name, key, handler, extraClass = '') {
    const button = el('button.mlg-tool' + (extraClass ? '.' + extraClass : ''), {
        type: 'button',
        'data-i18n-title': key,
        // The handler is given the button itself: a tap that lands on the inner
        // SVG reports the icon as its target, and menus must hang off the button.
        onTap: () => handler(button),
    }, [icon(name)]);
    return button;
}

function build() {
    const scrim = el('div.mlg-scrim', { onTap: () => close() });

    const head = el('header.mlg-head', {}, [
        el('div.mlg-head-lead', {}, [
            el('span.mlg-kicker', { 'data-i18n': 'panel.kicker' }),
            el('h2.mlg-title', {}, [
                el('span.mlg-title-my', { text: 'MyLove' }),
                el('span.mlg-title-graph', { text: 'Graph' }),
            ]),
            el('p.mlg-tagline', { 'data-i18n': 'panel.tagline' }),
        ]),
        el('div.mlg-head-tail', {}, [
            el('div.mlg-sigil', { 'aria-hidden': 'true' }, [icon('heartArrow', 26)]),
            el('button.mlg-icon-btn.mlg-close', {
                type: 'button',
                'data-i18n-title': 'panel.close',
                onTap: () => close(),
            }, [icon('close', 18)]),
        ]),
    ]);

    searchResults = el('div.mlg-search-results', { hidden: true });
    searchBox = el('input.mlg-search-input', {
        type: 'search',
        'data-i18n-ph': 'search.ph',
        autocomplete: 'off',
        onInput: () => renderSearch(),
        onFocus: () => renderSearch(),
        onKeydown: e => {
            if (e.key === 'Escape') {
                searchBox.value = '';
                searchResults.hidden = true;
                searchBox.blur();
            }
        },
    });

    const toolbar = el('nav.mlg-toolbar', {}, [
        el('div.mlg-tool-group', {}, [
            buildToolbarButton('sync', 'tb.sync', () => doSync()),
            buildToolbarButton('plus', 'tb.add', anchor => openAddMenu(anchor)),
            buildToolbarButton('link', 'tb.link', () => openEdgeEditor({})),
            buildToolbarButton('story', 'tb.story', anchor => openStoryMenu(anchor), 'mlg-tool--story'),
            buildToolbarButton('spark', 'tb.ai', anchor => openDirectorMenu(anchor), 'mlg-tool--ai'),
        ]),
        el('div.mlg-search', {}, [
            icon('search', 15),
            searchBox,
            searchResults,
        ]),
        el('div.mlg-tool-group', {}, [
            buildToolbarButton('fit', 'tb.fit', () => graph?.fit()),
            buildToolbarButton('shuffle', 'tb.relayout', () => graph?.relayout()),
            buildToolbarButton('filter', 'tb.filters', anchor => openFilterMenu(anchor)),
            buildToolbarButton('data', 'tb.data', anchor => openDataMenu(anchor)),
            buildToolbarButton('globe', 'tb.lang', anchor => openLanguageMenu(anchor)),
        ]),
    ]);

    const canvas = el('canvas.mlg-canvas');
    legend = el('div.mlg-legend');
    basis = el('div.mlg-basis');
    emptyState = el('div.mlg-empty', { hidden: true });

    stage = el('div.mlg-stage', {}, [
        canvas,
        legend,
        basis,
        emptyState,
        el('div.mlg-zoom', {}, [
            el('button.mlg-icon-btn', { type: 'button', 'aria-label': '+', onTap: () => graph?.zoomBy(1.25) }, [icon('zoomIn', 16)]),
            el('button.mlg-icon-btn', { type: 'button', 'aria-label': '-', onTap: () => graph?.zoomBy(0.8) }, [icon('zoomOut', 16)]),
        ]),
        el('div.mlg-stamp', { 'aria-hidden': 'true' }, [
            el('span.mlg-stamp-code', { text: '404-G' }),
            el('span.mlg-stamp-bars'),
        ]),
    ]);

    inspector = el('aside.mlg-inspector', { 'data-open': 'false' });
    toastLayer = el('div.mlg-toasts', { 'aria-live': 'polite' });
    modalLayer = el('div.mlg-modal-layer');
    menuLayer = el('div.mlg-menu-layer');

    const windowEl = el('section.mlg-window', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'MyLove Graph' }, [
        el('span.mlg-corner.tl'), el('span.mlg-corner.tr'),
        el('span.mlg-corner.bl'), el('span.mlg-corner.br'),
        head,
        toolbar,
        el('div.mlg-body', {}, [stage, inspector]),
        toastLayer,
        modalLayer,
    ]);

    root = el('div.mlg-root.mlg-overlay', { hidden: true }, [scrim, windowEl, menuLayer]);
    document.body.appendChild(root);

    graph = new LoveGraph(canvas, {
        onSelect: sel => {
            selection = sel;
            renderInspector();
            renderBasis();
        },
        onOpen: sel => {
            if (sel.type === 'node') openNodeEditor(model.findNode(sel.id));
            else openEdgeEditor({ edge: model.edges().find(e => e.id === sel.id) });
        },
        onPositions: () => model.persistPositions(),
    });

    observer = new ResizeObserver(() => graph?.resize());
    observer.observe(stage);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) graph?.stop();
        else if (opened) graph?.requestRender();
    });

    onLanguageChange(() => {
        applyI18n(root);
        renderAll();
    });

    applyI18n(root);
    renderLegend();
}

function onKeyDown(event) {
    if (!opened) return;
    if (event.key === 'Escape') {
        if (openMenuEl) {
            closeMenu();
            event.stopPropagation();
            return;
        }
        const modal = modalLayer.lastElementChild;
        if (modal) {
            modal.remove();
            event.stopPropagation();
            return;
        }
        close();
    }
}

function onDocumentPointerDown(event) {
    if (openMenuEl && !openMenuEl.contains(event.target) && !openMenuEl.anchor?.contains(event.target)) {
        closeMenu();
    }
    if (searchResults && !searchResults.hidden) {
        const wrap = searchBox.closest('.mlg-search');
        if (wrap && !wrap.contains(event.target)) searchResults.hidden = true;
    }
}

/* ------------------------------------------------------------ open / close */

export function isOpen() {
    return opened;
}

/** The live canvas engine - exposed for debugging and power users. */
export function instance() {
    return graph;
}

/** Lets the host react when the window opens or closes by any route. */
export function onVisibility(handler) {
    visibilityHandler = handler || (() => {});
}

export function open() {
    if (!root) build();
    if (opened) return;
    opened = true;
    root.hidden = false;
    document.documentElement.classList.add('mlg-open');
    visibilityHandler(true);
    requestAnimationFrame(() => {
        root.classList.add('mlg-visible');
        graph.resize();
        syncGraph();
        if (!didFirstSync) {
            didFirstSync = true;
            const settings = getSettings();
            // The whole card list is only dumped on the board when nothing
            // else is filling it in from the chat.
            const wantsWholeCast = !settings.ai.enabled && (!storyEnabled() || !settings.story.cast);
            if (wantsWholeCast && !model.nodes().length && settings.behaviour.autoSync) {
                doSync(true);
            }
            if (storyEnabled()) {
                // Story mode fills the board from the chat, not from the card
                // list: whoever has shown up so far, and nobody else.
                chronicle.advance(() => {
                    syncGraph();
                    graph.fit();
                });
            }
            graph.alpha = 1;
            graph.autoFitOnSettle = true;
        }
        graph.fit();
        // If the layout is still moving, fit again once it comes to rest.
        if (graph.alpha > 0) graph.autoFitOnSettle = true;
        graph.requestRender();
    });
}

export function close() {
    if (!opened) return;
    opened = false;
    closeMenu();
    visibilityHandler(false);
    root.classList.remove('mlg-visible');
    document.documentElement.classList.remove('mlg-open');
    graph?.stop();
    setTimeout(() => {
        if (!opened) root.hidden = true;
    }, 220);
}

export function toggle() {
    if (opened) close();
    else open();
}

/**
 * The chat changed under us, so this is a different board now: drop the
 * selection that belonged to the old one and redraw from scratch.
 */
export function rebind() {
    if (!root) return;
    selection = null;
    graph?.select(null, false);
    syncGraph();
    if (opened) {
        graph?.kick(0.6);
        graph?.fit();
    }
}

/** Called when settings change outside the panel. */
export function refresh() {
    if (!root) return;
    setLanguage(getSettings().lang);
    applyI18n(root);
    syncGraph();
}

/* ----------------------------------------------------------------- syncing */

function syncGraph() {
    if (!graph) return;
    const settings = getSettings();
    graph.setOptions({
        labels: settings.ui.labels,
        avatars: settings.ui.avatars,
        curved: settings.ui.curved,
        animations: animationsEnabled(),
        lite: isLite(),
        filters: { ...settings.filters },
    });
    graph.sync(model.nodes(), model.edges());
    if (selection && !selectionExists(selection)) {
        selection = null;
        graph.select(null, false);
    }
    renderAll();
}

function selectionExists(sel) {
    if (!sel) return false;
    if (sel.type === 'node') return !!model.findNode(sel.id);
    return model.edges().some(e => e.id === sel.id);
}

function renderAll() {
    renderLegend();
    renderBasis();
    renderInspector();
    renderEmpty();
    // Only refresh the search dropdown when it is already open, so redraws
    // never make it pop up on their own.
    if (searchResults && !searchResults.hidden) renderSearch();
}

/* ------------------------------------------------------------------ legend */

function renderLegend() {
    if (!legend) return;
    clear(legend);
    const settings = getSettings();
    legend.appendChild(el('span.mlg-legend-title', { text: t('legend.title') }));
    for (const type of model.REL_TYPES) {
        const meta = model.REL_META[type];
        const active = settings.filters[type] !== false;
        legend.appendChild(el('button.mlg-legend-item', {
            type: 'button',
            'data-active': String(active),
            title: t('rel.' + type),
            onTap: () => {
                settings.filters[type] = !active;
                save();
                syncGraph();
            },
        }, [
            el('span.mlg-legend-swatch', { style: { '--mlg-swatch': meta.color } }),
            el('span.mlg-legend-label', { text: t('rel.' + type + '.short') }),
        ]));
    }
}

/* ------------------------------------------------------------- BASIS meters */

function meterRow(labelKey, value, tone) {
    const cells = 20;
    const filled = Math.round((value / 100) * cells);
    const bar = el('span.mlg-meter-bar', { 'data-tone': tone });
    for (let i = 0; i < cells; i++) {
        bar.appendChild(el('i', { 'data-on': String(i < filled) }));
    }
    return el('div.mlg-meter', {}, [
        el('span.mlg-meter-label', { text: t(labelKey) }),
        bar,
        el('span.mlg-meter-value', { text: String(value) }),
    ]);
}

function renderBasis() {
    if (!basis) return;
    clear(basis);

    const nodes = model.nodes();
    const edges = model.edges();

    // Nothing on the board yet: the meters would all read zero and there is
    // nobody to pick, so the panel keeps only what still means something - how
    // far each engine has read - and steps aside entirely when neither has
    // anything to say. The empty state needs that room for its own text.
    if (!nodes.length) {
        renderChronicle();
        renderDirectorStrip();
        const bare = !basis.childElementCount;
        basis.hidden = bare;
        basis.dataset.slim = String(!bare);
        if (stage) stage.dataset.hud = bare ? 'none' : 'slim';
        return;
    }
    basis.hidden = false;
    basis.dataset.slim = 'false';
    if (stage) stage.dataset.hud = 'full';

    let title = t('hud.pick');
    let metrics = { affection: 0, devotion: 0, tension: 0 };

    if (selection?.type === 'node') {
        const node = model.findNode(selection.id);
        if (node) {
            title = node.name;
            metrics = model.nodeMetrics(node.id);
        }
    } else if (nodes.length) {
        // No selection: show the average temperature of the whole board.
        const totals = nodes.reduce((acc, n) => {
            const m = model.nodeMetrics(n.id);
            acc.affection += m.affection;
            acc.devotion += m.devotion;
            acc.tension += m.tension;
            return acc;
        }, { affection: 0, devotion: 0, tension: 0 });
        metrics = {
            affection: Math.round(totals.affection / nodes.length),
            devotion: Math.round(totals.devotion / nodes.length),
            tension: Math.round(totals.tension / nodes.length),
        };
    }

    basis.appendChild(el('div.mlg-basis-head', {}, [
        el('span.mlg-basis-tag', { text: t('hud.basis') }),
        el('span.mlg-basis-name', { text: title }),
    ]));
    basis.appendChild(el('div.mlg-basis-meters', {}, [
        meterRow('hud.affection', metrics.affection, 'love'),
        meterRow('hud.devotion', metrics.devotion, 'close'),
        meterRow('hud.tension', metrics.tension, 'tense'),
    ]));
    basis.appendChild(el('div.mlg-basis-foot', {}, [
        el('span', { text: `${nodes.length} ${t('hud.souls')}` }),
        el('span.mlg-basis-dot'),
        el('span', { text: `${edges.length} ${t('hud.bonds')}` }),
        el('span.mlg-basis-hz', { text: '528 HZ' }),
    ]));

    renderChronicle();
    renderDirectorStrip();
}

/**
 * The chronicle strip: how far the story has been read, and how much of the map
 * it has drawn so far.
 */
function renderChronicle() {
    if (!basis || !storyEnabled()) return;
    const state = chronicle.status();
    const ratio = state.total ? Math.min(1, state.applied / state.total) : 0;

    basis.appendChild(el('div.mlg-chronicle', {}, [
        el('div.mlg-chronicle-head', {}, [
            el('span.mlg-chronicle-tag', { text: t('hud.chronicle') }),
            el('span.mlg-chronicle-chapter', { text: t('hud.chapter', { n: state.chapter }) }),
            el('span.mlg-chronicle-count', { text: `${state.applied}/${state.total}` }),
        ]),
        el('div.mlg-chronicle-line', {}, [
            el('i', { style: { width: Math.round(ratio * 100) + '%' } }),
        ]),
        el('div.mlg-chronicle-foot', {}, [
            el('span', { text: t('hud.sparks', { n: state.sparks }) }),
            el('span.mlg-basis-dot'),
            el('span', { text: t('hud.settled', { n: state.settled }) }),
            state.busy ? el('span.mlg-chronicle-busy', { text: t('story.reading') }) : null,
        ]),
    ]));
}

/**
 * The director strip: which model is writing this map, how far it has read and
 * how much of the board is its work.
 */
function renderDirectorStrip() {
    if (!basis || !getSettings().ai.enabled) return;
    const state = director.status();
    const ratio = state.total ? Math.min(1, state.analyzed / state.total) : 0;

    basis.appendChild(el('div.mlg-chronicle.mlg-chronicle--ai', {
        onTap: () => openStoryLog(),
        title: t('ai.log'),
    }, [
        el('div.mlg-chronicle-head', {}, [
            el('span.mlg-chronicle-tag', {}, [icon('spark', 11), ' ' + t('hud.director')]),
            el('span.mlg-chronicle-count', { text: `${state.analyzed}/${state.total}` }),
        ]),
        el('div.mlg-chronicle-line', {}, [
            el('i', { style: { width: Math.round(ratio * 100) + '%' } }),
        ]),
        el('div.mlg-chronicle-foot', {}, [
            el('span', { text: t('hud.aiSouls', { n: state.souls }) }),
            el('span.mlg-basis-dot'),
            el('span', { text: t('hud.aiPending', { n: state.pending }) }),
            state.busy ? el('span.mlg-chronicle-busy', { text: t('ai.reading') }) : null,
        ]),
        state.error ? el('div.mlg-chronicle-warn', { text: state.error }) : null,
    ]));
}

/* ------------------------------------------------------------ empty state */

function renderEmpty() {
    if (!emptyState) return;
    const isEmpty = model.nodes().length === 0;
    emptyState.hidden = !isEmpty;
    if (!isEmpty) return;
    const story = storyEnabled();
    clear(emptyState);
    emptyState.appendChild(el('div.mlg-empty-heart', {}, [icon('heart', 44)]));
    emptyState.appendChild(el('h3', { text: t(story ? 'empty.story.title' : 'empty.title') }));
    emptyState.appendChild(el('p', { text: t(story ? 'empty.story.body' : 'empty.body') }));
    emptyState.appendChild(el('div.mlg-empty-actions', {}, [
        getSettings().ai.enabled && llm.readiness().ok ? el('button.mlg-btn.mlg-btn--primary', {
            type: 'button',
            text: t('empty.ai.cta'),
            onTap: () => runDirectorPass(),
        }) : null,
        story ? el('button.mlg-btn' + (getSettings().ai.enabled ? '.mlg-btn--ghost' : '.mlg-btn--primary'), {
            type: 'button',
            text: t('empty.story.cta'),
            onTap: () => {
                showToast(t('story.rebuilding'));
                chronicle.rebuild(result => {
                    syncGraph();
                    showToast(t('story.rebuilt', { bonds: result.revealed, souls: result.added }));
                });
            },
        }) : null,
        el('button.mlg-btn' + (story ? '.mlg-btn--ghost' : '.mlg-btn--primary'), {
            type: 'button',
            text: t('empty.cta'),
            onTap: () => doSync(),
        }),
    ]));
}

/* -------------------------------------------------------------- inspector */

function avatarChip(node, size = 34) {
    const sources = model.avatarSources(node);
    const wrap = el('span.mlg-avatar', {
        style: { width: size + 'px', height: size + 'px', '--mlg-accent': accentOf(node) },
    });
    if (sources.length) {
        let index = 0;
        const img = el('img', {
            alt: '',
            loading: 'lazy',
            src: sources[0],
            onError: () => {
                index++;
                if (index < sources.length) img.src = sources[index];
                else img.replaceWith(el('span.mlg-avatar-initials', { text: initials(node.name) }));
            },
        });
        wrap.appendChild(img);
    } else {
        wrap.appendChild(el('span.mlg-avatar-initials', { text: initials(node.name) }));
    }
    return wrap;
}

function initials(name) {
    return (name || '?').trim().slice(0, 2).toUpperCase();
}

function accentOf(node) {
    if (node.color) return node.color;
    const type = model.dominantType(node.id);
    return type ? model.REL_META[type].color : '#ff8ac4';
}

function renderInspector() {
    if (!inspector) return;
    clear(inspector);

    if (!selection) {
        inspector.dataset.open = 'false';
        return;
    }
    inspector.dataset.open = 'true';

    inspector.appendChild(el('button.mlg-inspector-close', {
        type: 'button',
        'data-i18n-title': 'insp.close',
        title: t('insp.close'),
        onTap: () => {
            selection = null;
            graph.select(null, false);
            renderInspector();
            renderBasis();
        },
    }, [icon('close', 16)]));

    if (selection.type === 'node') renderNodeInspector(model.findNode(selection.id));
    else renderEdgeInspector(model.edges().find(e => e.id === selection.id));
}

function renderNodeInspector(node) {
    if (!node) return;

    inspector.appendChild(el('div.mlg-insp-head', {}, [
        avatarChip(node, 54),
        el('div.mlg-insp-id', {}, [
            el('h3.mlg-insp-name', { text: node.name }),
            el('div.mlg-insp-tags', {}, [
                el('span.mlg-tag', { text: t('insp.kind.' + node.kind) }),
                node.role ? el('span.mlg-tag.mlg-tag--soft', { text: node.role }) : null,
                node.origin === 'ai' ? el('span.mlg-tag.mlg-tag--ai', { text: t('insp.byAi') }) : null,
                (node.origin === 'story' || node.origin === 'ai') && typeof node.seen === 'number'
                    ? el('span.mlg-tag.mlg-tag--story', { text: t('insp.enteredAt', { n: node.seen + 1 }) })
                    : null,
                node.missing ? el('span.mlg-tag.mlg-tag--warn', { text: t('insp.missing') }) : null,
            ]),
        ]),
    ]));

    if (node.note) {
        inspector.appendChild(el('p.mlg-insp-note', { text: node.note }));
    }

    renderProfile(node);

    inspector.appendChild(el('div.mlg-insp-actions', {}, [
        el('button.mlg-btn.mlg-btn--primary', {
            type: 'button',
            text: t('insp.addLink'),
            onTap: () => openEdgeEditor({ a: node.id }),
        }),
        el('button.mlg-btn', {
            type: 'button',
            text: t('insp.edit'),
            onTap: () => openNodeEditor(node),
        }),
        el('button.mlg-btn.mlg-btn--ghost', {
            type: 'button',
            text: node.pinned ? t('insp.unpin') : t('insp.pin'),
            onTap: () => {
                node.pinned = !node.pinned;
                save();
                graph.kick(0.3);
                renderInspector();
            },
        }),
        el('button.mlg-btn.mlg-btn--ghost', {
            type: 'button',
            text: t('insp.focus'),
            onTap: () => graph.focus(node.id),
        }),
        getSettings().ai.enabled && llm.readiness().ok
            ? el('button.mlg-btn.mlg-btn--ghost.mlg-btn--spark', {
                type: 'button',
                text: t('ai.dossier'),
                disabled: director.status().busy,
                onTap: () => writeDossier(node),
            }, [icon('spark', 14)])
            : null,
    ].filter(Boolean)));

    const bonds = model.edgesOf(node.id)
        .slice()
        .sort((a, b) => (model.REL_META[a.type].order - model.REL_META[b.type].order)
            || (b.strength - a.strength));

    inspector.appendChild(el('h4.mlg-insp-section', { text: `${t('insp.bonds')} (${bonds.length})` }));

    if (!bonds.length) {
        inspector.appendChild(el('p.mlg-insp-empty', { text: t('insp.noBonds') }));
    } else {
        const list = el('div.mlg-bonds');
        for (const edge of bonds) {
            list.appendChild(bondRow(edge, node.id));
        }
        inspector.appendChild(list);
    }

    inspector.appendChild(el('button.mlg-btn.mlg-btn--danger', {
        type: 'button',
        text: t('insp.remove'),
        onTap: () => confirmDialog(t('confirm.deleteNode', { name: node.name }), () => {
            model.removeNode(node.id);
            selection = null;
            graph.select(null, false);
            syncGraph();
            showToast(t('toast.nodeRemoved', { name: node.name }));
        }),
    }));
}

/**
 * Everything the director has written about a soul: the short read, the traits
 * it hung on them, and the dossier when one was asked for.
 */
function renderProfile(node) {
    if (node.bio) {
        inspector.appendChild(el('div.mlg-insp-bio', {}, [
            el('h4.mlg-insp-section', {}, [
                el('span', { text: t('insp.bio') }),
                node.origin === 'ai' || typeof node.lastAi === 'number'
                    ? el('span.mlg-insp-byline', {}, [icon('spark', 11)])
                    : null,
            ]),
            el('p.mlg-insp-note', { text: node.bio }),
        ]));
    }

    if (Array.isArray(node.traits) && node.traits.length) {
        inspector.appendChild(el('div.mlg-traits', {},
            node.traits.map(trait => el('span.mlg-trait', { text: trait }))));
    }

    const dossier = node.dossier;
    if (!dossier) return;
    const rows = ['appearance', 'personality', 'goal', 'secret', 'voice']
        .filter(field => dossier[field])
        .map(field => el('div.mlg-dossier-row', {}, [
            el('span.mlg-dossier-label', { text: t('insp.' + field) }),
            el('p.mlg-dossier-text', { text: dossier[field] }),
        ]));
    if (!rows.length) return;

    inspector.appendChild(el('h4.mlg-insp-section', { text: t('insp.dossier') }));
    inspector.appendChild(el('div.mlg-dossier', {}, rows));
}

function bondRow(edge, fromId) {
    const otherId = edge.a === fromId ? edge.b : edge.a;
    const other = model.findNode(otherId);
    const meta = model.REL_META[edge.type];
    const outgoing = edge.dir === 'both'
        ? t('insp.mutual')
        : ((edge.dir === 'a2b') === (edge.a === fromId) ? t('insp.oneWayOut') : t('insp.oneWayIn'));

    const stage = model.stageOf(edge);
    const growing = edge.origin === 'story' && model.edgeProgress(edge) < 100;

    return el('div.mlg-bond', { style: { '--mlg-accent': meta.color }, 'data-stage': stage }, [
        other ? avatarChip(other, 30) : el('span.mlg-avatar', {}, [el('span.mlg-avatar-initials', { text: '?' })]),
        el('div.mlg-bond-main', {}, [
            el('div.mlg-bond-top', {}, [
                el('span.mlg-bond-name', { text: other?.name || '?' }),
                growing ? el('span.mlg-stage-chip', { 'data-stage': stage, text: t('stage.' + stage) }) : null,
                el('span.mlg-bond-glyph', { text: meta.glyph }),
            ]),
            el('div.mlg-bond-meta', { text: `${t('rel.' + edge.type + '.short')} · ${outgoing}${edge.note ? ' · ' + edge.note : ''}` }),
            el('span.mlg-bond-bar', { 'data-growing': String(growing) }, [
                el('i', { style: { width: (edge.strength || 50) + '%' } }),
                growing ? el('u', { style: { width: Math.round(model.edgeProgress(edge)) + '%' } }) : null,
            ]),
        ]),
        el('div.mlg-bond-actions', {}, [
            el('button.mlg-icon-btn.mlg-icon-btn--sm', {
                type: 'button',
                title: t('insp.edit'),
                onTap: () => openEdgeEditor({ edge }),
            }, [icon('pencil', 15)]),
            el('button.mlg-icon-btn.mlg-icon-btn--sm', {
                type: 'button',
                title: t('common.delete'),
                onTap: () => confirmDialog(t('confirm.deleteEdge'), () => {
                    model.removeEdge(edge.id);
                    syncGraph();
                }),
            }, [icon('trash', 15)]),
        ]),
    ]);
}

function renderEdgeInspector(edge) {
    if (!edge) return;
    const a = model.findNode(edge.a);
    const b = model.findNode(edge.b);
    const meta = model.REL_META[edge.type];

    inspector.appendChild(el('div.mlg-insp-head.mlg-insp-head--edge', { style: { '--mlg-accent': meta.color } }, [
        a ? avatarChip(a, 42) : null,
        el('span.mlg-bond-glyph.mlg-bond-glyph--big', { text: meta.glyph }),
        b ? avatarChip(b, 42) : null,
    ]));

    const progress = model.edgeProgress(edge);
    const stage = model.stageOf(edge);

    inspector.appendChild(el('div.mlg-insp-id', {}, [
        el('h3.mlg-insp-name', { text: `${a?.name || '?'} — ${b?.name || '?'}` }),
        el('div.mlg-insp-tags', {}, [
            el('span.mlg-tag', { style: { '--mlg-accent': meta.color }, text: t('rel.' + edge.type) }),
            el('span.mlg-tag.mlg-tag--soft', { text: t('edge.dir.' + edge.dir) }),
            el('span.mlg-tag.mlg-tag--soft', { text: `${t('edge.strength')}: ${edge.strength}` }),
            edge.origin === 'story'
                ? el('span.mlg-tag.mlg-tag--story', { text: t('stage.' + stage) })
                : null,
            edge.locked ? el('span.mlg-tag.mlg-tag--soft', { text: t('edge.locked') }) : null,
        ]),
    ]));

    if (edge.origin === 'story') {
        inspector.appendChild(el('div.mlg-growth', {}, [
            el('div.mlg-growth-head', {}, [
                el('span', { text: t('edge.growth') }),
                el('span.mlg-growth-value', { text: Math.round(progress) + '%' }),
            ]),
            el('span.mlg-growth-bar', {}, [el('i', { style: { width: Math.round(progress) + '%', '--mlg-accent': meta.color } })]),
            el('p.mlg-growth-note', {
                text: typeof edge.since === 'number'
                    ? t('edge.sinceMsg', { n: edge.since + 1, hits: edge.hits || 1 })
                    : t('edge.fromStory'),
            }),
        ]));
    }

    if (edge.note) inspector.appendChild(el('p.mlg-insp-note', { text: edge.note }));

    inspector.appendChild(el('div.mlg-insp-actions', {}, [
        el('button.mlg-btn.mlg-btn--primary', {
            type: 'button',
            text: t('insp.edit'),
            onTap: () => openEdgeEditor({ edge }),
        }),
        edge.locked && edge.origin === 'story'
            ? el('button.mlg-btn.mlg-btn--ghost', {
                type: 'button',
                text: t('edge.unlock'),
                onTap: () => {
                    edge.locked = false;
                    save();
                    renderInspector();
                },
            })
            : null,
        el('button.mlg-btn.mlg-btn--danger', {
            type: 'button',
            text: t('common.delete'),
            onTap: () => confirmDialog(t('confirm.deleteEdge'), () => {
                model.removeEdge(edge.id);
                selection = null;
                graph.select(null, false);
                syncGraph();
            }),
        }),
    ].filter(Boolean)));
}

/* ------------------------------------------------------------------ search */

function renderSearch(keepHidden = false) {
    if (!searchBox || !searchResults) return;
    const query = searchBox.value.trim().toLowerCase();
    if (keepHidden && !query) {
        searchResults.hidden = true;
        return;
    }
    clear(searchResults);
    const matches = model.nodes()
        .filter(n => !query || n.name.toLowerCase().includes(query) || (n.role || '').toLowerCase().includes(query))
        .slice(0, 24);

    if (!matches.length) {
        searchResults.appendChild(el('div.mlg-search-empty', { text: t('search.empty') }));
    }
    for (const node of matches) {
        searchResults.appendChild(el('button.mlg-search-row', {
            type: 'button',
            onTap: () => {
                selection = { type: 'node', id: node.id };
                graph.select(selection, false);
                graph.focus(node.id);
                renderInspector();
                renderBasis();
                searchResults.hidden = true;
                searchBox.blur();
            },
        }, [
            avatarChip(node, 26),
            el('span.mlg-search-name', { text: node.name }),
            node.role ? el('span.mlg-search-role', { text: node.role }) : null,
        ]));
    }
    searchResults.hidden = false;
}

/* ------------------------------------------------------------------- menus */

function closeMenu() {
    if (!openMenuEl) return;
    openMenuEl.backdrop?.remove();
    openMenuEl.remove();
    openMenuEl = null;
}

/**
 * True when menus should be bottom sheets rather than popovers: a phone, or any
 * touch screen narrow enough that a popover would be a thumb-sized lottery.
 */
function compactMenus() {
    const rect = viewportRect();
    return rect.width < MOBILE_MENU_WIDTH || (isTouchDevice() && rect.width < 900);
}

/**
 * Opens a popover next to an anchor. On narrow screens it becomes a bottom
 * sheet, which is far easier to hit with a thumb.
 *
 * Both flavours are positioned inside the menu layer, which the overlay keeps
 * aligned with the *visible* viewport - the part of the screen left over after
 * the browser chrome and the on-screen keyboard have taken their share. A sheet
 * pinned to the layout viewport instead would slide out of sight on a phone,
 * which is what used to make these menus look like they never opened.
 */
function openMenu(anchor, items) {
    closeMenu();
    const compact = compactMenus();
    const menu = el('div.mlg-menu' + (compact ? '.mlg-menu--sheet' : ''), { role: 'menu' });
    menu.anchor = anchor;

    for (const item of items) {
        if (!item) continue;
        if (item.type === 'title') {
            menu.appendChild(el('div.mlg-menu-title', { text: item.label }));
            continue;
        }
        if (item.type === 'separator') {
            menu.appendChild(el('div.mlg-menu-sep'));
            continue;
        }
        if (item.type === 'note') {
            menu.appendChild(el('div.mlg-menu-note', { text: item.label }));
            continue;
        }
        const row = el('button.mlg-menu-item', {
            type: 'button',
            role: 'menuitem',
            'data-checked': item.checked === undefined ? '' : String(!!item.checked),
            'data-tone': item.tone || '',
            disabled: !!item.disabled,
            // The tap that opened this menu is still travelling: ignore the
            // click it leaves behind so a sheet never dismisses itself. Short
            // enough that a real thumb is never turned away.
            tapGuard: 200,
            onTap: () => {
                if (item.disabled) return;
                if (item.keepOpen) {
                    item.run?.();
                    return;
                }
                closeMenu();
                item.run?.();
            },
        }, [
            item.icon ? icon(item.icon, 16) : el('span.mlg-menu-spacer'),
            el('span.mlg-menu-label', { text: item.label }),
            item.checked === undefined ? null : el('span.mlg-menu-check'),
        ]);
        if (item.swatch) row.style.setProperty('--mlg-accent', item.swatch);
        menu.appendChild(row);
    }

    // A sheet gets a real backdrop: on a touch screen the "tap outside to
    // dismiss" has to work even when the host swallows document-level events.
    if (compact) {
        const backdrop = el('div.mlg-menu-backdrop', { tapGuard: 200, onTap: () => closeMenu() });
        menuLayer.appendChild(backdrop);
        menu.backdrop = backdrop;
    }

    menuLayer.appendChild(menu);
    openMenuEl = menu;

    if (!compact) placeMenu(menu, anchor);
    requestAnimationFrame(() => menu.classList.add('mlg-menu--in'));
    return menu;
}

/** Puts a popover under its anchor, kept fully inside the visible window. */
function placeMenu(menu, anchor) {
    const layer = menuLayer.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;

    let left = rect.left + rect.width / 2 - width / 2 - layer.left;
    left = Math.min(Math.max(8, left), Math.max(8, layer.width - width - 8));

    let top = rect.bottom + 8 - layer.top;
    if (top + height > layer.height - 8) {
        // No room below: try above the anchor, then simply fit it in.
        const above = rect.top - 8 - height - layer.top;
        top = above >= 8 ? above : Math.max(8, layer.height - height - 8);
    }

    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
}

function openAddMenu(anchor) {
    openMenu(anchor, [
        { icon: 'plus', label: t('tb.addNpc'), run: () => openNodeEditor(null) },
        { icon: 'group', label: t('tb.addGroup'), run: () => openGroupPicker() },
        { icon: 'sync', label: t('tb.sync'), run: () => doSync() },
    ]);
}

function openFilterMenu(anchor) {
    const settings = getSettings();
    const relationItems = model.REL_TYPES.map(type => ({
        label: t('rel.' + type),
        checked: settings.filters[type] !== false,
        swatch: model.REL_META[type].color,
        keepOpen: true,
        run: () => {
            settings.filters[type] = settings.filters[type] === false;
            save();
            syncGraph();
            openFilterMenu(anchor);
        },
    }));

    const toggle = (key, labelKey, target) => ({
        label: t(labelKey),
        checked: target[key] !== false,
        keepOpen: true,
        run: () => {
            target[key] = target[key] === false;
            save();
            syncGraph();
            openFilterMenu(anchor);
        },
    });

    openMenu(anchor, [
        { type: 'title', label: t('filters.title') },
        ...relationItems,
        { type: 'separator' },
        toggle('orphans', 'filters.orphans', settings.filters),
        toggle('labels', 'filters.labels', settings.ui),
        toggle('avatars', 'filters.avatars', settings.ui),
    ]);
}

function openDataMenu(anchor) {
    openMenu(anchor, [
        { icon: 'data', label: t('data.export'), run: () => exportFile() },
        { icon: 'data', label: t('data.import'), run: () => importFile() },
        { type: 'separator' },
        {
            icon: 'trash',
            label: t('data.clear'),
            run: () => confirmDialog(t('confirm.clear'), () => {
                model.clearGraph();
                selection = null;
                graph.select(null, false);
                syncGraph();
            }),
        },
    ]);
}

/** The chronicle menu: how the story writes itself onto the board. */
function openStoryMenu(anchor) {
    const settings = getSettings();
    const story = settings.story;
    const state = chronicle.status();

    const flag = (key, labelKey) => ({
        label: t(labelKey),
        checked: story[key] !== false,
        keepOpen: true,
        run: () => {
            story[key] = story[key] === false;
            save();
            syncGraph();
            openStoryMenu(anchor);
        },
    });

    const paceItem = (value, labelKey) => ({
        label: t(labelKey),
        checked: story.pace === value,
        keepOpen: true,
        run: () => {
            story.pace = value;
            save();
            openStoryMenu(anchor);
        },
    });

    openMenu(anchor, [
        { type: 'title', label: t('story.title') },
        {
            label: t('story.mode'),
            checked: !!story.enabled,
            keepOpen: true,
            run: () => {
                story.enabled = !story.enabled;
                save();
                if (story.enabled) chronicle.advance();
                syncGraph();
                openStoryMenu(anchor);
            },
        },
        { type: 'note', label: t('story.read', { read: state.applied, total: state.total, chapter: state.chapter }) },
        { type: 'separator' },
        flag('cast', 'story.cast'),
        flag('mentions', 'story.mentions'),
        flag('fade', 'story.fade'),
        { type: 'separator' },
        { type: 'title', label: t('story.pace') },
        paceItem('gentle', 'story.pace.gentle'),
        paceItem('normal', 'story.pace.normal'),
        paceItem('fast', 'story.pace.fast'),
        { type: 'separator' },
        {
            icon: 'rewind',
            label: t('story.rebuild'),
            disabled: state.busy,
            run: () => {
                showToast(t('story.rebuilding'));
                chronicle.rebuild(result => {
                    syncGraph();
                    graph?.relayout();
                    showToast(t('story.rebuilt', { bonds: result.revealed, souls: result.added }));
                });
            },
        },
        {
            icon: 'trash',
            label: t('story.forget'),
            tone: 'danger',
            run: () => confirmDialog(t('confirm.forget'), () => {
                chronicle.forget();
                selection = null;
                graph.select(null, false);
                syncGraph();
            }),
        },
    ]);
}

/**
 * The director menu: which model writes this map, what it is allowed to write,
 * and the three things you ever want to do to it by hand.
 */
function openDirectorMenu(anchor) {
    const settings = getSettings();
    const ai = settings.ai;
    const state = director.status();
    const ready = llm.readiness();

    const flag = (key, labelKey) => ({
        label: t(labelKey),
        checked: ai[key] !== false,
        keepOpen: true,
        run: () => {
            ai[key] = ai[key] === false;
            save();
            openDirectorMenu(anchor);
        },
    });

    const sourceItem = (value, labelKey) => ({
        label: t(labelKey),
        checked: ai.source === value,
        keepOpen: true,
        run: () => {
            ai.source = value;
            save();
            openDirectorMenu(anchor);
        },
    });

    // When the map is written by a separate profile, switching between them is
    // the one thing worth having under the thumb.
    const profiles = ai.source === 'profile' ? llm.connectionProfiles() : [];
    const profileItems = profiles.length
        ? [
            { type: 'separator' },
            { type: 'title', label: t('ai.profile') },
            ...profiles.slice(0, 8).map(profile => ({
                label: profile.model ? `${profile.name} · ${profile.model}` : profile.name,
                checked: ai.profileId === profile.id,
                keepOpen: true,
                run: () => {
                    ai.profileId = profile.id;
                    save();
                    openDirectorMenu(anchor);
                },
            })),
        ]
        : (ai.source === 'profile' ? [{ type: 'note', label: t('ai.noProfiles') }] : []);

    openMenu(anchor, [
        { type: 'title', label: t('ai.title') },
        {
            label: t('ai.enable'),
            checked: !!ai.enabled,
            keepOpen: true,
            run: () => {
                ai.enabled = !ai.enabled;
                save();
                renderAll();
                if (ai.enabled) director.schedule(600);
                openDirectorMenu(anchor);
            },
        },
        {
            type: 'note',
            label: ready.ok
                ? t('ai.target', { target: llm.targetLabel() })
                : t('ai.failed', { error: t('ai.reason.' + ready.reason) }),
        },
        {
            type: 'note',
            label: t('ai.stats', {
                read: state.analyzed,
                total: state.total,
                runs: state.runs,
                souls: state.souls,
                bonds: state.bonds,
            }),
        },
        { type: 'separator' },
        { type: 'title', label: t('ai.source') },
        sourceItem('main', 'ai.source.main'),
        sourceItem('profile', 'ai.source.profile'),
        sourceItem('custom', 'ai.source.custom'),
        ...profileItems,
        ai.source === 'custom' ? { type: 'note', label: t('ai.customHint') } : null,
        { type: 'separator' },
        flag('auto', 'ai.auto'),
        flag('newSouls', 'ai.newSouls'),
        flag('newBonds', 'ai.newBonds'),
        flag('profiles', 'ai.profiles'),
        { type: 'separator' },
        state.busy
            ? { icon: 'close', label: t('ai.stop'), tone: 'danger', run: () => director.cancel() }
            : {
                icon: 'spark',
                label: t('ai.analyze'),
                disabled: !ready.ok,
                run: () => runDirectorPass(),
            },
        {
            icon: 'rewind',
            label: t('ai.rebuild'),
            disabled: state.busy || !ready.ok,
            run: () => runDirectorRebuild(),
        },
        { icon: 'story', label: t('ai.log'), run: () => openStoryLog() },
        {
            icon: 'trash',
            label: t('ai.forget'),
            tone: 'danger',
            run: () => confirmDialog(t('ai.confirmForget'), () => {
                director.forget();
                selection = null;
                graph.select(null, false);
                syncGraph();
            }),
        },
    ].filter(Boolean));
}

/** What the director has written down about this chat, newest first. */
function openStoryLog() {
    const entries = director.storyLog();
    const body = el('div.mlg-log');
    if (!entries.length) {
        body.appendChild(el('p.mlg-insp-empty', { text: t('ai.logEmpty') }));
    }
    for (const entry of entries) {
        body.appendChild(el('div.mlg-log-row', {}, [
            el('span.mlg-log-index', { text: '#' + entry.index }),
            el('p.mlg-log-text', { text: entry.text }),
        ]));
    }
    openModal({ title: t('ai.log'), body, actions: [] });
}

/* -------------------------------------------------- the director, by hand */

async function runDirectorPass() {
    showToast(t('ai.reading'));
    renderAll();
    try {
        const result = await director.analyze();
        syncGraph();
        graph?.kick(0.6);
        showToast(result
            ? t('ai.done', { souls: result.souls, bonds: result.bonds, changed: result.changed })
            : t('ai.nothing'));
    } catch (err) {
        showToast(t('ai.failed', { error: String(err?.message || err) }));
    }
    renderAll();
}

async function runDirectorRebuild() {
    const ai = getSettings().ai;
    const state = director.status();
    const passes = Math.max(1, Math.ceil(Math.min(state.total, ai.depth) / Math.max(4, ai.window)));
    confirmDialog(t('ai.confirmRebuild', { n: passes }), async () => {
        try {
            const result = await director.rebuild(progress => {
                showToast(t('ai.rebuilding', { done: progress.done + 1, of: progress.of }));
                syncGraph();
            });
            syncGraph();
            graph?.relayout();
            showToast(t('ai.done', { souls: result.souls, bonds: result.bonds, changed: result.changed }));
        } catch (err) {
            showToast(t('ai.failed', { error: String(err?.message || err) }));
        }
        renderAll();
    });
}

/** Asks the model for a full dossier on one soul. */
async function writeDossier(node) {
    showToast(t('ai.dossierBusy'));
    try {
        await director.dossier(node.id);
        syncGraph();
        showToast(t('ai.dossierDone', { name: node.name }));
    } catch (err) {
        showToast(t('ai.failed', { error: String(err?.message || err) }));
    }
    renderInspector();
}

function openLanguageMenu(anchor) {
    openMenu(anchor, LANGUAGES.map(lang => ({
        label: lang.label,
        checked: getLanguage() === lang.id,
        run: () => {
            getSettings().lang = lang.id;
            setLanguage(lang.id);
            save();
        },
    })));
}

function openGroupPicker() {
    const list = groups();
    if (!list.length) {
        showToast(t('toast.noGroups'));
        return;
    }
    const body = el('div.mlg-list');
    for (const group of list) {
        body.appendChild(el('button.mlg-list-row', {
            type: 'button',
            onTap: () => {
                const added = model.importGroup(group.id);
                closeModal();
                syncGraph();
                graph.kick(0.8);
                showToast(t('toast.groupAdded', { n: added }));
            },
        }, [
            icon('group', 18),
            el('span', { text: group.name || 'Group' }),
            el('span.mlg-list-meta', { text: String((group.members || []).length) }),
        ]));
    }
    openModal({ title: t('group.pick'), body, actions: [] });
}

/* ------------------------------------------------------------------ modals */

function openModal({ title, body, actions = [], wide = false }) {
    const sheet = el('div.mlg-modal' + (wide ? '.mlg-modal--wide' : ''), { role: 'dialog', 'aria-modal': 'true' }, [
        el('div.mlg-modal-head', {}, [
            el('h3', { text: title }),
            el('button.mlg-icon-btn', {
                type: 'button',
                title: t('common.close'),
                onTap: () => closeModal(),
            }, [icon('close', 16)]),
        ]),
        el('div.mlg-modal-body', {}, [body]),
        actions.length ? el('div.mlg-modal-foot', {}, actions) : null,
    ]);
    const wrap = el('div.mlg-modal-wrap', {
        onPointerdown: e => {
            if (e.target === wrap) closeModal();
        },
    }, [sheet]);
    modalLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('mlg-modal--in'));
    return wrap;
}

function closeModal() {
    const last = modalLayer.lastElementChild;
    if (last) last.remove();
}

function confirmDialog(message, onConfirm) {
    const body = el('p.mlg-confirm-text', { text: message });
    openModal({
        title: 'MyLove Graph',
        body,
        actions: [
            el('button.mlg-btn.mlg-btn--ghost', { type: 'button', text: t('common.cancel'), onTap: () => closeModal() }),
            el('button.mlg-btn.mlg-btn--danger', {
                type: 'button',
                text: t('common.ok'),
                onTap: () => {
                    closeModal();
                    onConfirm();
                },
            }),
        ],
    });
}

function showToast(message) {
    if (!toastLayer) return;
    const toast = el('div.mlg-toast', { text: message });
    toastLayer.appendChild(toast);
    setTimeout(() => toast.classList.add('mlg-toast--out'), 2600);
    setTimeout(() => toast.remove(), 3100);
}

/* ------------------------------------------------------------ node editor */

function field(labelKey, control, hint) {
    return el('label.mlg-field', {}, [
        el('span.mlg-field-label', { text: t(labelKey) }),
        control,
        hint ? el('span.mlg-field-hint', { text: hint }) : null,
    ]);
}

function openNodeEditor(node) {
    const isNew = !node;
    const draft = node || model.createNode({});
    const locked = !isNew && draft.kind !== 'npc';

    const nameInput = el('input.mlg-input', {
        type: 'text',
        value: draft.name === 'Unnamed' && isNew ? '' : draft.name,
        placeholder: t('node.namePh'),
        disabled: locked,
    });
    const roleInput = el('input.mlg-input', { type: 'text', value: draft.role || '', placeholder: t('node.rolePh') });
    const aliasInput = el('input.mlg-input', { type: 'text', value: draft.aliases || '', placeholder: t('node.aliasesPh') });
    const noteInput = el('textarea.mlg-input.mlg-textarea', { rows: 3, placeholder: t('node.notePh') });
    noteInput.value = draft.note || '';
    const avatarInput = el('input.mlg-input', { type: 'url', value: draft.avatarUrl || '', placeholder: t('node.avatarPh') });

    let color = draft.color || '';
    const swatches = el('div.mlg-swatches');
    const paint = () => {
        swatches.querySelectorAll('button').forEach(b => {
            b.dataset.active = String(b.dataset.color === color);
        });
    };
    swatches.appendChild(el('button', {
        type: 'button',
        'data-color': '',
        title: t('common.reset'),
        class: 'mlg-swatch mlg-swatch--auto',
        onTap: () => {
            color = '';
            paint();
        },
    }));
    for (const value of model.NODE_ACCENTS) {
        swatches.appendChild(el('button.mlg-swatch', {
            type: 'button',
            'data-color': value,
            style: { '--mlg-swatch': value },
            onTap: () => {
                color = value;
                paint();
            },
        }));
    }
    paint();

    const error = el('div.mlg-error', { hidden: true });

    const body = el('div.mlg-form', {}, [
        field('node.name', nameInput, locked ? t('node.lockedHint') : ''),
        field('node.role', roleInput),
        field('node.aliases', aliasInput, t('node.aliasesHint')),
        field('node.color', swatches),
        field('node.avatar', avatarInput),
        field('node.note', noteInput),
        error,
    ]);

    const wrap = openModal({
        title: isNew ? t('node.title.new') : t('node.title.edit'),
        body,
        actions: [
            !isNew && draft.kind === 'npc'
                ? el('button.mlg-btn.mlg-btn--danger', {
                    type: 'button',
                    text: t('common.delete'),
                    onTap: () => {
                        closeModal();
                        confirmDialog(t('confirm.deleteNode', { name: draft.name }), () => {
                            model.removeNode(draft.id);
                            selection = null;
                            graph.select(null, false);
                            syncGraph();
                        });
                    },
                })
                : null,
            el('button.mlg-btn.mlg-btn--ghost', { type: 'button', text: t('common.cancel'), onTap: () => closeModal() }),
            el('button.mlg-btn.mlg-btn--primary', {
                type: 'button',
                text: t('common.save'),
                onTap: () => {
                    const name = nameInput.value.trim();
                    if (!locked && !name) {
                        error.hidden = false;
                        error.textContent = t('node.nameRequired');
                        return;
                    }
                    const patch = {
                        name: locked ? draft.name : name,
                        role: roleInput.value.trim(),
                        aliases: aliasInput.value.trim(),
                        note: noteInput.value.trim(),
                        avatarUrl: avatarInput.value.trim(),
                        color,
                    };
                    if (isNew) {
                        const created = model.addNode({ ...patch, kind: 'npc', edited: true });
                        syncGraph();
                        graph.kick(0.7);
                        selection = { type: 'node', id: created.id };
                        graph.select(selection, false);
                        renderInspector();
                        renderBasis();
                    } else {
                        // From here on this soul is the user's: the director
                        // fills in what is still blank and nothing else.
                        Object.assign(draft, patch, { edited: true });
                        save();
                        syncGraph();
                    }
                    closeModal();
                },
            }),
        ].filter(Boolean),
    });

    setTimeout(() => (locked ? roleInput : nameInput).focus(), 60);
    return wrap;
}

/* ------------------------------------------------------------ edge editor */

function nodeSelect(value, exclude) {
    const select = el('select.mlg-input.mlg-select');
    const list = model.nodes().slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const node of list) {
        if (node.id === exclude) continue;
        const option = el('option', { value: node.id, text: node.name });
        if (node.id === value) option.selected = true;
        select.appendChild(option);
    }
    return select;
}

function openEdgeEditor({ edge = null, a = null } = {}) {
    const nodes = model.nodes();
    if (nodes.length < 2) {
        showToast(t('edge.needTwo'));
        return;
    }

    const isNew = !edge;
    const initialA = edge?.a || a || nodes[0].id;
    const initialB = edge?.b || nodes.find(n => n.id !== initialA)?.id;

    const fromSelect = nodeSelect(initialA);
    let toSelect = nodeSelect(initialB, initialA);
    fromSelect.disabled = !isNew;
    toSelect.disabled = !isNew;
    fromSelect.addEventListener('change', () => {
        const keep = toSelect.value;
        const replacement = nodeSelect(keep === fromSelect.value ? null : keep, fromSelect.value);
        replacement.className = toSelect.className;
        toSelect.replaceWith(replacement);
        toSelect = replacement;
    });

    let type = edge?.type || 'love';
    const typeRow = el('div.mlg-chips');
    for (const value of model.REL_TYPES) {
        const meta = model.REL_META[value];
        typeRow.appendChild(el('button.mlg-chip', {
            type: 'button',
            'data-active': String(type === value),
            style: { '--mlg-accent': meta.color },
            onTap: e => {
                type = value;
                typeRow.querySelectorAll('button').forEach(b => (b.dataset.active = 'false'));
                e.currentTarget.dataset.active = 'true';
            },
        }, [
            el('span.mlg-chip-glyph', { text: meta.glyph }),
            el('span', { text: t('rel.' + value) }),
        ]));
    }

    const strength = el('input.mlg-range', {
        type: 'range',
        min: '1',
        max: '100',
        step: '1',
        value: String(edge?.strength ?? 65),
    });
    const strengthValue = el('span.mlg-range-value', { text: String(edge?.strength ?? 65) });
    strength.addEventListener('input', () => {
        strengthValue.textContent = strength.value;
    });

    let dir = edge?.dir || 'both';
    const dirRow = el('div.mlg-segment');
    for (const value of ['both', 'a2b', 'b2a']) {
        dirRow.appendChild(el('button.mlg-segment-btn', {
            type: 'button',
            'data-active': String(dir === value),
            text: t('edge.dir.' + value),
            onTap: e => {
                dir = value;
                dirRow.querySelectorAll('button').forEach(b => (b.dataset.active = 'false'));
                e.currentTarget.dataset.active = 'true';
            },
        }));
    }

    const noteInput = el('input.mlg-input', { type: 'text', value: edge?.note || '', placeholder: t('edge.notePh') });
    const error = el('div.mlg-error', { hidden: true });

    const body = el('div.mlg-form', {}, [
        el('div.mlg-form-pair', {}, [
            field('edge.from', fromSelect),
            field('edge.to', toSelect),
        ]),
        field('edge.type', typeRow),
        field('edge.strength', el('div.mlg-range-row', {}, [strength, strengthValue])),
        field('edge.dir', dirRow),
        field('edge.note', noteInput),
        error,
    ]);

    openModal({
        title: isNew ? t('edge.title.new') : t('edge.title.edit'),
        body,
        wide: true,
        actions: [
            !isNew
                ? el('button.mlg-btn.mlg-btn--danger', {
                    type: 'button',
                    text: t('common.delete'),
                    onTap: () => {
                        closeModal();
                        confirmDialog(t('confirm.deleteEdge'), () => {
                            model.removeEdge(edge.id);
                            selection = null;
                            graph.select(null, false);
                            syncGraph();
                        });
                    },
                })
                : null,
            el('button.mlg-btn.mlg-btn--ghost', { type: 'button', text: t('common.cancel'), onTap: () => closeModal() }),
            el('button.mlg-btn.mlg-btn--primary', {
                type: 'button',
                text: t('common.save'),
                onTap: () => {
                    const from = isNew ? fromSelect.value : edge.a;
                    const to = isNew ? toSelect.value : edge.b;
                    if (from === to) {
                        error.hidden = false;
                        error.textContent = t('edge.same');
                        return;
                    }
                    if (isNew && model.findEdge(from, to)) {
                        error.hidden = false;
                        error.textContent = t('edge.exists');
                        return;
                    }
                    const saved = model.upsertEdge({
                        id: edge?.id,
                        a: from,
                        b: to,
                        type,
                        strength: Number(strength.value),
                        dir,
                        note: noteInput.value.trim(),
                        // Touched by hand: the chronicle stops steering it.
                        locked: true,
                    });
                    closeModal();
                    syncGraph();
                    graph.kick(0.5);
                    selection = { type: 'edge', id: saved.id };
                    graph.select(selection, false);
                    renderInspector();
                },
            }),
        ].filter(Boolean),
    });
}

/* ------------------------------------------------------------------ actions */

function doSync(silent = false) {
    const result = model.syncCharacters();
    syncGraph();
    graph?.kick(0.9);
    if (silent) return;
    if (result.added) showToast(t('toast.synced', { added: result.added, total: result.total }));
    else showToast(t('toast.nothingNew'));
}

function exportFile() {
    try {
        const payload = JSON.stringify(model.exportGraph(), null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = el('a', { href: url, download: 'mylove-graph.json' });
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(t('data.exported'));
    } catch (err) {
        console.error('[MyLove Graph] export failed', err);
    }
}

function importFile() {
    const input = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        try {
            const payload = JSON.parse(await file.text());
            const result = model.importGraph(payload);
            if (!result) {
                showToast(t('data.badFile'));
                return;
            }
            selection = null;
            graph.select(null, false);
            syncGraph();
            graph.relayout();
            showToast(t('data.imported', { nodes: result.nodes, edges: result.edges }));
        } catch (err) {
            console.error('[MyLove Graph] import failed', err);
            showToast(t('data.badFile'));
        }
    });
    document.body.appendChild(input);
    input.click();
}
