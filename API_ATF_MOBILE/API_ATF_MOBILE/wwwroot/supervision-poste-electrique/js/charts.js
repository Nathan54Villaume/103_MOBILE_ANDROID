import { fmt, frTooltip, frTick, displayFormats, timeUnitFor, debounce } from './utils.js';
import { state, bufs, filt, downsample, CHART_POINT_THRESHOLD, cutoffTs } from './state.js';
import { getJson, setJson } from './storage.js';

const { Chart } = window;
const zoomPlugin = window['chartjs-plugin-zoom'] || window.ChartZoom || window.ChartZoomPlugin;
if (Chart && zoomPlugin) {
  try { Chart.register(zoomPlugin); } catch (err) { console.warn('[charts] zoom plugin registration failed', err); }
}

const SIGNAL_KEY_PREFIX = 'chart:signals:';
const SETTINGS_KEY_PREFIX = 'chart:settings:';

const inactiveCharts = new Set();
const registry = new Map();

const BUFFER_MAP = {
  tr1: {
    p_kw: 'p1',
    q_kvar: 'q1',
    pf: 'pf1',
    u12_v: 'u1_12',
    u23_v: 'u1_23',
    u31_v: 'u1_31',
    i1_a: 'i1_1',
    i2_a: 'i1_2',
    i3_a: 'i1_3',
    e_kwh: 'e1'
  },
  tr2: {
    p_kw: 'p2',
    q_kvar: 'q2',
    pf: 'pf2',
    u12_v: 'u2_12',
    u23_v: 'u2_23',
    u31_v: 'u2_31',
    i1_a: 'i2_1',
    i2_a: 'i2_2',
    i3_a: 'i2_3',
    e_kwh: 'e2'
  }
};

const COLOR_PALETTE = {
  tr1: {
    p_kw: '#6366f1',
    q_kvar: '#f97316',
    pf: '#22c55e',
    u12_v: '#0ea5e9',
    u23_v: '#a855f7',
    u31_v: '#facc15'
  },
  tr2: {
    p_kw: '#f43f5e',
    q_kvar: '#f59e0b',
    pf: '#14b8a6',
    u12_v: '#8b5cf6',
    u23_v: '#38bdf8',
    u31_v: '#fb7185'
  }
};

const DEFAULT_SETTINGS = {
  lineWidth: 2,
  tension: 0,
  stepped: false,
  showPoints: false,
  scaleMode: 'linear',
  showLegend: true,
  showGrid: true,
  yMin: null,
  yMax: null,
  movingAvg: 0
};

const CHART_DEFS = [
  {
    key: 'tr1-power',
    canvasId: 'chartP1',
    tr: 1,
    windowKey: 'p1',
    primaryUnit: 'kW',
    axes: {
      y: { label: 'kW' },
      y1: { label: 'cos φ', position: 'right', min: 0.6, max: 1.05 }
    },
    signals: {
      p_kw: { label: 'Puissance active', unit: 'kW', axis: 'y', default: true },
      q_kvar: { label: 'Puissance réactive', unit: 'kvar', axis: 'y', optional: true },
      pf: { label: 'Facteur de puissance', unit: '', axis: 'y1', optional: true }
    }
  },
  {
    key: 'tr1-tension',
    canvasId: 'chartU1',
    tr: 1,
    windowKey: 'u1',
    primaryUnit: 'V',
    axes: { y: { label: 'V' } },
    signals: {
      u12_v: { label: 'U12', unit: 'V', axis: 'y', default: true },
      u23_v: { label: 'U23', unit: 'V', axis: 'y', default: true },
      u31_v: { label: 'U31', unit: 'V', axis: 'y', default: true }
    }
  },
  {
    key: 'tr1-pf',
    canvasId: 'chartPF1',
    tr: 1,
    windowKey: 'pf1',
    primaryUnit: '',
    axes: { y: { label: 'cos φ', min: 0.6, max: 1.05 } },
    signals: {
      pf: { label: 'Facteur de puissance', unit: '', axis: 'y', default: true },
      q_kvar: { label: 'Puissance réactive', unit: 'kvar', axis: 'y', optional: true }
    }
  },
  {
    key: 'tr2-power',
    canvasId: 'chartP2',
    tr: 2,
    windowKey: 'p2',
    primaryUnit: 'kW',
    axes: {
      y: { label: 'kW' },
      y1: { label: 'cos φ', position: 'right', min: 0.6, max: 1.05 }
    },
    signals: {
      p_kw: { label: 'Puissance active', unit: 'kW', axis: 'y', default: true },
      q_kvar: { label: 'Puissance réactive', unit: 'kvar', axis: 'y', optional: true },
      pf: { label: 'Facteur de puissance', unit: '', axis: 'y1', optional: true }
    }
  },
  {
    key: 'tr2-tension',
    canvasId: 'chartU2',
    tr: 2,
    windowKey: 'u2',
    primaryUnit: 'V',
    axes: { y: { label: 'V' } },
    signals: {
      u12_v: { label: 'U12', unit: 'V', axis: 'y', default: true },
      u23_v: { label: 'U23', unit: 'V', axis: 'y', default: true },
      u31_v: { label: 'U31', unit: 'V', axis: 'y', default: true }
    }
  },
  {
    key: 'tr2-pf',
    canvasId: 'chartPF2',
    tr: 2,
    windowKey: 'pf2',
    primaryUnit: '',
    axes: { y: { label: 'cos φ', min: 0.6, max: 1.05 } },
    signals: {
      pf: { label: 'Facteur de puissance', unit: '', axis: 'y', default: true },
      q_kvar: { label: 'Puissance réactive', unit: 'kvar', axis: 'y', optional: true }
    }
  }
];

