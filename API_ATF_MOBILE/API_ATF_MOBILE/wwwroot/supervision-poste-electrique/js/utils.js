// Utility helpers shared across modules
export const $ = (selector, root = document) => root.querySelector(selector);

export const LOCALE_FR = 'fr-FR';
export const FALLBACK = '\u2014';

export function isNil(value) {
  return value === null || value === undefined;
}

export function isValidNumber(value) {
  if (isNil(value)) return false;
  const num = Number(value);
  return Number.isFinite(num);
}

export function toNumber(value, fallback = null) {
  return isValidNumber(value) ? Number(value) : fallback;
}

export function lowerKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(lowerKeys);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.toLowerCase()] = lowerKeys(value);
  }
  return result;
}

export function fmt(value, digits = 1) {
  if (!isValidNumber(value)) return FALLBACK;
  return Number(value).toLocaleString(LOCALE_FR, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function clamp(value, min, max) {
  if (!isValidNumber(value)) return value;
  return Math.min(Math.max(Number(value), min), max);
}

export function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number' || typeof input === 'string') {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return FALLBACK;
  return date.toLocaleDateString(LOCALE_FR, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  });
}

export function formatTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return FALLBACK;
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  if (options.second === true) {
    timeOptions.second = '2-digit';
  }
  return date.toLocaleTimeString(LOCALE_FR, timeOptions);
}

export function formatDateTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return FALLBACK;
  return date.toLocaleString(LOCALE_FR, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

export function debounce(fn, delay = 150, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let invokedLeading = false;

  const invoke = () => {
    if (!trailing && (!leading || invokedLeading)) return;
    fn.apply(lastThis, lastArgs || []);
    lastArgs = lastThis = null;
    invokedLeading = false;
  };

  const debounced = function (...args) {
    lastArgs = args;
    lastThis = this;

    if (leading && !timer) {
      fn.apply(lastThis, lastArgs);
      invokedLeading = true;
    }

    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      invoke();
    }, delay);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    clearTimeout(timer);
    timer = null;
    invoke();
  };

  return debounced;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const displayFormats = {
  millisecond: 'HH:mm:ss',
  second: 'HH:mm:ss',
  minute: 'HH:mm',
  hour: 'HH:mm',
  day: 'dd/MM',
  week: 'dd/MM',
  month: 'MM/yyyy',
  quarter: 'MM/yyyy',
  year: 'yyyy'
};

export function timeUnitFor(minutes) {
  if (minutes <= 60) return 'minute';
  if (minutes <= 240) return 'hour';
  if (minutes <= 1440) return 'day';
  return 'day';
}

export function frTick(value, options = {}) {
  return formatTime(value, { ...options });
}

export function frTooltip(context) {
  const x = context.raw?.x ?? context.parsed?.x ?? context.label;
  return formatDateTime(x);
}

function resolveTimeoutParams(optionsOrTimeout, maybeTimeout) {
  if (typeof optionsOrTimeout === 'number') {
    return [{}, optionsOrTimeout];
  }
  if (typeof optionsOrTimeout === 'object' && optionsOrTimeout !== null) {
    const { timeoutMs, ...rest } = optionsOrTimeout;
    return [rest, maybeTimeout ?? timeoutMs ?? 5000];
  }
  return [{}, 5000];
}

export async function fetchJSON(url, optionsOrTimeout = {}, maybeTimeout) {
  const [options, timeoutMs] = resolveTimeoutParams(optionsOrTimeout, maybeTimeout);
  const controller = new AbortController();
  const timeout = typeof timeoutMs === 'number' ? timeoutMs : 5000;
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(id);
  }
}

export async function withRetries(fn, { retries = 0, baseDelay = 500, factor = 2 } = {}) {
  let attempt = 0;
  let currentDelay = baseDelay;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(currentDelay);
      currentDelay *= factor;
      attempt += 1;
    }
  }
}
