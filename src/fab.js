/**
 * MyLove Graph - the floating heart button.
 *
 * Tap to open the graph, drag to move it. The position is remembered and the
 * button snaps to the nearest side so it never sits in the middle of the chat.
 */

import { el, icon } from './dom.js';
import { t } from './i18n.js';
import { getSettings, save, isLite, animationsEnabled } from './state.js';

let fab = null;
let dragState = null;
let suppressClick = false;
let onActivate = () => {};

const MARGIN = 12;
const DRAG_THRESHOLD = 6;

export function createFab(handler) {
    onActivate = handler;
    if (fab) return fab;

    fab = el('button.mlg-fab', {
        type: 'button',
        title: t('fab.tooltip'),
        'aria-label': t('fab.tooltip'),
    }, [
        el('span.mlg-fab-glow', { 'aria-hidden': 'true' }),
        el('span.mlg-fab-ring', { 'aria-hidden': 'true' }),
        icon('heart', 24),
    ]);

    fab.addEventListener('pointerdown', onPointerDown);
    fab.addEventListener('click', event => {
        // A drag ends with a click event too - swallow that one.
        if (suppressClick) {
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onActivate();
    });

    document.body.appendChild(fab);
    restorePosition();
    applyStyle();

    window.addEventListener('resize', () => clampIntoView());
    return fab;
}

export function updateFab() {
    if (!fab) return;
    const settings = getSettings();
    fab.title = t('fab.tooltip');
    fab.setAttribute('aria-label', t('fab.tooltip'));
    fab.hidden = !settings.ui.floatingButton;
    applyStyle();
}

export function setFabVisible(visible) {
    if (!fab) return;
    fab.classList.toggle('mlg-fab--away', !visible);
}

export function resetFabPosition() {
    const settings = getSettings();
    settings.ui.fab = { x: null, y: null };
    save();
    restorePosition();
}

function applyStyle() {
    if (!fab) return;
    fab.classList.toggle('mlg-fab--still', !animationsEnabled());
    fab.classList.toggle('mlg-fab--lite', isLite());
}

function size() {
    // offsetWidth is 0 while the button is hidden; fall back to the CSS size.
    return fab?.offsetWidth || 52;
}

function restorePosition() {
    if (!fab) return;
    const stored = getSettings().ui.fab;
    const side = size();
    if (typeof stored.x === 'number' && typeof stored.y === 'number') {
        place(stored.x, stored.y);
    } else {
        // Default: above the message bar on the right, clear of ST's own controls.
        place(window.innerWidth - side - 18, window.innerHeight - side - 104);
    }
}

function place(x, y) {
    const side = size();
    const maxX = Math.max(MARGIN, window.innerWidth - side - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - side - MARGIN);
    const nx = Math.min(Math.max(MARGIN, x), maxX);
    const ny = Math.min(Math.max(MARGIN, y), maxY);
    fab.style.left = Math.round(nx) + 'px';
    fab.style.top = Math.round(ny) + 'px';
    return { x: nx, y: ny };
}

function clampIntoView() {
    if (!fab || fab.hidden) return;
    const rect = fab.getBoundingClientRect();
    const next = place(rect.left, rect.top);
    const settings = getSettings();
    if (typeof settings.ui.fab.x === 'number') {
        settings.ui.fab = next;
    }
}

function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
    };
    fab.setPointerCapture?.(event.pointerId);
    fab.addEventListener('pointermove', onPointerMove);
    fab.addEventListener('pointerup', onPointerUp);
    fab.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.moved = true;
    fab.classList.add('mlg-fab--dragging');
    event.preventDefault();
    place(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
}

function onPointerUp(event) {
    if (!dragState) return;
    fab.removeEventListener('pointermove', onPointerMove);
    fab.removeEventListener('pointerup', onPointerUp);
    fab.removeEventListener('pointercancel', onPointerUp);
    fab.classList.remove('mlg-fab--dragging');

    if (dragState.moved) {
        const rect = fab.getBoundingClientRect();
        const side = size();
        // Snap to whichever edge is closer, so the button hugs the frame.
        const snapX = rect.left + side / 2 < window.innerWidth / 2
            ? MARGIN
            : window.innerWidth - side - MARGIN;
        const next = place(snapX, rect.top);
        const settings = getSettings();
        settings.ui.fab = next;
        save();
    }

    suppressClick = dragState.moved;
    dragState = null;
    // If no click follows (touch cancel, for instance) clear the guard anyway.
    if (suppressClick) setTimeout(() => (suppressClick = false), 350);
}