const DEF_BY_KEY = new Map(CHART_DEFS.map(def => [def.key, def]));
const DEF_BY_CANVAS = new Map(CHART_DEFS.map(def => [def.canvasId, def]));

function storageKey(prefix, key) {
  return `${prefix}${key}`;
}

function loadStoredSignals(key, defaults) {
  const stored = getJson(storageKey(SIGNAL_KEY_PREFIX, key), null);
  if (Array.isArray(stored) && stored.length) return stored;
  return defaults;
}

function loadStoredSettings(key) {
  const stored = getJson(storageKey(SETTINGS_KEY_PREFIX, key), null);
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
}

function saveSignals(key, signals) {
  setJson(storageKey(SIGNAL_KEY_PREFIX, key), signals);
}

function saveSettings(key, settings) {
  setJson(storageKey(SETTINGS_KEY_PREFIX, key), settings);
}

function defaultSignals(def) {
  return Object.entries(def.signals)
    .filter(([, info]) => info.default)
    .map(([id]) => id);
}

function sanitizeSignals(def, signals) {
  const available = new Set(Object.keys(def.signals));
  const unique = Array.from(new Set((signals || []).filter(sig => available.has(sig))));
  return unique.length ? unique : defaultSignals(def);
}

function bufferFor(def, signalId) {
  const map = BUFFER_MAP[`tr${def.tr}`];
  return map ? bufs[map[signalId]] || [] : [];
}

function movingAverage(data, windowSize) {
  const size = Math.max(1, Number(windowSize));
  if (!Number.isFinite(size) || size <= 1 || data.length <= size) return data;
  const queue = [];
  const out = [];
  let sum = 0;
  data.forEach(point => {
    queue.push(point.y);
    sum += point.y ?? 0;
    if (queue.length > size) {
      sum -= queue.shift() ?? 0;
    }
    const avg = queue.length ? sum / queue.length : point.y;
    out.push({ x: point.x, y: avg });
  });
  return out;
}

function filteredData(def, signalId) {
  const source = bufferFor(def, signalId);
  const minutes = state.win[def.windowKey] ?? 15;
  const filtered = filt(source, minutes);
  return downsample(filtered, CHART_POINT_THRESHOLD);
}

function applyMovingAverage(data, settings) {
  return settings.movingAvg > 1 ? movingAverage(data, settings.movingAvg) : data;
}

function buildDataset(def, signalId, settings) {
  const info = def.signals[signalId];
  if (!info) return null;
  const series = applyMovingAverage(filteredData(def, signalId), settings);
  return {
    label: info.label,
    borderColor: COLOR_PALETTE[`tr${def.tr}`]?.[signalId] || '#60a5fa',
    backgroundColor: 'transparent',
    data: series,
    parsing: false,
    borderWidth: settings.lineWidth,
    spanGaps: true,
    tension: settings.stepped ? 0 : settings.tension || 0,
    stepped: settings.stepped,
    pointRadius: settings.showPoints ? 2.5 : 0,
    pointHitRadius: 6,
    yAxisID: info.axis || 'y',
    unit: info.unit || def.primaryUnit || ''
  };
}

