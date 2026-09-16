/**
 * MyLove Graph - tiny DOM helpers (no jQuery dependency).
 */

/**
 * Creates an element.
 * @param {string} tag tag name, optionally with .classes (e.g. 'div.mlg-row')
 * @param {object} [props] attributes, dataset, style, on* handlers
 * @param {Array|string|Node} [children]
 */
export function el(tag, props = {}, children = []) {
    const [name, ...classes] = tag.split('.');
    const node = document.createElement(name || 'div');
    if (classes.length) node.className = classes.join(' ');

    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') node.className = [node.className, value].filter(Boolean).join(' ');
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'style' && typeof value === 'object') {
            for (const [prop, raw] of Object.entries(value)) {
                if (raw === undefined || raw === null) continue;
                // Custom properties (--mlg-accent) must go through setProperty.
                if (prop.startsWith('--')) node.style.setProperty(prop, String(raw));
                else node.style[prop] = raw;
            }
        }
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key in node && key !== 'list' && typeof value !== 'object') {
            try {
                node[key] = value;
            } catch {
                node.setAttribute(key, value);
            }
        } else {
            node.setAttribute(key, value);
        }
    }

    append(node, children);
    return node;
}

export function append(parent, children) {
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
        if (child === null || child === undefined || child === false) continue;
        parent.appendChild(typeof child === 'string' || typeof child === 'number'
            ? document.createTextNode(String(child))
            : child);
    }
    return parent;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/** Inline SVG icon set - no icon font required, so it works on any ST theme. */
const ICONS = {
    heart: '<path d="M12 21s-7.5-4.7-9.6-9.2C.7 8.3 2.4 4.6 5.9 3.7c2.2-.6 4.4.3 5.6 2.1l.5.8.5-.8c1.2-1.8 3.4-2.7 5.6-2.1 3.5.9 5.2 4.6 3.5 8.1C19.5 16.3 12 21 12 21z"/>',
    heartArrow: '<path d="M12 20.5S5.2 16.2 3.3 12.1C1.7 8.9 3.3 5.6 6.4 4.8c2-.5 4 .3 5.1 1.9l.5.7.5-.7c1.1-1.6 3.1-2.4 5.1-1.9 3.1.8 4.7 4.1 3.1 7.3-1.9 4.1-8.7 8.4-8.7 8.4z"/><path d="M3 21 21 3M15 3h6v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    sync: '<path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17.7 3v3.6h-3.6M6.3 21v-3.6h3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    link: '<path d="M9.5 14.5 14.5 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 7 12.8 5.2a3.8 3.8 0 0 1 5.4 5.4L16.4 12.4M13 17l-1.8 1.8a3.8 3.8 0 0 1-5.4-5.4L7.6 11.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fit: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    shuffle: '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6.5" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.7 8.6 10.9 15.9M16.5 8.3 13.3 15.9M8.2 6.8 15.8 6.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    data: '<ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    globe: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12h16M12 4c2.2 2.3 3.3 5 3.3 8S14.2 17.7 12 20c-2.2-2.3-3.3-5-3.3-8S9.8 6.3 12 4z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    pencil: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    pin: '<path d="M12 17v5M8 3h8l-1.2 6.2 3 3.3H6.2l3-3.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    target: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    zoomIn: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 8.5v5M8.5 11h5M16 16l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    zoomOut: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 11h5M16 16l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    chevron: '<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    group: '<circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="10.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6S14 16 14.5 19M15 15c2.4 0 4.2 1.3 4.7 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

/**
 * Builds an inline SVG icon.
 * @param {keyof ICONS} name
 */
export function icon(name, size = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('mlg-icon');
    // Stroke-only paths declare fill="none" themselves, so a blanket fill is safe.
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = ICONS[name] || ICONS.heart;
    return svg;
}

export function hasIcon(name) {
    return Object.prototype.hasOwnProperty.call(ICONS, name);
}
