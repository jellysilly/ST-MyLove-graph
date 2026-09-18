/**
 * MyLove Graph - canvas renderer and force layout.
 *
 * Design notes:
 * - Canvas 2D (not SVG/DOM) so a few hundred nodes stay smooth on phones.
 * - The render loop parks itself the moment the layout settles and nothing is
 *   animating, which is what keeps the extension light on mobile batteries.
 * - Glow is faked with a wide translucent stroke instead of shadowBlur, which
 *   is an order of magnitude cheaper on mobile GPUs.
 */

import { REL_META, BOND_STAGES, avatarSources, dominantType, edgeProgress } from './model.js';

const TAU = Math.PI * 2;
const ALPHA_MIN = 0.008;
const COOLING = 0.976;
/** How long a newly revealed soul or bond keeps its arrival animation, in ms. */
const REVEAL_MS = 1400;
/** Even the faintest spark leaves this much of the way towards the other side. */
const MIN_REACH = 0.3;
/** Progress at which a bond is "settled" and its line reaches all the way over. */
const FULL_AT = (BOND_STAGES.find(s => s.id === 'forming')?.upTo || 72) / 100;

function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

function withAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const int = parseInt(full, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

/** Loads avatars once and shares them between renders. */
class ImageCache {
    constructor(onLoad) {
        this.map = new Map();
        this.onLoad = onLoad;
    }

    get(node) {
        const sources = avatarSources(node);
        if (!sources.length) return null;
        const key = node.id + '|' + sources[0];
        let entry = this.map.get(key);
        if (!entry) {
            entry = { image: null, failed: false, sourceIndex: 0, sources };
            this.map.set(key, entry);
            this.load(entry);
        }
        if (entry.image && entry.image.complete && entry.image.naturalWidth) return entry.image;
        return null;
    }

    load(entry) {
        const url = entry.sources[entry.sourceIndex];
        if (!url) {
            entry.failed = true;
            return;
        }
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
            entry.image = image;
            this.onLoad?.();
        };
        image.onerror = () => {
            entry.sourceIndex++;
            if (entry.sourceIndex < entry.sources.length) this.load(entry);
            else entry.failed = true;
        };
        image.src = url;
    }

    clear() {
        this.map.clear();
    }
}