function chartOptions(def, settings) {
  const scales = {
    x: {
      type: 'time',
      time: { tooltipFormat: 'HH:mm', displayFormats },
      ticks: { color: '#cbd5f5', callback: value => frTick(value) },
      grid: { color: settings.showGrid ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.06)' }
    },
    y: {
      position: 'left',
      title: { display: !!def.axes.y?.label, text: def.axes.y?.label || '' },
      ticks: { color: '#cbd5f5' },
      grid: { color: settings.showGrid ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.05)' },
      type: settings.scaleMode === 'log' ? 'logarithmic' : 'linear',
      min: settings.yMin ?? def.axes.y?.min ?? undefined,
      max: settings.yMax ?? def.axes.y?.max ?? undefined
    }
  };

  if (def.axes.y1) {
    scales.y1 = {
      position: def.axes.y1.position || 'right',
      title: { display: !!def.axes.y1.label, text: def.axes.y1.label || '' },
      ticks: { color: '#cbd5f5' },
      grid: { drawOnChartArea: false },
      min: def.axes.y1.min ?? undefined,
      max: def.axes.y1.max ?? undefined
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    hover: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: settings.showLegend, labels: { color: '#e2e8f0' } },
      tooltip: { callbacks: { title: items => items.map(frTooltip) } },
      zoom: zoomPlugin ? {
        pan: { 
          enabled: true, 
          mode: 'x',
          modifierKey: null  // Pan horizontal sans touche Ctrl requise
        },
        zoom: {
          wheel: { enabled: false },  // Désactiver le zoom par molette
          pinch: { enabled: false },  // Désactiver le zoom par pincement
          drag: { enabled: false },   // Désactiver le zoom par drag
          mode: 'x'
        }
      } : undefined
    },
    scales
  };
}

function getPointer(chart, event) {
  if (!event) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const clientX = event.clientX ?? event.x ?? event.touches?.[0]?.clientX;
  const clientY = event.clientY ?? event.y ?? event.touches?.[0]?.clientY;
  if (clientX == null || clientY == null) return null;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function determineZoomAxis(chart, point) {
  if (!point) return 'x';
  const area = chart.chartArea;
  const margin = 48;
  const nearLeft = Math.abs(point.x - area.left) < margin;
  const nearRight = Math.abs(point.x - area.right) < margin;
  if (nearLeft || nearRight) return 'y';
  return 'x';
}

function updateStats(entry) {
  const statsRoot = entry.statsRoot;
  if (!statsRoot) return;
  const stats = state.seriesStats.get(entry.def.tr === 1 ? 'tr1' : 'tr2');
  statsRoot.innerHTML = '';
  if (!stats) return;
  const fragments = [];
  if (stats.p_kw) {
    fragments.push(`<div><span>Moyenne</span><strong>${fmt(stats.p_kw.avg, 1)} ${entry.def.primaryUnit}</strong></div>`);
    fragments.push(`<div><span>Max</span><strong>${fmt(stats.p_kw.max, 1)} ${entry.def.primaryUnit}</strong></div>`);
  }
  if (stats.e_kwh?.delta != null) {
    fragments.push(`<div><span>Delta kWh</span><strong>${fmt(stats.e_kwh.delta, 2)} kWh</strong></div>`);
  }
  if (entry.def.key.includes('pf') && stats.pf) {
    fragments.splice(0, fragments.length);
    fragments.push(`<div><span>Moyenne</span><strong>${fmt(stats.pf.avg, 3)}</strong></div>`);
    if (Number.isFinite(stats.pf.min)) {
      fragments.push(`<div><span>Min</span><strong>${fmt(stats.pf.min, 3)}</strong></div>`);
    }
  }
  if (!fragments.length) return;
  statsRoot.classList.add('chart-stats-grid');
  statsRoot.innerHTML = fragments.map(html => `<div class="chart-stat">${html}</div>`).join('');
}

function renderToggles(entry) {
  const root = entry.toggleRoot;
  if (!root) return;
  root.innerHTML = '';
  const optional = Object.entries(entry.def.signals).filter(([, info]) => info.optional);
  if (!optional.length) return;
  optional.forEach(([id, info]) => {
    const label = document.createElement('label');
    label.className = 'chart-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = id;
    input.checked = entry.state.signals.includes(id);
    input.addEventListener('change', () => {
      const signals = new Set(entry.state.signals);
      if (input.checked) signals.add(id);
      else signals.delete(id);
      if (!signals.size) {
        defaultSignals(entry.def).forEach(sig => signals.add(sig));
      }
      applySignals(entry.def.key, Array.from(signals));
    });
    const span = document.createElement('span');
    span.textContent = info.label;
    label.append(input, span);
    root.appendChild(label);
  });
}

function registerChart(def) {
  const canvas = document.getElementById(def.canvasId);
  if (!canvas) {
    console.warn('[charts] canvas not found', def.canvasId);
    return;
  }
  const ctx = canvas.getContext('2d');
  const storedSignals = sanitizeSignals(def, loadStoredSignals(def.key, defaultSignals(def)));
  const settings = loadStoredSettings(def.key);
  const datasets = storedSignals
    .map(id => buildDataset(def, id, settings))
    .filter(Boolean);
  const options = chartOptions(def, settings);
  const chart = new Chart(ctx, { type: 'line', data: { datasets }, options });

  const entry = {
    def,
    canvas,
    chart,
    state: { signals: storedSignals, settings: { ...settings } },
    toggleRoot: document.querySelector(`[data-chart-controls="${def.canvasId}"]`),
    statsRoot: document.querySelector(`[data-chart-stats="${def.canvasId}"]`)
  };

  registry.set(def.key, entry);
  renderToggles(entry);
  updateStats(entry);

  canvas.addEventListener('contextmenu', (evt) => {
    evt.preventDefault();
    document.dispatchEvent(new CustomEvent('chart:contextmenu', {
      detail: {
        chartKey: def.key,
        canvas,
        clientX: evt.clientX,
        clientY: evt.clientY,
        signals: entry.state.signals
      }
    }));
  });
}

export function initializeCharts() {
  CHART_DEFS.forEach(def => registerChart(def));
}

function datasetList(entry) {
  return entry.state.signals
    .map(signalId => buildDataset(entry.def, signalId, entry.state.settings))
    .filter(Boolean);
}

export function refreshCharts() {
  registry.forEach((entry) => {
    if (inactiveCharts.has(entry.def.canvasId)) return;
    const minutes = state.win[entry.def.windowKey] ?? 15;
    
    // Mettre à jour l'unité de temps
    entry.chart.options.scales.x.time.unit = timeUnitFor(minutes);
    
    // Recalculer les limites temporelles de l'axe X pour que le changement de base de temps soit effectif
    const now = Date.now();
    const cutoff = cutoffTs(minutes);
    entry.chart.options.scales.x.min = cutoff;
    entry.chart.options.scales.x.max = now;
    
    // Mettre à jour les données
    entry.chart.data.datasets = datasetList(entry);
    
    // Mettre à jour les échelles Y
    const yScale = entry.chart.options.scales.y;
    if (yScale) {
      yScale.type = entry.state.settings.scaleMode === 'log' ? 'logarithmic' : 'linear';
      yScale.min = entry.state.settings.yMin ?? entry.def.axes.y?.min ?? undefined;
      yScale.max = entry.state.settings.yMax ?? entry.def.axes.y?.max ?? undefined;
    }
    if (entry.chart.options.scales.y1) {
      entry.chart.options.scales.y1.display = entry.state.signals.some(id => (entry.def.signals[id]?.axis || 'y') === 'y1');
    }
    
    // Mettre à jour les options d'affichage
    entry.chart.options.plugins.legend.display = entry.state.settings.showLegend;
    entry.chart.options.scales.x.grid.color = entry.state.settings.showGrid ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.06)';
    if (entry.chart.options.scales.y.grid) {
      entry.chart.options.scales.y.grid.color = entry.state.settings.showGrid ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.05)';
    }
    
    // Mettre à jour le graphique
    entry.chart.update('none');
    updateStats(entry);
  });
}

