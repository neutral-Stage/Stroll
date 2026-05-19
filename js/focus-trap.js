/**
 * focus-trap.js — keep keyboard focus inside modal overlays
 * @module focus-trap
 */

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** @type {HTMLElement|null} */
let trappedContainer = null;
/** @type {HTMLElement|null} */
let previousFocus = null;
/** @type {function(KeyboardEvent): void|null} */
let keyHandler = null;

/**
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        return el.offsetParent !== null || el === document.activeElement;
    });
}

/**
 * Trap Tab navigation inside a modal container.
 * @param {HTMLElement} container
 */
export function activateFocusTrap(container) {
    if (!container) return;
    deactivateFocusTrap();

    trappedContainer = container;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    keyHandler = (e) => {
        if (e.key !== 'Tab' || !trappedContainer) return;

        const nodes = getFocusableElements(trappedContainer);
        if (nodes.length === 0) {
            e.preventDefault();
            return;
        }

        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    container.addEventListener('keydown', keyHandler);

    requestAnimationFrame(() => {
        const nodes = getFocusableElements(container);
        if (nodes.length > 0) {
            nodes[0].focus();
        } else if (!container.hasAttribute('tabindex')) {
            container.setAttribute('tabindex', '-1');
            container.focus();
        }
    });
}

/** Release trap and restore focus to the element that had it before. */
export function deactivateFocusTrap() {
    if (trappedContainer && keyHandler) {
        trappedContainer.removeEventListener('keydown', keyHandler);
    }
    trappedContainer = null;
    keyHandler = null;

    if (previousFocus && typeof previousFocus.focus === 'function') {
        try {
            previousFocus.focus();
        } catch {
            // element may have been removed
        }
    }
    previousFocus = null;
}

export function isFocusTrapActive() {
    return trappedContainer !== null;
}
