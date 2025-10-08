const PREFIX = 'spe:';

function safeStorage() {
    try {
        return window.localStorage;
    } catch (err) {
        console.warn('[storage] localStorage inaccessible', err);
        return null;
    }
}

function fullKey(key) {
    return `${PREFIX}${key}`;
}

function read(key) {
    const store = safeStorage();
    if (!store) return null;
    try {
        return store.getItem(fullKey(key));
    } catch (err) {
        console.warn('[storage] read error', err);
        return null;
    }
}

function write(key, value) {
    const store = safeStorage();
    if (!store) return;
    try {
        if (value === null || value === undefined) {
            store.removeItem(fullKey(key));
        } else {
            store.setItem(fullKey(key), String(value));
        }
    } catch (err) {
        console.warn('[storage] write error', err);
    }
}

export function getString(key, fallback = '') {
    const raw = read(key);
    return raw === null ? fallback : raw;
}

export function setString(key, value) {
    write(key, value ?? null);
}

export function getBoolean(key, fallback = false) {
    const raw = read(key);
    if (raw === null) return fallback;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return fallback;
}

export function setBoolean(key, value) {
    write(key, value ? '1' : '0');
}

export function getNumber(key, fallback = null) {
    const raw = read(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function setNumber(key, value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        write(key, null);
    } else {
        write(key, String(value));
    }
}

export function getJson(key, fallback = null) {
    const raw = read(key);
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[storage] JSON parse error', err);
        return fallback;
    }
}

export function setJson(key, value) {
    if (value === undefined) {
        write(key, null);
        return;
    }
    try {
        write(key, JSON.stringify(value));
    } catch (err) {
        console.warn('[storage] JSON stringify error', err);
    }
}

export function remove(key) {
    write(key, null);
}

export function clearKeys(prefix = '') {
    const store = safeStorage();
    if (!store) return;
    try {
        const fullPrefix = PREFIX + prefix;
        const toDelete = [];
        for (let i = 0; i < store.length; i += 1) {
            const key = store.key(i) || '';
            if (key.startsWith(fullPrefix)) toDelete.push(key);
        }
        toDelete.forEach(key => store.removeItem(key));
    } catch (err) {
        console.warn('[storage] clearKeys error', err);
    }
}
