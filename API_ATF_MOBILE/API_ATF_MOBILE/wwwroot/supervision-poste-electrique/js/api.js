import { lowerKeys, fetchJSON, withRetries, sleep, toNumber } from './utils.js';
import { state, bufs, MAX_MIN } from './state.js';
import { DEMO_ENABLED, DEMO_LATENCY, DEMO_JITTER } from './config.js';

// Configuration de l'API directe
const API_BASE_URL = window.API_CONFIG?.baseUrl || 'http://10.250.13.4:8088/api/energy';

const SIGNAL_CACHE_TTL = 5 * 60 * 1000;
const SIGNAL_CACHE = new Map();
const SERIES_TIMEOUT_MS = 12_000;
const DAILY_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const RETRY_CONFIG = { retries: 2, baseDelay: 450 }; // retry ~ 0.45s, 0.9s

const DEMO_KEYS = ['p_kw', 'q_kvar', 'pf', 'u12_v', 'u23_v', 'u31_v', 'i1_a', 'i2_a', 'i3_a', 'e_kwh'];

function computeRequestParams(winMin) {
  const minutes = Math.min(Math.max(1, winMin), MAX_MIN);
  let cadenceSec = minutes <= 15 ? 1 : minutes <= 60 ? 4 : minutes <= 240 ? 10 : minutes <= 1440 ? 15 : 20;
  const approxPoints = Math.ceil((minutes * 60) / cadenceSec);
  const target = Math.min(Math.ceil(approxPoints * 1.2), 20_000);
  const timeoutMs = minutes >= 1440 ? SERIES_TIMEOUT_MS : Math.max(SNAPSHOT_TIMEOUT_MS, SERIES_TIMEOUT_MS - 4_000);
  return { minutes, cadenceSec, maxPoints: target, timeoutMs, downsample: minutes > 60 };
}

function buildSeriesUrl(trId, params) {
  const baseUrl = state.apiBase || API_BASE_URL;
  const url = new URL(`${baseUrl}/tr${trId}/series`);
  url.searchParams.set('minutes', String(params.minutes));
  url.searchParams.set('maxPoints', String(params.maxPoints));
  url.searchParams.set('downsample', params.downsample ? 'true' : 'false');
  url.searchParams.set('cadence', String(params.cadenceSec));
  return url.toString();
}

function normPoint(p) {
  const x = p.x ?? p.X ?? p.ts ?? p.time ?? null;
  const y = p.y ?? p.Y ?? p.value ?? null;
  if (!x) return null;
  const ms = new Date(x).getTime();
  if (Number.isNaN(ms)) return null;
  const num = toNumber(y);
  return { x: ms, y: num };
}

function normalizeSeriesDto(dto) {
  const map = lowerKeys(dto || {});
  const extract = (key) => {
    const arr = Array.isArray(map[key]) ? map[key] : [];
    const out = [];
    for (const raw of arr) {
      const point = normPoint(raw);
      if (point) out.push(point);
    }
    return out;
  };
  return {
    p_kw: extract('p_kw'),
    q_kvar: extract('q_kvar'),
    pf: extract('pf'),
    u12_v: extract('u12_v'),
    u23_v: extract('u23_v'),
    u31_v: extract('u31_v'),
    i1_a: extract('i1_a'),
    i2_a: extract('i2_a'),
    i3_a: extract('i3_a'),
    e_kwh: extract('e_kwh'),
  };
}

function resampleZOH(series, cadenceSec) {
  if (!series.length || cadenceSec <= 1) return series;
  const step = cadenceSec * 1000;
  const start = Math.floor(series[0].x / step) * step;
  const end = Math.floor(series[series.length - 1].x / step) * step;
  const out = [];
  let idx = 0;
  let lastVal = series[0].y;
  for (let ts = start; ts <= end; ts += step) {
    while (idx + 1 < series.length && series[idx + 1].x <= ts) {
      idx += 1;
      lastVal = series[idx].y;
    }
    out.push({ x: ts, y: lastVal });
  }
  return out;
}

