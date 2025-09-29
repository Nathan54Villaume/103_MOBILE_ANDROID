import { getNumber, setNumber, getString, setString } from './storage.js';
import { DEFAULT_API_BASE, MODE_DEV, DEMO_ENABLED } from './config.js';

const API_BASE_KEY = 'apiBase';
const WINDOW_KEYS = {
  p1: 'win_p1',
  u1: 'win_u1',
  pf1: 'win_pf1',
  p2: 'win_p2',
  u2: 'win_u2',
  pf2: 'win_pf2'
};

function readWindow(key, fallback = 15) {
  const stored = getNumber(WINDOW_KEYS[key], fallback);
  return stored == null ? fallback : stored;
}

export const state = {
  apiBase: (getString(API_BASE_KEY, DEFAULT_API_BASE) || DEFAULT_API_BASE).trim(),
  pollMs: 1000,
  initialLoad: true,
  modeDev: MODE_DEV,
  demoEnabled: DEMO_ENABLED,
  win: {
    p1: readWindow('p1'),
    u1: readWindow('u1'),
    pf1: readWindow('pf1'),
    p2: readWindow('p2'),
    u2: readWindow('u2'),
    pf2: readWindow('pf2')
  },
  chartSettings: new Map(),
  seriesStats: new Map(),
  collapsedCharts: new Set()
};

export const MAX_MIN = 2880;

export const bufs = {
  p1: [], q1: [], pf1: [], e1: [],
  u1_12: [], u1_23: [], u1_31: [],
  i1_1: [], i1_2: [], i1_3: [],
  p2: [], q2: [], pf2: [], e2: [],
  u2_12: [], u2_23: [], u2_31: [],
  i2_1: [], i2_2: [], i2_3: []
};

export function setApiBase(baseUrl) {
  const next = (baseUrl || '').trim() || DEFAULT_API_BASE;
  state.apiBase = next;
  setString(API_BASE_KEY, next);
}

export function setWindow(key, value) {
  if (!Object.prototype.hasOwnProperty.call(state.win, key)) return;
  const val = Number(value);
  if (!Number.isFinite(val) || val <= 0) return;
  state.win[key] = val;
  const storeKey = WINDOW_KEYS[key];
  if (storeKey) setNumber(storeKey, val);
}

export function cutoffTs(mins) {
  return Date.now() - mins * 60 * 1000;
}

export function prune() {
  const c = cutoffTs(MAX_MIN);
  Object.keys(bufs).forEach(bufferKey => {
    const buffer = bufs[bufferKey];
    while (buffer.length && buffer[0].x < c) buffer.shift();
  });
}

export function filt(arr, mins) {
  const c = cutoffTs(mins);
  let idx = 0;
  while (idx < arr.length && arr[idx].x < c) idx += 1;
  return arr.slice(idx);
}

export function downsample(data, threshold) {
  if (data.length <= threshold) return data;
  const sampled = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  sampled.push(data[a]);
  for (let i = 0; i < threshold - 2; i += 1) {
    const avgStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgEnd = Math.floor((i + 2) * bucketSize) + 1;
    const len = avgEnd - avgStart;
    if (len <= 0) continue;
    let ax = data[a].x;
    let ay = data[a].y;
    let avgx = 0;
    let avgy = 0;
    for (let j = avgStart; j < avgEnd; j += 1) {
      avgx += data[j].x;
      avgy += data[j].y;
    }
    avgx /= len;
    avgy /= len;
    const rOff = Math.floor(i * bucketSize) + 1;
    const rTo = Math.floor((i + 1) * bucketSize) + 1;
    let maxArea = -1;
    let nextA = -1;
    for (let k = rOff; k < rTo; k += 1) {
      const area = Math.abs((ax - avgx) * (data[k].y - ay) - (ax - data[k].x) * (avgy - ay)) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        nextA = k;
      }
    }
    if (nextA >= 0) {
      sampled.push(data[nextA]);
      a = nextA;
    }
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}

export const CHART_POINT_THRESHOLD = 10000;

export function resetApiBaseToDefault() {
  setString(API_BASE_KEY, DEFAULT_API_BASE);
  state.apiBase = DEFAULT_API_BASE;
}
