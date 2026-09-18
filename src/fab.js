/**
 * MyLove Graph - the floating heart button.
 *
 * Tap to open the graph, drag to move it. The position is remembered and the
 * button snaps to the nearest side so it never sits in the middle of the chat.
 *
 * The drag deliberately does *not* rely on the button keeping the pointer:
 * `setPointerCapture` is a best-effort call, the move/up listeners live on the
 * window, and a touch-event path takes over on browsers without PointerEvent or
 * when the host cancels the pointer stream mid-gesture. That is what makes the
 * heart draggable on phones, where the old element-bound listeners went quiet
 * the moment the host swallowed the pointer sequence.
 */

import { el, icon } from './dom.js';
import { t } from './i18n.js';
import { getSettings, save, isLite, animationsEnabled } from './state.js';
import { viewportRect, onViewportChange, safeInset } from './viewport.js';

let fab = null;
let drag = null;
let onActivate = () => {};
/** Swallows exactly one click: the one a handled gesture leaves behind. */
let swallowNextClick = false;
let swallowTimer = 0;

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

    if (window.PointerEvent) {
        fab.addEventListener('pointerdown', onPointerDown);
    } else {
        fab.addEventListener('touchstart', onTouchStart, { passive: false });
    }
    // Some hosts prevent the touch sequence, so a `click` may never arrive:
    // activation also happens from the pointer/touch release below. Whichever
    // fires first wins, and the other one is swallowed.
    fab.addEventListener('click', event => {
        if (swallowNextClick) {
            releaseClickGuard();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onActivate();
    });
    // Dragging must never turn into a text selection or a native image drag.
    fab.addEventListener('dragstart', event => event.preventDefault());
    fab.addEventListener('contextmenu', event => {
        if (drag?.moved) event.preventDefault();
    });

    document.body.appendChild(fab);
    restorePosition();
    applyStyle();

    onViewportChange(() => clampIntoView());
    window.addEventListener('resize', () => clampIntoView());
    window.addEventListener('orientationchange', () => setTimeout(clampIntoView, 250));
    return fab;
}

export function updateFab() {
    if (!fab) return;
    const settings = getSettings();
    fab.title = t('fab.tooltip');
    fab.setAttribute('aria-label', t('fab.tooltip'));
    fab.hidden = !settings.ui.floatingButton;
    applyStyle();
    // Never yank the heart out from under a finger that is carrying it.
    if (settings.ui.floatingButton && !drag) restorePosition();
}

export function setFabVisible(visible) {
    if (!fab) return;
    fab.classList.toggle('mlg-fab--away', !visible);
}

export function resetFabPosition() {
    const settings = getSettings();
    settings.ui.fab = { x: null, y: null, side: '', ratio: null };
    save();
    restorePosition();
}

/** Eats the click that follows a gesture we have already acted on. */
function guardNextClick() {
    swallowNextClick = true;
    clearTimeout(swallowTimer);
    // If no click ever arrives (a cancelled touch, say), stop waiting for it.
    swallowTimer = setTimeout(releaseClickGuard, 700);
}

function releaseClickGuard() {
    swallowNextClick = false;
    clearTimeout(swallowTimer);
}

function applyStyle() {
    if (!fab) return;
    fab.classList.toggle('mlg-fab--still', !animationsEnabled());
    fab.classList.toggle('mlg-fab--lite', isLite());
}

function size() {
    // offsetWidth is 0 while the button is hidden; fall back to the CSS size.
    return fab?.offsetWidth || (isLite() ? 46 : 52);
}

/** The box the heart is allowed to live in: the visible viewport, minus insets. */
function bounds() {
    const rect = viewportRect();
    const side = size();
    const inset = {
        top: safeInset('top'),
        bottom: safeInset('bottom'),
        left: safeInset('left'),
        right: safeInset('right'),
    };
    const minX = rect.left + MARGIN + inset.left;
    const minY = rect.top + MARGIN + inset.top;
    return {
        minX,
        minY,
        maxX: Math.max(minX, rect.left + rect.width - side - MARGIN - inset.right),
        maxY: Math.max(minY, rect.top + rect.height - side - MARGIN - inset.bottom),
    };
}

function place(x, y) {
    const box = bounds();
    const nx = Math.min(Math.max(box.minX, x), box.maxX);
    const ny = Math.min(Math.max(box.minY, y), box.maxY);
    // right/bottom are cleared so no host theme can fight the inline position.
    fab.style.left = Math.round(nx) + 'px';
    fab.style.top = Math.round(ny) + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    return { x: nx, y: ny };
}

/**
 * Stores where the heart rests as a side plus a vertical ratio, so it keeps the
 * same spot after a rotation, a keyboard opening or a window resize.
 */