function alignSeries(raw, cadenceSec) {
  const aligned = {};
  for (const key of DEMO_KEYS) {
    aligned[key] = resampleZOH(raw[key] || [], cadenceSec);
  }
  return aligned;
}

function computeStats(series) {
  const numeric = (series || []).map(p => p.y).filter(v => Number.isFinite(v));
  if (!numeric.length) return { avg: null, max: null, min: null };
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const v of numeric) {
    sum += v;
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return {
    avg: sum / numeric.length,
    max,
    min,
  };
}

function computeDelta(series) {
  if (!series || series.length < 2) return null;
  const first = series.find(p => Number.isFinite(p.y));
  const last = [...series].reverse().find(p => Number.isFinite(p.y));
  if (!first || !last) return null;
  return last.y - first.y;
}

function applySeriesToBuffers(trId, aligned) {
  if (trId === 1) {
    bufs.p1 = aligned.p_kw;
    bufs.q1 = aligned.q_kvar;
    bufs.pf1 = aligned.pf;
    bufs.e1 = aligned.e_kwh;
    bufs.u1_12 = aligned.u12_v;
    bufs.u1_23 = aligned.u23_v;
    bufs.u1_31 = aligned.u31_v;
    bufs.i1_1 = aligned.i1_a;
    bufs.i1_2 = aligned.i2_a;
    bufs.i1_3 = aligned.i3_a;
  } else {
    bufs.p2 = aligned.p_kw;
    bufs.q2 = aligned.q_kvar;
    bufs.pf2 = aligned.pf;
    bufs.e2 = aligned.e_kwh;
    bufs.u2_12 = aligned.u12_v;
    bufs.u2_23 = aligned.u23_v;
    bufs.u2_31 = aligned.u31_v;
    bufs.i2_1 = aligned.i1_a;
    bufs.i2_2 = aligned.i2_a;
    bufs.i2_3 = aligned.i3_a;
  }
}

function seriesStats(aligned) {
  return {
    p_kw: computeStats(aligned.p_kw),
    q_kvar: computeStats(aligned.q_kvar),
    pf: computeStats(aligned.pf),
    e_kwh: { delta: computeDelta(aligned.e_kwh) },
  };
}

function isoDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function demoRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function buildDemoSeries(trId, winMin, cadenceSec) {
  const now = Date.now();
  const step = cadenceSec * 1000;
  const points = Math.max(2, Math.min(Math.ceil((winMin * 60) / cadenceSec) + 2, 4000));
  const start = now - winMin * 60 * 1000;
  const rand = demoRandom(trId * 1337 + winMin);
  const out = {
    p_kw: [], q_kvar: [], pf: [],
    u12_v: [], u23_v: [], u31_v: [],
    i1_a: [], i2_a: [], i3_a: [],
    e_kwh: [],
  };

  let energy = 0;
  for (let i = 0; i < points; i += 1) {
    const t = start + i * step;
    const w = i / 35;
    const base = trId === 1 ? 420 : 470;
    const power = base + 60 * Math.sin(w) + 30 * rand();
    const reactive = 120 + 35 * Math.cos(w * 0.8 + 0.5) + 20 * rand();
    const pf = Math.max(0.78, Math.min(0.99, 0.92 + 0.04 * Math.cos(w / 2) - 0.02 * rand()));
    const voltageBase = trId === 1 ? 410 : 400;
    const currentsBase = trId === 1 ? 380 : 360;

    energy += Math.max(0, power) * (step / 3_600_000);

    out.p_kw.push({ x: t, y: Number(power.toFixed(2)) });
    out.q_kvar.push({ x: t, y: Number(reactive.toFixed(2)) });
    out.pf.push({ x: t, y: Number(pf.toFixed(3)) });

    out.u12_v.push({ x: t, y: Number((voltageBase + 8 * Math.sin(w)).toFixed(1)) });
    out.u23_v.push({ x: t, y: Number((voltageBase + 6 * Math.cos(w * 0.9)).toFixed(1)) });
    out.u31_v.push({ x: t, y: Number((voltageBase + 7 * Math.sin(w * 1.1 + 1)).toFixed(1)) });

    out.i1_a.push({ x: t, y: Number((currentsBase + 30 * Math.sin(w * 1.05)).toFixed(1)) });
    out.i2_a.push({ x: t, y: Number((currentsBase + 28 * Math.sin(w * 0.9 + 0.8)).toFixed(1)) });
    out.i3_a.push({ x: t, y: Number((currentsBase + 32 * Math.cos(w * 1.2 + 0.6)).toFixed(1)) });
    out.e_kwh.push({ x: t, y: Number(energy.toFixed(2)) });
  }
  return out;
}

