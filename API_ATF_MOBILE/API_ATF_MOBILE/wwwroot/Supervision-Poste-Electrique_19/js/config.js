const globalScope = typeof window !== 'undefined' ? window : globalThis;

export const DEFAULT_API_BASE = 'http://10.250.13.4/api/energy_Poste_19';
export const MODE_DEV = globalScope.__SPE_MODE__ === 'dev';
export const DEMO_ENABLED = MODE_DEV && globalScope.__SPE_DEMO__ !== false;
export const DEMO_LATENCY = 350;
export const DEMO_JITTER = 250;

export const RAW_ONLY = true;

export const TIMEBASE = [
  { maxMins: 15, cadenceSec: 1, histFactor: 1 },
  { maxMins: 60, cadenceSec: 4, histFactor: 1 },
  { maxMins: 240, cadenceSec: 10, histFactor: 1 },
  { maxMins: 1440, cadenceSec: 15, histFactor: 1 },
  { maxMins: 2880, cadenceSec: 20, histFactor: 1 },
];

export function pickProfile(winMin) {
  return TIMEBASE.find(profile => winMin <= profile.maxMins) || TIMEBASE[TIMEBASE.length - 1];
}

export function pointsFor(winMin) {
  const { cadenceSec, histFactor } = pickProfile(winMin);
  const pts = Math.ceil((winMin * 60) / cadenceSec);
  return Math.ceil(pts * histFactor);
}

export function flagDevMode() {
  return MODE_DEV;
}

// Configuration spécifique au Poste 19
export const POSTE_NUMBER = 19;
export const TRANSFORMERS = ['TR1', 'TR2', 'TR3', 'TR4', 'TR5'];
export const TRANSFORMER_COLORS = {
  'TR1': 'var(--tesla-blue)',
  'TR2': 'var(--tesla-red)', 
  'TR3': 'var(--tesla-green)',
  'TR4': 'var(--tesla-amber)',
  'TR5': 'var(--tesla-purple)'
};