export class LoveGraph {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} options
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            labels: true,
            avatars: true,
            curved: true,
            animations: true,
            lite: false,
            filters: { love: true, close: true, friendly: true, tense: true, orphans: true },
            ...options,
        };
        this.onSelect = options.onSelect || (() => {});
        this.onPositions = options.onPositions || (() => {});
        this.onOpen = options.onOpen || (() => {});

        this.items = [];
        this.links = [];
        this.byId = new Map();
        this.view = { x: 0, y: 0, k: 1 };
        this.w = 1;
        this.h = 1;
        this.dpr = 1;
        this.alpha = 0;
        this.time = 0;
        this.last = 0;
        this.raf = 0;
        this.dirty = true;
        this.idle = 0;
        this.selection = null;
        this.hoverId = null;
        this.pendingSave = false;
        this.autoFitOnSettle = false;
        this.fitClock = 0;
        this.backdrop = null;
        // While something is still arriving the loop must keep drawing, even on
        // an otherwise settled board.
        this.revealUntil = 0;
        this.now = Date.now();

        this.images = new ImageCache(() => this.requestRender());
        this.pointers = new Map();
        this.drag = null;
        this.pan = null;
        this.pinch = null;
        this.lastTap = 0;

        this.loop = this.loop.bind(this);
        this.bindPointer();
    }

    /* ------------------------------------------------------------ lifecycle */

    start() {
        if (this.raf) return;
        this.last = 0;
        this.idle = 0;
        this.raf = requestAnimationFrame(this.loop);
    }

    stop() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
    }

    destroy() {
        this.stop();
        this.images.clear();
        this.unbindPointer?.();
    }

    setOptions(patch) {
        Object.assign(this.options, patch);
        this.buildBackdrop();
        this.requestRender();
    }

    requestRender() {
        this.dirty = true;
        this.idle = 0;
        this.start();
    }

    /** Remembers that something arrived, so its entrance gets animated. */
    noteReveal(born) {
        const until = born + REVEAL_MS;
        if (until > this.revealUntil) this.revealUntil = until;
    }

    /** 0 while a thing is arriving, 1 once it has fully settled in. */
    revealFactor(born) {
        if (typeof born !== 'number' || !this.options.animations || this.options.lite) return 1;
        const age = this.now - born;
        if (age >= REVEAL_MS) return 1;
        if (age < 0) return 1;
        return easeOut(Math.max(0, age) / REVEAL_MS);
    }

    kick(alpha = 0.55) {
        this.alpha = Math.max(this.alpha, alpha);
        this.pendingSave = true;
        this.requestRender();
    }

    /* ----------------------------------------------------------------- data */

    /**
     * Rebuilds the simulation from the model, keeping positions of nodes that
     * are already on the board.
     */
    sync(nodes, edges) {
        const previous = this.byId;
        const items = [];
        const byId = new Map();
        const radiusBase = this.options.lite ? 21 : 25;

        nodes.forEach((node, index) => {
            const old = previous.get(node.id);
            let x = typeof node.x === 'number' ? node.x : old?.x;
            let y = typeof node.y === 'number' ? node.y : old?.y;
            if (typeof x !== 'number' || typeof y !== 'number') {
                // Golden-angle spiral: a pleasant, collision-free starting spread.
                const angle = index * 2.399963;
                const radius = 42 * Math.sqrt(index + 1) + 40;
                x = Math.cos(angle) * radius;
                y = Math.sin(angle) * radius;
            }
            const item = {
                id: node.id,
                ref: node,
                x,
                y,
                dx: 0,
                dy: 0,
                r: radiusBase,
                deg: 0,
                accent: '#ff8ac4',
                visible: true,
            };
            if (typeof node.born === 'number') this.noteReveal(node.born);
            items.push(item);
            byId.set(node.id, item);
        });

        const links = [];
        for (const edge of edges) {
            const a = byId.get(edge.a);
            const b = byId.get(edge.b);
            if (!a || !b || a === b) continue;
            a.deg++;
            b.deg++;
            links.push({ ref: edge, a, b });
            if (typeof edge.born === 'number') this.noteReveal(edge.born);
        }

        for (const item of items) {
            item.r = radiusBase * (0.86 + Math.min(item.deg, 6) * 0.045);
            const type = dominantType(item.id);
            item.accent = item.ref.color || (type ? REL_META[type].color : '#ff8ac4');
        }

        // A rebuild during a drag must not leave the pointer holding a stale item.
        if (this.drag) {
            const replacement = byId.get(this.drag.item.id);
            if (replacement) this.drag.item = replacement;
            else this.drag = null;
        }

        this.items = items;
        this.links = links;
        this.byId = byId;
        this.applyFilters();
        this.requestRender();
    }

    applyFilters() {
        const filters = this.options.filters;
        for (const link of this.links) {
            link.visible = filters[link.ref.type] !== false;
        }
        for (const item of this.items) {
            item.visibleDeg = 0;
        }
        for (const link of this.links) {
            if (!link.visible) continue;
            link.a.visibleDeg++;
            link.b.visibleDeg++;
        }
        for (const item of this.items) {
            item.visible = filters.orphans !== false || item.visibleDeg > 0;
        }
        this.requestRender();
    }

    /* ------------------------------------------------------------- viewport */

    resize() {
        // clientWidth/Height are layout sizes, unaffected by the opening
        // transform - getBoundingClientRect would report the scaled box.
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.max(1, this.canvas.clientWidth || rect.width);
        const height = Math.max(1, this.canvas.clientHeight || rect.height);
        const cap = this.options.lite ? 1.75 : 2.5;
        const dpr = Math.min(window.devicePixelRatio || 1, cap);
        this.w = width;
        this.h = height;
        this.dpr = dpr;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.buildBackdrop();
        this.requestRender();
    }

    buildBackdrop() {
        const w = Math.max(1, Math.round(this.w));
        const h = Math.max(1, Math.round(this.h));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext('2d');

        c.fillStyle = '#0a0409';
        c.fillRect(0, 0, w, h);

        const haze = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.72);
        haze.addColorStop(0, 'rgba(120, 12, 58, 0.55)');
        haze.addColorStop(0.45, 'rgba(70, 8, 38, 0.32)');
        haze.addColorStop(1, 'rgba(8, 3, 8, 0)');
        c.fillStyle = haze;
        c.fillRect(0, 0, w, h);

        const bloom = c.createRadialGradient(w * 0.2, h * 0.86, 0, w * 0.2, h * 0.86, Math.max(w, h) * 0.5);
        bloom.addColorStop(0, 'rgba(255, 45, 120, 0.16)');
        bloom.addColorStop(1, 'rgba(255, 45, 120, 0)');
        c.fillStyle = bloom;
        c.fillRect(0, 0, w, h);

        // A faint HUD grid, the way the poster frames its panels.
        c.strokeStyle = 'rgba(255, 150, 200, 0.05)';
        c.lineWidth = 1;
        const step = 56;
        c.beginPath();
        for (let x = step; x < w; x += step) {
            c.moveTo(Math.round(x) + 0.5, 0);
            c.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = step; y < h; y += step) {
            c.moveTo(0, Math.round(y) + 0.5);
            c.lineTo(w, Math.round(y) + 0.5);
        }
        c.stroke();

        const vignette = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
        c.fillStyle = vignette;
        c.fillRect(0, 0, w, h);

        this.backdrop = canvas;
    }

    toWorld(sx, sy) {
        return {
            x: (sx - this.view.x) / this.view.k,
            y: (sy - this.view.y) / this.view.k,
        };
    }

    fit(padding = 70) {
        const visible = this.items.filter(i => i.visible);
        if (!visible.length) {
            this.view = { x: this.w / 2, y: this.h / 2, k: 1 };
            this.requestRender();
            return;
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const item of visible) {
            minX = Math.min(minX, item.x - item.r);
            minY = Math.min(minY, item.y - item.r);
            maxX = Math.max(maxX, item.x + item.r);
            maxY = Math.max(maxY, item.y + item.r);
        }
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const k = Math.min(
            (this.w - padding * 2) / width,
            (this.h - padding * 2) / height,
            1.6,
        );
        this.view.k = Math.max(0.15, k);
        this.view.x = this.w / 2 - ((minX + maxX) / 2) * this.view.k;
        this.view.y = this.h / 2 - ((minY + maxY) / 2) * this.view.k;
        this.requestRender();
    }

    focus(id, zoom = 1.25) {
        const item = this.byId.get(id);
        if (!item) return;
        this.view.k = Math.max(this.view.k, zoom);
        this.view.x = this.w / 2 - item.x * this.view.k;
        this.view.y = this.h / 2 - item.y * this.view.k;
        this.requestRender();
    }

    relayout() {
        for (const item of this.items) {
            if (item.ref.pinned) continue;
            const angle = Math.random() * TAU;
            const radius = 60 + Math.random() * 220;
            item.x = Math.cos(angle) * radius;
            item.y = Math.sin(angle) * radius;
        }
        this.alpha = 1;
        this.pendingSave = true;
        this.autoFitOnSettle = true;
        this.requestRender();
    }

    /* ------------------------------------------------------------- selection */

    select(selection, notify = true) {
        this.selection = selection;
        this.requestRender();
        if (notify) this.onSelect(selection);
    }

    isRelated(link) {
        const selection = this.selection;
        if (!selection) return true;
        if (selection.type === 'edge') return link.ref.id === selection.id;
        return link.ref.a === selection.id || link.ref.b === selection.id;
    }

    isNodeRelated(item) {
        const selection = this.selection;
        if (!selection) return true;
        if (selection.type === 'node') {
            if (item.id === selection.id) return true;
            return this.links.some(l => l.visible
                && ((l.ref.a === selection.id && l.ref.b === item.id)
                    || (l.ref.b === selection.id && l.ref.a === item.id)));
        }
        const edge = this.links.find(l => l.ref.id === selection.id);
        return !!edge && (edge.a === item || edge.b === item);
    }

    /* --------------------------------------------------------------- physics */

    tick() {
        const items = this.items.filter(i => i.visible);
        const n = items.length;
        if (!n) {
            this.alpha = 0;
            return;
        }
        const k = 150;
        // Coulomb-style falloff (1/d^2): firm up close, negligible far away.
        // A slower falloff pushes loosely connected souls off the board.
        const repulsion = k * k * 78;
        const alpha = this.alpha;

        for (const item of items) {
            item.dx = 0;
            item.dy = 0;
        }

        if (n > 120) this.repelGrid(items, repulsion, k);
        else this.repelAll(items, repulsion);

        for (const link of this.links) {
            if (!link.visible || !link.a.visible || !link.b.visible) continue;
            const meta = REL_META[link.ref.type] || REL_META.friendly;
            const strength = (link.ref.strength || 50) / 100;
            const grown = edgeProgress(link.ref) / 100;
            // A bond still forming holds the two of them further apart and pulls
            // more weakly, so the board visibly tightens as the story goes on.
            const rest = meta.rest * (1.25 - strength * 0.45) * (1.3 - grown * 0.3);
            const dx = link.b.x - link.a.x;
            const dy = link.b.y - link.a.y;
            const dist = Math.hypot(dx, dy) || 0.01;
            const force = (dist - rest) * 2.5 * (0.6 + strength * 0.6) * (0.4 + grown * 0.6);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            link.a.dx += fx;
            link.a.dy += fy;
            link.b.dx -= fx;
            link.b.dy -= fy;
        }

        // Gravity keeps the board centred; lonely souls are pulled a bit harder
        // so they do not drift off screen.
        for (const item of items) {
            const pull = item.visibleDeg > 0 ? 0.18 : 0.42;
            item.dx -= item.x * pull;
            item.dy -= item.y * pull;
        }

        const maxStep = 26 * alpha + 1;
        for (const item of items) {
            if (item.ref.pinned || item === this.drag?.item) continue;
            const len = Math.hypot(item.dx, item.dy);
            if (len < 0.0001) continue;
            const step = Math.min(len, maxStep);
            item.x += (item.dx / len) * step;
            item.y += (item.dy / len) * step;
            item.ref.x = Math.round(item.x * 10) / 10;
            item.ref.y = Math.round(item.y * 10) / 10;
        }

        this.alpha *= COOLING;
        if (this.alpha <= ALPHA_MIN) {
            this.alpha = 0;
            if (this.pendingSave) {
                this.pendingSave = false;
                this.onPositions();
            }
            if (this.autoFitOnSettle) {
                this.autoFitOnSettle = false;
                this.fit();
            }
        }
    }

    repelAll(items, repulsion) {
        const n = items.length;
        for (let i = 0; i < n; i++) {
            const a = items[i];
            for (let j = i + 1; j < n; j++) {
                const b = items[j];
                this.repelPair(a, b, repulsion);
            }
        }
    }

    /** Neighbourhood-only repulsion, used once the board grows large. */
    repelGrid(items, repulsion, k) {
        const cell = k * 1.7;
        const grid = new Map();
        for (const item of items) {
            const cx = Math.floor(item.x / cell);
            const cy = Math.floor(item.y / cell);
            const key = cx + ',' + cy;
            let bucket = grid.get(key);
            if (!bucket) grid.set(key, (bucket = []));
            bucket.push(item);
        }
        for (const item of items) {
            const cx = Math.floor(item.x / cell);
            const cy = Math.floor(item.y / cell);
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const bucket = grid.get((cx + ox) + ',' + (cy + oy));
                    if (!bucket) continue;
                    for (const other of bucket) {
                        if (other === item) continue;
                        this.repelPair(item, other, repulsion, true);
                    }
                }
            }
        }
    }

    repelPair(a, b, repulsion, oneSided = false) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            dist = Math.hypot(dx, dy) || 0.01;
        }
        let force = repulsion / (dist * dist);
        const touch = a.r + b.r + 20;
        if (dist < touch) force += (touch - dist) * 22;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.dx -= fx;
        a.dy -= fy;
        if (!oneSided) {
            b.dx += fx;
            b.dy += fy;
        }
    }

    /* ---------------------------------------------------------------- render */

    animating() {
        if (!this.options.animations || this.options.lite) return false;
        if (this.now < this.revealUntil) return true;
        return this.links.some(l => l.visible) || !!this.selection;
    }

    loop(timestamp) {
        this.raf = requestAnimationFrame(this.loop);
        this.now = Date.now();
        const dt = this.last ? Math.min(0.05, (timestamp - this.last) / 1000) : 0.016;
        this.last = timestamp;
        this.time += dt;

        let needsRender = this.dirty;
        if (this.alpha > 0) {
            this.tick();
            needsRender = true;
            // Keep the camera on the layout while it spreads out, so the board
            // never settles half off-screen.
            if (this.autoFitOnSettle && ++this.fitClock % 8 === 0) this.fit();
        }
        if (this.animating()) needsRender = true;

        if (needsRender) {
            this.render();
            this.dirty = false;
            this.idle = 0;
        } else if (++this.idle > 20) {
            // Nothing moves and nothing pulses: park the loop to save battery.
            this.stop();
        }
    }

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        this.now = Date.now();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.w, this.h);
        if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, this.w, this.h);

        ctx.save();
        ctx.translate(this.view.x, this.view.y);
        ctx.scale(this.view.k, this.view.k);

        for (const link of this.links) {
            if (link.visible && link.a.visible && link.b.visible) this.drawEdge(link);
        }
        for (const item of this.items) {
            if (item.visible) this.drawNode(item);
        }

        ctx.restore();
    }

    edgeGeometry(link) {
        const ax = link.a.x;
        const ay = link.a.y;
        const bx = link.b.x;
        const by = link.b.y;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        if (!this.options.curved) return { ax, ay, bx, by, cx: mx, cy: my };
        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.hypot(dx, dy) || 1;
        const bend = Math.min(dist * 0.13, 46);
        return {
            ax,
            ay,
            bx,
            by,
            cx: mx + (-dy / dist) * bend,
            cy: my + (dx / dist) * bend,
        };
    }

    /**
     * The curve of a bond, optionally cut short at `t`.
     *
     * A bond that the story is still writing does not reach the other side yet:
     * it is drawn as the piece of the curve it has earned so far, with the rest
     * left as a faint trace. Splitting the quadratic with de Casteljau keeps the
     * partial curve exactly on top of the full one.
     */
    edgePath(g, t) {
        const path = new Path2D();
        path.moveTo(g.ax, g.ay);
        if (t >= 0.999) {
            path.quadraticCurveTo(g.cx, g.cy, g.bx, g.by);
            return { path, tip: { x: g.bx, y: g.by } };
        }
        const cx = g.ax + (g.cx - g.ax) * t;
        const cy = g.ay + (g.cy - g.ay) * t;
        const tip = quad(g, t);
        path.quadraticCurveTo(cx, cy, tip.x, tip.y);
        return { path, tip };
    }

    drawEdge(link) {
        const ctx = this.ctx;
        const meta = REL_META[link.ref.type] || REL_META.friendly;
        const related = this.isRelated(link);
        const born = this.revealFactor(link.ref.born);
        const fade = (related ? 1 : 0.13) * born;
        const strength = (link.ref.strength || 50) / 100;
        const grown = edgeProgress(link.ref) / 100;
        // Even a first spark reaches a third of the way, so it always reads as
        // "these two", never as a stray line going nowhere. The line closes the
        // gap exactly when the bond counts as settled; after that it only keeps
        // getting brighter.
        const span = Math.min(1, grown / FULL_AT);
        const reach = Math.min(1, (MIN_REACH + (1 - MIN_REACH) * span) * born);
        const width = meta.width * (0.62 + strength * 0.85) * (0.55 + grown * 0.45);
        const g = this.edgeGeometry(link);
        const { path, tip } = this.edgePath(g, reach);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // The road not yet travelled: where the bond will go once it settles.
        if (reach < 0.995) {
            const full = new Path2D();
            full.moveTo(g.ax, g.ay);
            full.quadraticCurveTo(g.cx, g.cy, g.bx, g.by);
            ctx.setLineDash([2, 9]);
            ctx.lineDashOffset = 0;
            ctx.strokeStyle = withAlpha(meta.color, 0.16 * fade);
            ctx.lineWidth = 1;
            ctx.stroke(full);
            ctx.setLineDash([]);
        }

        if (!this.options.lite) {
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            ctx.strokeStyle = withAlpha(meta.glow, 0.13 * fade * (0.4 + grown * 0.6));
            ctx.lineWidth = width * 4.2;
            ctx.stroke(path);
        }

        ctx.setLineDash(meta.dash || []);
        if (meta.dash && this.options.animations && !this.options.lite && related) {
            ctx.lineDashOffset = -this.time * 16;
        } else {
            ctx.lineDashOffset = 0;
        }
        ctx.strokeStyle = withAlpha(meta.color, (0.5 + strength * 0.5) * fade * (0.45 + grown * 0.55));
        ctx.lineWidth = width;
        ctx.stroke(path);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // A heartbeat travelling along romantic bonds.
        if (link.ref.type === 'love' && this.options.animations && !this.options.lite && related) {
            const length = Math.hypot(g.bx - g.ax, g.by - g.ay) + 40;
            const period = length + 260;
            const seed = (link.ref.id.charCodeAt(2) || 7) * 37;
            ctx.setLineDash([16, period]);
            ctx.lineDashOffset = -((this.time * 90 + seed) % period);
            ctx.strokeStyle = withAlpha('#ffe4f1', 0.85 * fade);
            ctx.lineWidth = width * 0.7;
            ctx.stroke(path);
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }

        // The growing end glows: this is the bond still being written.
        if (reach < 0.995 && related) {
            const pulse = this.options.animations && !this.options.lite
                ? 0.65 + Math.sin(this.time * 3.2 + (link.ref.id.charCodeAt(2) || 3)) * 0.35
                : 1;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, (2.4 + width * 0.5) * pulse, 0, TAU);
            ctx.fillStyle = withAlpha(meta.glow, 0.9 * fade);
            ctx.fill();
        }

        if (link.ref.dir !== 'both' && reach > 0.9) {
            const forward = link.ref.dir === 'a2b';
            const target = forward ? link.b : link.a;
            const control = { x: g.cx, y: g.cy };
            const from = forward ? { x: g.ax, y: g.ay } : { x: g.bx, y: g.by };
            this.drawArrow(from, control, target, meta.color, fade, width);
        }

        const selected = this.selection?.type === 'edge' && this.selection.id === link.ref.id;
        if (selected && link.ref.note) {
            this.drawTag(link.ref.note, g.cx, g.cy, meta.color);
        }
    }

    drawArrow(from, control, target, color, fade, width) {
        const ctx = this.ctx;
        // Walk back from the node edge along the curve for a clean arrow tip.
        const t = 0.82;
        const point = {
            x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * control.x + t * t * target.x,
            y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * control.y + t * t * target.y,
        };
        const angle = Math.atan2(target.y - point.y, target.x - point.x);
        const tipX = target.x - Math.cos(angle) * (target.r + 5);
        const tipY = target.y - Math.sin(angle) * (target.r + 5);
        const size = 7 + width;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(angle - 0.42) * size, tipY - Math.sin(angle - 0.42) * size);
        ctx.lineTo(tipX - Math.cos(angle + 0.42) * size, tipY - Math.sin(angle + 0.42) * size);
        ctx.closePath();
        ctx.fillStyle = withAlpha(color, 0.9 * fade);
        ctx.fill();
    }

    drawTag(text, x, y, color) {
        const ctx = this.ctx;
        const label = text.length > 28 ? text.slice(0, 27) + '…' : text;
        ctx.font = '600 11px ui-monospace, "JetBrains Mono", Consolas, monospace';
        const width = ctx.measureText(label).width + 14;
        const height = 19;
        roundRect(ctx, x - width / 2, y - height / 2, width, height, 4);
        ctx.fillStyle = 'rgba(10, 3, 10, 0.88)';
        ctx.fill();
        ctx.strokeStyle = withAlpha(color, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffe9f3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 0.5);
    }

    drawNode(item) {
        const ctx = this.ctx;
        const selected = this.selection?.type === 'node' && this.selection.id === item.id;
        const related = this.isNodeRelated(item);
        const born = this.revealFactor(item.ref.born);
        const fade = (related ? 1 : 0.22) * born;
        const accent = item.accent;
        const hovered = this.hoverId === item.id;
        // A soul the story just brought in swells into place.
        const r = item.r * (selected ? 1.1 : hovered ? 1.05 : 1) * (0.55 + born * 0.45);

        if (born < 1) {
            ctx.beginPath();
            ctx.arc(item.x, item.y, r + 10 + (1 - born) * 26, 0, TAU);
            ctx.strokeStyle = withAlpha(accent, 0.5 * (1 - born));
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (!this.options.lite) {
            ctx.beginPath();
            ctx.arc(item.x, item.y, r + 6, 0, TAU);
            ctx.strokeStyle = withAlpha(accent, 0.16 * fade);
            ctx.lineWidth = 11;
            ctx.stroke();
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, TAU);
        ctx.fillStyle = 'rgba(22, 8, 17, 0.95)';
        ctx.fill();

        const image = this.options.avatars ? this.images.get(item.ref) : null;
        if (image) {
            ctx.save();
            ctx.clip();
            ctx.globalAlpha = fade;
            const size = r * 2;
            const ratio = image.naturalWidth / image.naturalHeight || 1;
            let dw = size;
            let dh = size;
            if (ratio > 1) dw = size * ratio;
            else dh = size / ratio;
            ctx.drawImage(image, item.x - dw / 2, item.y - dh / 2, dw, dh);
            ctx.restore();
        } else {
            const initials = (item.ref.name || '?').trim().slice(0, 2).toUpperCase();
            ctx.fillStyle = withAlpha(accent, 0.18 * fade);
            ctx.fill();
            ctx.fillStyle = withAlpha('#ffe9f3', 0.86 * fade);
            ctx.font = `700 ${Math.round(r * 0.72)}px "Trebuchet MS", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initials, item.x, item.y + 1);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, TAU);
        ctx.strokeStyle = withAlpha(accent, (selected ? 1 : 0.8) * fade);
        ctx.lineWidth = selected ? 3 : 2;
        if (item.ref.missing) ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (item.ref.pinned) {
            ctx.beginPath();
            ctx.arc(item.x + r * 0.72, item.y - r * 0.72, 3.4, 0, TAU);
            ctx.fillStyle = withAlpha('#ffe9f3', 0.9 * fade);
            ctx.fill();
        }

        if (selected) {
            const spin = this.options.animations && !this.options.lite ? this.time * 0.9 : 0;
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(spin);
            ctx.beginPath();
            ctx.arc(0, 0, r + 9, 0, TAU);
            ctx.setLineDash([3, 7]);
            ctx.strokeStyle = withAlpha('#ffe9f3', 0.65);
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();
            ctx.setLineDash([]);
        }

        if (this.options.labels && (this.view.k > 0.45 || selected)) {
            const name = item.ref.name || '';
            const label = name.length > 18 ? name.slice(0, 17) + '…' : name;
            ctx.font = '600 12px "Trebuchet MS", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const width = ctx.measureText(label).width + 12;
            const y = item.y + r + 13;
            roundRect(ctx, item.x - width / 2, y - 9, width, 18, 9);
            ctx.fillStyle = `rgba(9, 3, 9, ${0.72 * fade})`;
            ctx.fill();
            ctx.fillStyle = withAlpha(item.ref.kind === 'persona' ? '#ffd1e6' : '#ffe9f3', 0.94 * fade);
            ctx.fillText(label, item.x, y + 0.5);
        }
    }

    /* ------------------------------------------------------------ hit-testing */

    nodeAt(sx, sy) {
        const point = this.toWorld(sx, sy);
        const slack = 8 / this.view.k;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (!item.visible) continue;
            if (Math.hypot(item.x - point.x, item.y - point.y) <= item.r + slack) return item;
        }
        return null;
    }

    edgeAt(sx, sy) {
        const point = this.toWorld(sx, sy);
        const threshold = 12 / this.view.k;
        let best = null;
        let bestDist = threshold;
        for (const link of this.links) {
            if (!link.visible || !link.a.visible || !link.b.visible) continue;
            const g = this.edgeGeometry(link);
            for (let i = 0; i < 12; i++) {
                const t0 = i / 12;
                const t1 = (i + 1) / 12;
                const p0 = quad(g, t0);
                const p1 = quad(g, t1);
                const dist = distanceToSegment(point, p0, p1);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = link;
                }
            }
        }
        return best;
    }

    /* --------------------------------------------------------------- pointer */

    bindPointer() {
        const canvas = this.canvas;
        const onDown = e => this.handleDown(e);
        const onMove = e => this.handleMove(e);
        const onUp = e => this.handleUp(e);
        const onWheel = e => this.handleWheel(e);
        const onLeave = () => {
            if (this.hoverId) {
                this.hoverId = null;
                this.requestRender();
            }
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        this.unbindPointer = () => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('pointerleave', onLeave);
            canvas.removeEventListener('wheel', onWheel);
        };
    }

    localPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    handleDown(e) {
        // Touching the board hands the camera back to the user.
        this.autoFitOnSettle = false;
        this.canvas.setPointerCapture?.(e.pointerId);
        const point = this.localPoint(e);
        this.pointers.set(e.pointerId, point);

        if (this.pointers.size === 2) {
            const [p1, p2] = [...this.pointers.values()];
            this.pinch = {
                dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
                k: this.view.k,
                center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
                view: { ...this.view },
            };
            this.drag = null;
            this.pan = null;
            return;
        }

        const item = this.nodeAt(point.x, point.y);
        if (item) {
            const world = this.toWorld(point.x, point.y);
            this.drag = {
                item,
                offsetX: item.x - world.x,
                offsetY: item.y - world.y,
                moved: false,
                start: point,
            };
        } else {
            this.pan = { start: point, view: { ...this.view }, moved: false };
        }
    }

    handleMove(e) {
        const point = this.localPoint(e);
        if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, point);

        if (this.pinch && this.pointers.size >= 2) {
            const [p1, p2] = [...this.pointers.values()];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
            const scale = dist / (this.pinch.dist || 1);
            const k = Math.max(0.15, Math.min(3, this.pinch.k * scale));
            const center = this.pinch.center;
            const ratio = k / this.pinch.view.k;
            this.view.k = k;
            this.view.x = center.x - (center.x - this.pinch.view.x) * ratio;
            this.view.y = center.y - (center.y - this.pinch.view.y) * ratio;
            this.requestRender();
            return;
        }

        if (this.drag) {
            const world = this.toWorld(point.x, point.y);
            this.drag.item.x = world.x + this.drag.offsetX;
            this.drag.item.y = world.y + this.drag.offsetY;
            this.drag.item.ref.x = this.drag.item.x;
            this.drag.item.ref.y = this.drag.item.y;
            if (Math.hypot(point.x - this.drag.start.x, point.y - this.drag.start.y) > 4) {
                this.drag.moved = true;
                this.alpha = Math.max(this.alpha, 0.24);
                this.pendingSave = true;
            }
            this.requestRender();
            return;
        }

        if (this.pan) {
            const dx = point.x - this.pan.start.x;
            const dy = point.y - this.pan.start.y;
            if (Math.hypot(dx, dy) > 4) this.pan.moved = true;
            this.view.x = this.pan.view.x + dx;
            this.view.y = this.pan.view.y + dy;
            this.requestRender();
            return;
        }

        if (e.pointerType === 'mouse') {
            const item = this.nodeAt(point.x, point.y);
            const id = item?.id || null;
            if (id !== this.hoverId) {
                this.hoverId = id;
                this.canvas.style.cursor = id ? 'pointer' : 'grab';
                this.requestRender();
            }
        }
    }

    handleUp(e) {
        const point = this.localPoint(e);
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;

        if (this.drag) {
            const drag = this.drag;
            this.drag = null;
            if (!drag.moved) {
                this.handleTap(point, drag.item);
            } else {
                this.pendingSave = true;
                this.onPositions();
            }
            this.requestRender();
            return;
        }

        if (this.pan) {
            const moved = this.pan.moved;
            this.pan = null;
            if (!moved) this.handleTap(point, null);
        }
    }

    handleTap(point, item) {
        const now = performance.now();
        const isDouble = now - this.lastTap < 320;
        this.lastTap = now;

        if (item) {
            if (isDouble) {
                this.onOpen({ type: 'node', id: item.id });
                return;
            }
            this.select({ type: 'node', id: item.id });
            return;
        }

        const link = this.edgeAt(point.x, point.y);
        if (link) {
            if (isDouble) {
                this.onOpen({ type: 'edge', id: link.ref.id });
                return;
            }
            this.select({ type: 'edge', id: link.ref.id });
            return;
        }

        if (isDouble) {
            this.fit();
            return;
        }
        this.select(null);
    }

    handleWheel(e) {
        e.preventDefault();
        this.autoFitOnSettle = false;
        const point = this.localPoint(e);
        const factor = Math.exp(-e.deltaY * 0.0016);
        const k = Math.max(0.15, Math.min(3, this.view.k * factor));
        const ratio = k / this.view.k;
        this.view.x = point.x - (point.x - this.view.x) * ratio;
        this.view.y = point.y - (point.y - this.view.y) * ratio;
        this.view.k = k;
        this.requestRender();
    }

    zoomBy(factor) {
        const k = Math.max(0.15, Math.min(3, this.view.k * factor));
        const ratio = k / this.view.k;
        const cx = this.w / 2;
        const cy = this.h / 2;
        this.view.x = cx - (cx - this.view.x) * ratio;
        this.view.y = cy - (cy - this.view.y) * ratio;
        this.view.k = k;
        this.requestRender();
    }
}

function quad(g, t) {
    const inv = 1 - t;
    return {
        x: inv * inv * g.ax + 2 * inv * t * g.cx + t * t * g.bx,
        y: inv * inv * g.ay + 2 * inv * t * g.cy + t * t * g.by,
    };
}

function distanceToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
