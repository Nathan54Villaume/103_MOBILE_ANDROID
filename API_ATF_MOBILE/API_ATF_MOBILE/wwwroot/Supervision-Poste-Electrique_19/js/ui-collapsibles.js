import { getBoolean, setBoolean } from './storage.js';
import { bindHoverTooltip } from './ui-tooltips.js';

const STORAGE_PREFIX = 'collapsible:';
const TOOLTIP_DELAY = 600;

function buildStorageKey(id) {
    return `${STORAGE_PREFIX}${id}`;
}

function fireChange(element, detail) {
    element.dispatchEvent(new CustomEvent('collapsible:change', {
        bubbles: true,
        detail
    }));
}

function decorateContents(element, contents, expanded, idBase) {
    let primaryPanelId = '';
    contents.forEach((content, index) => {
        if (!content.dataset.collapsibleSetup) {
            content.dataset.collapsibleSetup = 'true';
            content.style.overflow = 'hidden';
            content.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
        }
        if (!content.id) {
            const safeBase = idBase || element.id || 'collapsible';
            content.id = `${safeBase}-panel-${index}`;
        }
        if (!primaryPanelId) primaryPanelId = content.id;
        content.style.maxHeight = expanded ? 'none' : '0px';
        content.style.opacity = expanded ? '1' : '0';
    });
    return primaryPanelId;
}

function animateContent(element, content, expanded) {
    if (expanded) {
        content.style.maxHeight = `${content.scrollHeight}px`;
        content.style.opacity = '1';
        const onEnd = () => {
            if (element.dataset.collapsibleExpanded === 'true') {
                content.style.maxHeight = 'none';
            }
            content.removeEventListener('transitionend', onEnd);
        };
        content.addEventListener('transitionend', onEnd);
    } else {
        const current = content.getBoundingClientRect().height;
        content.style.maxHeight = `${current}px`;
        content.style.opacity = '1';
        requestAnimationFrame(() => {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
        });
    }
}

function setExpandedState(element, contents, trigger, id, type, expanded, { save = true, reason = 'toggle', init = false } = {}) {
    const idBase = id || element.id || '';
    if (!element.dataset.collapsibleInitDecorated) {
        const primaryId = decorateContents(element, contents, expanded, idBase);
        if (trigger && primaryId) trigger.setAttribute('aria-controls', primaryId);
        element.dataset.collapsibleInitDecorated = 'true';
    }

    element.dataset.collapsibleExpanded = expanded ? 'true' : 'false';
    if (trigger) {
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    contents.forEach((content) => animateContent(element, content, expanded));

    if (save && id) setBoolean(buildStorageKey(id), expanded);

    fireChange(element, { id, expanded, type, element, reason, init });
}

function setupTrigger(element, trigger, contents, id, type) {
    if (!trigger) return;
    if (!trigger.getAttribute('role')) trigger.setAttribute('role', 'button');
    if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
    trigger.classList.add('collapsible-trigger');

    const toggle = (evt) => {
        if (evt) evt.preventDefault();
        const expanded = element.dataset.collapsibleExpanded !== 'false';
        setExpandedState(element, contents, trigger, id, type, !expanded, { reason: 'user' });
    };

    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            toggle(evt);
        }
    });

    bindHoverTooltip(trigger, 'Cliquer pour ouvrir/fermer', TOOLTIP_DELAY);
}

function setupCollapsible(element) {
    const id = element.dataset.collapsibleId;
    if (!id || element.dataset.collapsibleInit === 'true') return;
    element.dataset.collapsibleInit = 'true';
    const type = element.dataset.collapsibleType || 'panel';
    const trigger = element.querySelector('[data-collapsible-trigger]') || element.firstElementChild;
    const contents = Array.from(element.querySelectorAll('[data-collapsible-content]')).filter((content) => content.closest('[data-collapsible-id]') === element);
    if (!trigger || contents.length === 0) return;

    setupTrigger(element, trigger, contents, id, type);

    const stored = getBoolean(buildStorageKey(id), true);
    setExpandedState(element, contents, trigger, id, type, stored, { save: false, reason: 'init', init: true });
}

export function initCollapsibles(root = document) {
    root.querySelectorAll('[data-collapsible-id]').forEach(setupCollapsible);
}