function remember(point) {
    const box = bounds();
    const span = Math.max(1, box.maxY - box.minY);
    const settings = getSettings();
    settings.ui.fab = {
        x: Math.round(point.x),
        y: Math.round(point.y),
        side: point.x + size() / 2 < viewportRect().left + viewportRect().width / 2 ? 'left' : 'right',
        ratio: Math.min(1, Math.max(0, (point.y - box.minY) / span)),
    };
    save();
}

function restorePosition() {
    if (!fab) return;
    const stored = getSettings().ui.fab || {};
    const box = bounds();

    if (stored.side && typeof stored.ratio === 'number') {
        const y = box.minY + (box.maxY - box.minY) * stored.ratio;
        place(stored.side === 'left' ? box.minX : box.maxX, y);
        return;
    }
    if (typeof stored.x === 'number' && typeof stored.y === 'number') {
        place(stored.x, stored.y);
        return;
    }
    // Default: above the message bar on the right, clear of ST's own controls.
    place(box.maxX, box.maxY - 92);
}

function clampIntoView() {
    if (!fab || fab.hidden || drag) return;
    const stored = getSettings().ui.fab || {};
    if (stored.side || typeof stored.x === 'number') {
        restorePosition();
        return;
    }
    // Never measured through getBoundingClientRect: the hover/active transform
    // would make the heart creep a pixel on every resize.
    const left = parseFloat(fab.style.left) || 0;
    const top = parseFloat(fab.style.top) || 0;
    place(left, top);
}

/* ------------------------------------------------------------------ drag */

function beginDrag(clientX, clientY) {
    const rect = fab.getBoundingClientRect();
    drag = {
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        startX: clientX,
        startY: clientY,
        moved: false,
    };
}

function moveDrag(clientX, clientY) {
    if (!drag) return false;
    if (!drag.moved) {
        if (Math.hypot(clientX - drag.startX, clientY - drag.startY) < DRAG_THRESHOLD) return false;
        drag.moved = true;
        fab.classList.add('mlg-fab--dragging');
    }
    place(clientX - drag.offsetX, clientY - drag.offsetY);
    return true;
}

function endDrag() {
    if (!drag) return false;
    const moved = drag.moved;
    drag = null;
    fab.classList.remove('mlg-fab--dragging');
    if (!moved) return false;

    const box = bounds();
    const left = parseFloat(fab.style.left) || 0;
    const top = parseFloat(fab.style.top) || 0;
    const rect = viewportRect();
    // Snap to whichever edge is closer, so the button hugs the frame.
    const snapX = left + size() / 2 < rect.left + rect.width / 2 ? box.minX : box.maxX;
    remember(place(snapX, top));
    return true;
}

/* ----------------------------------------------------------- pointer path */

function onPointerDown(event) {
    if (event.button !== undefined && event.button > 0) return;
    beginDrag(event.clientX, event.clientY);
    try {
        fab.setPointerCapture?.(event.pointerId);
    } catch {
        // Capture is an optimisation; the window listeners below do the work.
    }
    drag.pointerId = event.pointerId;
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
}

function onPointerMove(event) {
    if (!drag || (drag.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    if (moveDrag(event.clientX, event.clientY) && event.cancelable) event.preventDefault();
}

function onPointerUp(event) {
    if (drag && drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    detachPointer();
    const moved = endDrag();
    if (moved) {
        guardNextClick();
        return;
    }
    if (event.pointerType && event.pointerType !== 'mouse') {
        // Touch: act now, because the click may never be delivered.
        guardNextClick();
        onActivate();
    }
}

/**
 * A cancelled pointer (the host grabbed the gesture, or the browser decided the
 * touch was a scroll) must not leave the heart stuck mid-drag: fall back to raw
 * touch events so the finger still carries it.
 */
function onPointerCancel() {
    detachPointer();
    if (drag?.moved) {
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, true);
        window.addEventListener('touchcancel', onTouchEnd, true);
        return;
    }
    drag = null;
    fab.classList.remove('mlg-fab--dragging');
}

function detachPointer() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
}

/* ------------------------------------------------------------- touch path */

function onTouchStart(event) {
    const touch = event.touches[0];
    if (!touch) return;
    beginDrag(touch.clientX, touch.clientY);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchEnd, true);
}

function onTouchMove(event) {
    const touch = event.touches[0];
    if (!touch || !drag) return;
    if (moveDrag(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
}

function onTouchEnd() {
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd, true);
    window.removeEventListener('touchcancel', onTouchEnd, true);
    const moved = endDrag();
    guardNextClick();
    if (!moved) onActivate();
}
