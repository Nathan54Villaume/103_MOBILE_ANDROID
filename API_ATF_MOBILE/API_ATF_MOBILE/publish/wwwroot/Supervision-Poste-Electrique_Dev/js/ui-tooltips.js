const DEFAULT_DELAY = 600;

function resolveMessage(message, ctx) {
    if (typeof message === 'function') {
        try {
            return message(ctx);
        } catch (err) {
            console.warn('[tooltip] message resolver error', err);
            return '';
        }
    }
    return message ?? '';
}

function applyTooltipState(target, text) {
    if (!target) return;
    if (text) {
        target.setAttribute('data-tooltip', text);
        target.setAttribute('data-tooltip-active', 'true');
    } else {
        target.removeAttribute('data-tooltip');
        target.removeAttribute('data-tooltip-active');
    }
}

export function bindHoverTooltip(target, message, delay = DEFAULT_DELAY) {
    if (!target) return () => {};
    target.dataset.hasTooltip = 'true';

    let timer = null;

    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const hide = () => {
        clearTimer();
        applyTooltipState(target, '');
    };

    const show = () => {
        clearTimer();
        timer = setTimeout(() => {
            const text = resolveMessage(message, target);
            if (text) applyTooltipState(target, text);
        }, delay);
    };

    const events = [
        ['pointerenter', show],
        ['pointerleave', hide],
        ['pointercancel', hide],
        ['focus', show],
        ['blur', hide],
        ['keydown', (evt) => {
            if (evt.key === 'Escape') hide();
        }]
    ];

    events.forEach(([type, handler]) => target.addEventListener(type, handler));

    return () => {
        hide();
        events.forEach(([type, handler]) => target.removeEventListener(type, handler));
    };
}

export function tooltipController(target, delay = DEFAULT_DELAY) {
    let disposer = () => {};
    return {
        update(message) {
            disposer();
            disposer = bindHoverTooltip(target, message, delay);
        },
        dispose() {
            disposer();
        }
    };
}