export function setChartActive(canvasId, active) {
  if (!canvasId) return;
  if (active) inactiveCharts.delete(canvasId);
  else inactiveCharts.add(canvasId);
}

export function applySignals(chartKey, signals) {
  const entry = registry.get(chartKey);
  if (!entry) return;
  entry.state.signals = sanitizeSignals(entry.def, signals);
  saveSignals(chartKey, entry.state.signals);
  renderToggles(entry);
  refreshCharts();
}

export function updateChartSettings(chartKey, settings) {
  const entry = registry.get(chartKey);
  if (!entry) return;
  entry.state.settings = { ...entry.state.settings, ...settings };
  saveSettings(chartKey, entry.state.settings);
  entry.chart.options = chartOptions(entry.def, entry.state.settings);
  refreshCharts();
}

export function resetChartSettings(chartKey) {
  const entry = registry.get(chartKey);
  if (!entry) return;
  entry.state.settings = { ...DEFAULT_SETTINGS };
  saveSettings(chartKey, entry.state.settings);
  entry.chart.options = chartOptions(entry.def, entry.state.settings);
  refreshCharts();
}

export function resetChartView(chartKey) {
  const entry = registry.get(chartKey);
  if (!entry) return;
  if (entry.chart.resetZoom) entry.chart.resetZoom();
  refreshCharts();
}

export function listCharts() {
  return CHART_DEFS.map(def => def.key);
}

export function getChartState(chartKey) {
  const entry = registry.get(chartKey);
  if (!entry) return null;
  return { signals: [...entry.state.signals], settings: { ...entry.state.settings } };
}

export function getChartDefinition(chartKey) {
  return DEF_BY_KEY.get(chartKey);
}

export function getCanvas(chartKey) {
  const def = DEF_BY_KEY.get(chartKey);
  if (!def) return null;
  return document.getElementById(def.canvasId);
}

window.addEventListener('resize', debounce(() => refreshCharts(), 200));
