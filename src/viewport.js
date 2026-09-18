/**
 * MyLove Graph - the visible viewport.
 *
 * On phones the layout viewport and the *visible* one drift apart all the time:
 * the browser chrome slides away, the on-screen keyboard eats the bottom half,
 * a pinch-zoom shifts everything sideways. A `position: fixed` panel follows the
 * layout viewport, so anything anchored to the bottom of the screen - a bottom
 * sheet, a menu, a modal - can end up under the keyboard or off-screen, which
 * looks exactly like "the menu does not open".
 *
 * This module mirrors `visualViewport` into CSS custom properties on <html>:
 *
 *   --mlg-vv-top / --mlg-vv-left / --mlg-vv-w / --mlg-vv-h
 *
 * The overlay is sized from those, so every child - menus included - lands
 * inside the part of the screen the user can actually see and touch.
 */

let started = false;
let frame = 0;
const listeners = new Set();

/** @returns {{top:number,left:number,width:number,height:number}} the visible box in CSS px. */
export function viewportRect() {
    const vv = window.visualViewport;
    if (vv) {
        return {
            top: vv.offsetTop || 0,
            left: vv.offsetLeft || 0,
            width: vv.width || window.innerWidth,
            height: vv.height || window.innerHeight,
        };
    }
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

function publish() {
    frame = 0;
    insets.clear();
    const rect = viewportRect();
    const style = document.documentElement.style;
    style.setProperty('--mlg-vv-top', rect.top + 'px');
    style.setProperty('--mlg-vv-left', rect.left + 'px');
    style.setProperty('--mlg-vv-w', rect.width + 'px');
    style.setProperty('--mlg-vv-h', rect.height + 'px');
    for (const fn of listeners) {
        try {
            fn(rect);
        } catch (err) {
            console.error('[MyLove Graph] viewport listener failed', err);
        }
    }
}

function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(publish);
}

/** Starts mirroring the viewport. Safe to call more than once. */
export function initViewport() {
    if (started) return;
    started = true;
    publish();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    const vv = window.visualViewport;
    if (vv) {
        vv.addEventListener('resize', schedule);
        vv.addEventListener('scroll', schedule);
    }
}

/** Subscribes to viewport changes. Returns an unsubscribe function. */
export function onViewportChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * The safe-area inset of the device, in CSS px (notches, home indicators).
 * Measured once per viewport change - it is a layout read, far too expensive to
 * repeat on every pointer move.
 */
const insets = new Map();

export function safeInset(side) {
    if (insets.has(side)) return insets.get(side);
    let value = 0;
    try {
        const probe = document.createElement('div');
        probe.style.cssText = `position:fixed;visibility:hidden;top:0;left:0;height:env(safe-area-inset-${side},0px)`;
        document.body.appendChild(probe);
        value = probe.getBoundingClientRect().height || 0;
        probe.remove();
    } catch {
        value = 0;
    }
    insets.set(side, value);
    return value;
}