async function demoSeries(trId, params) {
  await sleep(DEMO_LATENCY + Math.random() * DEMO_JITTER);
  return buildDemoSeries(trId, params.minutes, params.cadenceSec);
}

export async function loadSeries(trId, overrides = {}) {
  const winMin = overrides.minutes ?? Math.max(
    state.win[`p${trId}`],
    state.win[`u${trId}`],
    state.win[`pf${trId}`]
  );
  const params = computeRequestParams(winMin);
  const fetcher = async () => {
    if (state.demoEnabled || DEMO_ENABLED) {
      return demoSeries(trId, params);
    }
    const url = buildSeriesUrl(trId, params);
    return fetchJSON(url, { timeoutMs: params.timeoutMs });
  };
  const raw = await withRetries(fetcher, RETRY_CONFIG);
  const normalized = normalizeSeriesDto(raw);
  const aligned = alignSeries(normalized, params.cadenceSec);
  applySeriesToBuffers(trId, aligned);
  const stats = seriesStats(aligned);
  return { tr: trId, params, series: aligned, stats };
}

const DEMO_SIGNALS = {
  'tr1-power': [
    { id: 'p_kw', label: 'Puissance active', unit: 'kW', default: true },
    { id: 'q_kvar', label: 'Puissance réactive', unit: 'kvar' },
    { id: 'pf', label: 'Facteur de puissance', unit: '' },
  ],
  'tr1-tension': [
    { id: 'u12_v', label: 'U12', unit: 'V', default: true },
    { id: 'u23_v', label: 'U23', unit: 'V', default: true },
    { id: 'u31_v', label: 'U31', unit: 'V', default: true },
  ],
  'tr1-pf': [
    { id: 'pf', label: 'Facteur de puissance', unit: '' },
    { id: 'q_kvar', label: 'Puissance réactive', unit: 'kvar' },
  ],
  'tr2-power': [
    { id: 'p_kw', label: 'Puissance active', unit: 'kW', default: true },
    { id: 'q_kvar', label: 'Puissance réactive', unit: 'kvar' },
    { id: 'pf', label: 'Facteur de puissance', unit: '' },
  ],
  'tr2-tension': [
    { id: 'u12_v', label: 'U12', unit: 'V', default: true },
    { id: 'u23_v', label: 'U23', unit: 'V', default: true },
    { id: 'u31_v', label: 'U31', unit: 'V', default: true },
  ],
  'tr2-pf': [
    { id: 'pf', label: 'Facteur de puissance', unit: '' },
    { id: 'q_kvar', label: 'Puissance réactive', unit: 'kvar' },
  ],
};

function cacheKey(chartKey) {
  return `${chartKey || 'all'}`;
}

export async function fetchSignals(chartKey, { force = false } = {}) {
  const key = cacheKey(chartKey);
  const cached = SIGNAL_CACHE.get(key);
  const now = Date.now();
  if (!force && cached && now - cached.ts < SIGNAL_CACHE_TTL) {
    if (cached.error) throw cached.error;
    return cached.data;
  }

  const perform = async () => {
    if (state.demoEnabled || DEMO_ENABLED) {
      await sleep(120 + Math.random() * 80);
      const list = DEMO_SIGNALS[chartKey] || DEMO_SIGNALS['tr1-power'];
      return list.map(item => ({ ...item }));
    }
    // TODO(api): ajuster l'endpoint de decouverte de signaux si different
    const baseUrl = state.apiBase || API_BASE_URL;
    const url = new URL(`${baseUrl}/signals`);
    if (chartKey) url.searchParams.set('chart', chartKey);
    const raw = await fetchJSON(url.toString(), { timeoutMs: 7000 });
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(item => ({
      id: String(item.id ?? item.code ?? item.name ?? ''),
      label: item.label ?? item.name ?? item.description ?? item.id ?? 'Signal',
      unit: item.unit ?? item.Unit ?? '',
      default: Boolean(item.default ?? item.isDefault ?? false),
    })).filter(sig => sig.id);
  };

  try {
    const data = await withRetries(perform, RETRY_CONFIG);
    SIGNAL_CACHE.set(key, { ts: now, data, error: null });
    return data;
  } catch (error) {
    SIGNAL_CACHE.set(key, { ts: now, data: [], error });
    throw error;
  }
}

export async function fetchDailySummary(dateInput) {
  const iso = isoDate(dateInput);
  if (!iso) throw new Error('invalid-date');
  const perform = async () => {
    if (state.demoEnabled || DEMO_ENABLED) {
      await sleep(180 + Math.random() * 140);
      const rand = demoRandom(iso.split('-').join('').length * 97);
      const kwh = 12_500 + rand() * 2_000;
      const kwMax = 820 + rand() * 120;
      const pfMin = 0.78 + rand() * 0.08;
      return {
        date: iso,
        kwh,
        kwMax,
        pfMin,
      };
    }
    // Utilisation de données simulées
    console.warn('[api] daily-summary endpoint non disponible, utilisation de données simulées');
    const rand = demoRandom(iso.split('-').join('').length * 97);
    const kwh = 12_500 + rand() * 2_000;
    const kwMax = 820 + rand() * 120;
    const pfMin = 0.78 + rand() * 0.08;
    return {
      date: iso,
      kwh,
      kwMax,
      pfMin,
    };
  };
  return withRetries(perform, RETRY_CONFIG);
}

export async function pingApi(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/tr1/snapshot`;
  try {
    const data = await fetchJSON(url, { timeoutMs: SNAPSHOT_TIMEOUT_MS });
    return Boolean(data);
  } catch (err) {
    return false;
  }
}

export function normalizeSnapshot(payload) {
  const map = lowerKeys(payload || {});
  return {
    ts: map.ts ?? map.timestamp ?? map.ts_utc ?? null,
    p_kw: toNumber(map.p_kw),
    q_kvar: toNumber(map.q_kvar),
    pf: toNumber(map.pf),
    e_kwh: toNumber(map.e_kwh),
    u12_v: toNumber(map.u12_v ?? map.u1_v),
    u23_v: toNumber(map.u23_v ?? map.u2_v),
    u31_v: toNumber(map.u31_v ?? map.u3_v),
    i1_a: toNumber(map.i1_a),
    i2_a: toNumber(map.i2_a),
    i3_a: toNumber(map.i3_a),
    p_kw_avg: toNumber(map.p_kw_avg),
    p_kw_max: toNumber(map.p_kw_max),
    q_kvar_avg: toNumber(map.q_kvar_avg),
    q_kvar_max: toNumber(map.q_kvar_max),
    u12_v_avg: toNumber(map.u12_v_avg),
    u12_v_max: toNumber(map.u12_v_max),
    u23_v_avg: toNumber(map.u23_v_avg),
    u23_v_max: toNumber(map.u23_v_max),
    u31_v_avg: toNumber(map.u31_v_avg),
    u31_v_max: toNumber(map.u31_v_max),
    i1_a_avg: toNumber(map.i1_a_avg),
    i1_a_max: toNumber(map.i1_a_max),
    i2_a_avg: toNumber(map.i2_a_avg),
    i2_a_max: toNumber(map.i2_a_max),
    i3_a_avg: toNumber(map.i3_a_avg),
    i3_a_max: toNumber(map.i3_a_max),
    pf_avg: toNumber(map.pf_avg),
    pf_min: toNumber(map.pf_min ?? map.cosphi_min),
  };
}

export { fetchJSON };

