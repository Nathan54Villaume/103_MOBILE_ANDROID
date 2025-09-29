import { fmt, frTooltip, frTick, displayFormats, timeUnitFor, debounce } from './utils.js';
import { state, bufs, filt, downsample, CHART_POINT_THRESHOLD, cutoffTs } from './state.js';
import { getJson, setJson } from './storage.js';

const { Chart } = window;
const zoomPlugin = window['chartjs-plugin-zoom'] || window.ChartZoom || window.ChartZoomPlugin;
if (Chart && zoomPlugin) {
  try { 
    Chart.register(zoomPlugin); 
    console.log('[charts] zoom plugin registered successfully');
    console.log('[charts] zoom plugin version:', zoomPlugin.version || 'unknown');
  } catch (err) { 
    console.warn('[charts] zoom plugin registration failed', err); 
  }
} else {
  console.warn('[charts] zoom plugin not found');
  console.log('[charts] Available window objects:', Object.keys(window).filter(k => k.includes('zoom') || k.includes('Zoom')));
}

const SIGNAL_KEY_PREFIX = 'chart:signals:';
const SETTINGS_KEY_PREFIX = 'chart:settings:';

const inactiveCharts = new Set();
const registry = new Map();
const chartStates = new Map(); // État de zoom/pan par chart
const selectionStates = new Map(); // Sélection de signaux par chart

// Fonctions de gestion d'état des charts
function saveChartState(chart) {
  const scales = chart.scales;
  const currentState = chartStates.get(chart.id) || {};
  
  // Détecter si l'utilisateur a vraiment changé le zoom/pan
  const hasUserChangedZoom = currentState.userZoomed && 
    (currentState.xmin !== scales.x?.min || currentState.xmax !== scales.x?.max);
  
  chartStates.set(chart.id, {
    xmin: scales.x?.min,
    xmax: scales.x?.max,
    ymin: scales.y?.min,
    ymax: scales.y?.max,
    userZoomed: hasUserChangedZoom || currentState.userZoomed || false
  });
  
  console.log('[saveChartState] Saved state for chart', chart.id, ':', {
    xmin: scales.x?.min,
    xmax: scales.x?.max,
    userZoomed: hasUserChangedZoom || currentState.userZoomed || false
  });
}

function restoreChartState(chart) {
  const state = chartStates.get(chart.id);
  if (state && state.userZoomed) {
    const scales = chart.options.scales;
    if (scales.x) {
      scales.x.min = state.xmin;
      scales.x.max = state.xmax;
    }
    if (scales.y) {
      scales.y.min = state.ymin;
      scales.y.max = state.ymax;
    }
  }
}

function markChartAsZoomed(chart) {
  const state = chartStates.get(chart.id) || {};
  state.userZoomed = true;
  // Sauvegarder les limites actuelles
  state.xmin = chart.options.scales.x.min;
  state.xmax = chart.options.scales.x.max;
  chartStates.set(chart.id, state);
  console.log('[markChartAsZoomed] Chart marked as zoomed with limits:', { xmin: state.xmin, xmax: state.xmax });
}

// Cache des signaux disponibles
let signalsCache = null;
let signalsCacheTime = 0;
const SIGNALS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAvailableSignals() {
  const now = Date.now();
  if (signalsCache && (now - signalsCacheTime) < SIGNALS_CACHE_TTL) {
    return signalsCache;
  }
  
  try {
    const response = await fetch('/api/energy/signals');
    if (!response.ok) throw new Error('Failed to fetch signals');
    signalsCache = await response.json();
    signalsCacheTime = now;
    return signalsCache;
  } catch (error) {
    console.error('Error fetching signals:', error);
    return [];
  }
}

function openContextMenu(chart, x, y) {
  const menuId = `ctx-${chart.id}`;
  let menu = document.getElementById(menuId);
  
  if (!menu) {
    menu = createContextMenu(menuId);
    document.body.appendChild(menu);
  }
  
  populateContextMenu(menu, chart);
  positionContextMenu(menu, x, y);
  showContextMenu(menu);
  trapFocus(menu);
}

function createContextMenu(menuId) {
  const menu = document.createElement('div');
  menu.id = menuId;
  menu.className = 'ctx-menu hidden';
  menu.innerHTML = `
    <div class="ctx-head">
      <span>Signaux disponibles</span>
      <button class="ctx-close" aria-label="Fermer">×</button>
    </div>
    <div class="ctx-body" role="menu" aria-label="Signaux">
      <div class="ctx-loading">Chargement...</div>
    </div>
    <div class="ctx-foot">
      <button class="ctx-apply">Appliquer</button>
      <button class="ctx-cancel">Annuler</button>
    </div>
  `;
  return menu;
}

async function populateContextMenu(menu, chart) {
  const body = menu.querySelector('.ctx-body');
  body.innerHTML = '<div class="ctx-loading">Chargement...</div>';
  
  try {
    const signals = await getAvailableSignals();
    if (signals.length === 0) {
      body.innerHTML = '<div class="ctx-error">Aucun signal disponible</div>';
      return;
    }
    
    const currentSelection = selectionStates.get(chart.id) || new Set();
    
    body.innerHTML = signals.map(signal => `
      <label class="ctx-signal">
        <input type="checkbox" value="${signal.id}" ${currentSelection.has(signal.id) ? 'checked' : ''}>
        <span>${signal.name || signal.id}</span>
      </label>
    `).join('');
    
    // Ajouter les gestionnaires d'événements
    setupContextMenuHandlers(menu, chart);
    
  } catch (error) {
    body.innerHTML = `
      <div class="ctx-error">
        Impossible de charger les signaux
        <button class="ctx-retry">Réessayer</button>
      </div>
    `;
    menu.querySelector('.ctx-retry').onclick = () => populateContextMenu(menu, chart);
  }
}

function setupContextMenuHandlers(menu, chart) {
  const closeBtn = menu.querySelector('.ctx-close');
  const applyBtn = menu.querySelector('.ctx-apply');
  const cancelBtn = menu.querySelector('.ctx-cancel');
  
  const closeMenu = () => {
    hideContextMenu(menu);
    restoreFocus();
  };
  
  closeBtn.onclick = closeMenu;
  cancelBtn.onclick = closeMenu;
  
  applyBtn.onclick = () => {
    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
    applySignalSelection(chart, selected);
    closeMenu();
  };
  
  // Fermeture par clic extérieur
  const outsideClick = (e) => {
    if (!menu.contains(e.target)) {
      closeMenu();
      document.removeEventListener('click', outsideClick);
    }
  };
  
  // Fermeture par Escape
  const escapeKey = (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      document.removeEventListener('keydown', escapeKey);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', outsideClick);
    document.addEventListener('keydown', escapeKey);
  }, 100);
}

function applySignalSelection(chart, selectedIds) {
  // Sauvegarder la sélection
  selectionStates.set(chart.id, new Set(selectedIds));
  
  // Mettre à jour les datasets sans recréer le chart
  const currentDatasets = chart.data.datasets;
  const newDatasets = [];
  
  // Garder les datasets existants qui sont encore sélectionnés
  currentDatasets.forEach(dataset => {
    if (selectedIds.includes(dataset.id)) {
      newDatasets.push(dataset);
    }
  });
  
  // Ajouter les nouveaux datasets
  selectedIds.forEach(signalId => {
    if (!currentDatasets.find(ds => ds.id === signalId)) {
      const newDataset = buildDataset(chart.def, signalId, chart.settings);
      if (newDataset) {
        newDatasets.push(newDataset);
      }
    }
  });
  
  // Mettre à jour les données
  chart.data.datasets = newDatasets;
  
  // Sauvegarder l'état avant update
  saveChartState(chart);
  
  // Mettre à jour le chart
  chart.update('none');
  
  // Restaurer l'état après update
  restoreChartState(chart);
}

function positionContextMenu(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  let left = x;
  let top = y;
  
  // Ajuster si déborde à droite
  if (left + rect.width > viewport.width) {
    left = viewport.width - rect.width - 10;
  }
  
  // Ajuster si déborde en bas
  if (top + rect.height > viewport.height) {
    top = viewport.height - rect.height - 10;
  }
  
  menu.style.left = `${Math.max(10, left)}px`;
  menu.style.top = `${Math.max(10, top)}px`;
}

function showContextMenu(menu) {
  menu.classList.remove('hidden');
  menu.style.zIndex = '1000';
}

function hideContextMenu(menu) {
  menu.classList.add('hidden');
}

function trapFocus(menu) {
  const focusable = menu.querySelectorAll('button, input[type="checkbox"]');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  
  if (first) first.focus();
  
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
}

function restoreFocus() {
  // Restaurer le focus sur le canvas
  const activeChart = document.querySelector('.chart-wrapper canvas:focus');
  if (activeChart) {
    activeChart.focus();
  }
}

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
  console.log('[bufferFor] Getting buffer for signal:', signalId, 'in transformer:', def.tr);
  
  const map = BUFFER_MAP[`tr${def.tr}`];
  console.log('[bufferFor] Buffer map for tr' + def.tr + ':', map);
  
  const bufferKey = map ? map[signalId] : null;
  console.log('[bufferFor] Buffer key for signal', signalId + ':', bufferKey);
  
  const buffer = map ? bufs[bufferKey] || [] : [];
  console.log('[bufferFor] Buffer size:', buffer?.length || 0);
  
  return buffer;
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
  console.log('[filteredData] Getting data for signal:', signalId, 'in chart:', def.canvasId);
  
  const source = bufferFor(def, signalId);
  console.log('[filteredData] Source buffer size:', source?.length || 0);
  
  const minutes = state.win[def.windowKey] ?? 15;
  console.log('[filteredData] Time window (minutes):', minutes);
  
  const filtered = filt(source, minutes);
  console.log('[filteredData] Filtered data points:', filtered?.length || 0);
  
  const downsampled = downsample(filtered, CHART_POINT_THRESHOLD);
  console.log('[filteredData] Downsampled data points:', downsampled?.length || 0);
  
  return downsampled;
}

function applyMovingAverage(data, settings) {
  return settings.movingAvg > 1 ? movingAverage(data, settings.movingAvg) : data;
}

function buildDataset(def, signalId, settings) {
  console.log('[buildDataset] Building dataset for signal:', signalId, 'in chart:', def.canvasId);
  
  const info = def.signals[signalId];
  if (!info) {
    console.log('[buildDataset] No signal info found for:', signalId);
    return null;
  }
  
  console.log('[buildDataset] Signal info:', info);
  
  const series = applyMovingAverage(filteredData(def, signalId), settings);
  console.log('[buildDataset] Series data points:', series?.length || 0);
  
  const dataset = {
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
  
  console.log('[buildDataset] Final dataset:', {
    label: dataset.label,
    dataPoints: dataset.data?.length || 0,
    yAxisID: dataset.yAxisID,
    color: dataset.borderColor
  });
  
  return dataset;
}

function chartOptions(def, settings) {
  const scales = {
    x: {
      type: 'time',
      time: { tooltipFormat: 'HH:mm', displayFormats },
      ticks: { color: '#e2e8f0', font: { size: 12 }, callback: value => frTick(value) },
      grid: { color: settings.showGrid ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.08)' },
      border: { color: 'rgba(148,163,184,0.2)' }
    },
    y: {
      position: 'left',
      title: { 
        display: !!def.axes.y?.label, 
        text: def.axes.y?.label || '',
        color: '#e2e8f0',
        font: { size: 13, weight: '500' }
      },
      ticks: { color: '#e2e8f0', font: { size: 11 } },
      grid: { color: settings.showGrid ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.08)' },
      border: { color: 'rgba(148,163,184,0.2)' },
      type: settings.scaleMode === 'log' ? 'logarithmic' : 'linear',
      min: settings.yMin ?? def.axes.y?.min ?? undefined,
      max: settings.yMax ?? def.axes.y?.max ?? undefined
    }
  };

  if (def.axes.y1) {
    scales.y1 = {
      position: def.axes.y1.position || 'right',
      title: { 
        display: !!def.axes.y1.label, 
        text: def.axes.y1.label || '',
        color: '#e2e8f0',
        font: { size: 13, weight: '500' }
      },
      ticks: { color: '#e2e8f0', font: { size: 11 } },
      grid: { drawOnChartArea: false },
      border: { color: 'rgba(148,163,184,0.2)' },
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
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: { display: settings.showLegend, labels: { color: '#e2e8f0' } },
      tooltip: { 
        callbacks: { 
          title: items => items.map(frTooltip),
          label: function(ctx) {
            const t = new Date(ctx.parsed.x).toLocaleTimeString('fr-FR', { hour12: false });
            return `${t} → ${ctx.parsed.y}`;
          }
        }
      },
      zoom: zoomPlugin ? {
        // === PAN À LA SOURIS, SANS TOUCHE MODIF ===
        pan: {
          enabled: true,
          mode: 'x',
          modifierKey: null,   // Aucune touche requise
          threshold: 0,        // démarrage immédiat
          // Empêche de sortir du domaine des données
          limits: { x: { min: 'original', max: 'original' } }
        },
        // === ZOOM (roue + pinch + drag si souhaité) ===
        zoom: {
          wheel: { enabled: true, speed: 0.1 },
          pinch: { enabled: true },
          drag: { enabled: false }, // mets true si tu veux le rectangle de zoom
          mode: 'x',
          // 1) Interdit de dé-zoomer au-delà de la plage d'origine
          limits: { x: { min: 'original', max: 'original', minRange: 1000 } } // minRange: fenêtre min (1s ici)
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

  // Sauvegarder l'état initial
  saveChartState(chart);
  
  // Gestion du curseur grab/grabbing et des états de pan
  let isPanning = false;
  
  // Configuration du plugin zoom après création du chart
  if (zoomPlugin && chart.options.plugins.zoom) {
    console.log('[charts] Configuring zoom plugin for chart:', chart.id);
    console.log('[charts] Zoom plugin config:', chart.options.plugins.zoom);
    
    // Callbacks pour la gestion du curseur
    chart.options.plugins.zoom.onPanStart = () => { 
      console.log('[zoom] Pan started');
      isPanning = true; 
      canvas.style.cursor = 'grabbing'; 
      markChartAsZoomed(chart);
    };
    
    chart.options.plugins.zoom.onPanComplete = () => { 
      console.log('[zoom] Pan completed');
      isPanning = false; 
      canvas.style.cursor = 'grab'; 
    };
    
    chart.options.plugins.zoom.onZoomStart = () => {
      console.log('[zoom] Zoom started');
      markChartAsZoomed(chart);
    };
    
    chart.options.plugins.zoom.onZoomComplete = () => {
      console.log('[zoom] Zoom completed');
    };
    
    console.log('[charts] Zoom plugin callbacks configured');
  } else {
    console.warn('[charts] Zoom plugin not available for chart:', chart.id);
  }
  
  // Curseur par défaut survol chart
  canvas.addEventListener('mouseenter', () => { 
    if (!isPanning) canvas.style.cursor = 'grab'; 
  });
  
  canvas.addEventListener('mouseleave', () => { 
    canvas.style.cursor = 'default'; 
  });
  
  // Détection des interactions pour marquer comme zoomé
  canvas.addEventListener('wheel', () => {
    markChartAsZoomed(chart);
  });
  
  // Menu contextuel pour la sélection de signaux
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openContextMenu(chart, e.clientX, e.clientY);
  });

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
  console.log('[datasetList] Building datasets for chart:', entry.def.canvasId);
  console.log('[datasetList] Signals:', entry.state.signals);
  
  const datasets = entry.state.signals
    .map(signalId => {
      console.log('[datasetList] Building dataset for signal:', signalId);
      const dataset = buildDataset(entry.def, signalId, entry.state.settings);
      console.log('[datasetList] Dataset result:', dataset ? {
        label: dataset.label,
        dataPoints: dataset.data?.length || 0,
        id: dataset.id
      } : 'null');
      return dataset;
    })
    .filter(Boolean);
    
  console.log('[datasetList] Final datasets count:', datasets.length);
  return datasets;
}

export function refreshCharts() {
  console.log('[refreshCharts] Starting refresh, registry size:', registry.size);
  
  registry.forEach((entry) => {
    if (inactiveCharts.has(entry.def.canvasId)) {
      console.log('[refreshCharts] Skipping inactive chart:', entry.def.canvasId);
      return;
    }
    
    const minutes = state.win[entry.def.windowKey] ?? 15;
    console.log('[refreshCharts] Processing chart:', entry.def.canvasId, 'minutes:', minutes);
    
    // Mettre à jour l'unité de temps
    const timeUnit = timeUnitFor(minutes);
    entry.chart.options.scales.x.time.unit = timeUnit;
    console.log('[refreshCharts] Time unit set to:', timeUnit);
    
    // Sauvegarder l'état avant update
    saveChartState(entry.chart);
    
    // Recalculer les limites temporelles de l'axe X seulement si l'utilisateur n'a pas zoomé
    const chartState = chartStates.get(entry.chart.id);
    console.log('[refreshCharts] Chart state:', chartState);
    
    // Vérifier si l'utilisateur a zoomé
    const hasUserZoomed = chartState && chartState.userZoomed;
    
    console.log('[refreshCharts] Zoom detection:', {
      hasState: !!chartState,
      userZoomed: chartState?.userZoomed,
      hasUserZoomed,
      currentXMin: entry.chart.options.scales.x.min,
      currentXMax: entry.chart.options.scales.x.max
    });
    
    if (!hasUserZoomed) {
      const now = Date.now();
      const cutoff = cutoffTs(minutes);
      entry.chart.options.scales.x.min = cutoff;
      entry.chart.options.scales.x.max = now;
      console.log('[refreshCharts] X axis limits set:', { min: cutoff, max: now });
    } else {
      console.log('[refreshCharts] Preserving user zoom state - NOT updating X limits');
    }
    
    // Mettre à jour les données
    const datasets = datasetList(entry);
    console.log('[refreshCharts] Datasets count:', datasets.length);
    datasets.forEach((dataset, i) => {
      console.log(`[refreshCharts] Dataset ${i}:`, {
        label: dataset.label,
        dataPoints: dataset.data?.length || 0,
        id: dataset.id
      });
    });
    entry.chart.data.datasets = datasets;
    
    // Mettre à jour les échelles Y
    const yScale = entry.chart.options.scales.y;
    if (yScale) {
      yScale.type = entry.state.settings.scaleMode === 'log' ? 'logarithmic' : 'linear';
      yScale.min = entry.state.settings.yMin ?? entry.def.axes.y?.min ?? undefined;
      yScale.max = entry.state.settings.yMax ?? entry.def.axes.y?.max ?? undefined;
      console.log('[refreshCharts] Y scale updated:', { type: yScale.type, min: yScale.min, max: yScale.max });
    }
    if (entry.chart.options.scales.y1) {
      entry.chart.options.scales.y1.display = entry.state.signals.some(id => (entry.def.signals[id]?.axis || 'y') === 'y1');
      console.log('[refreshCharts] Y1 scale display:', entry.chart.options.scales.y1.display);
    }
    
    // Mettre à jour les options d'affichage
    entry.chart.options.plugins.legend.display = entry.state.settings.showLegend;
    entry.chart.options.scales.x.grid.color = entry.state.settings.showGrid ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.06)';
    if (entry.chart.options.scales.y.grid) {
      entry.chart.options.scales.y.grid.color = entry.state.settings.showGrid ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.05)';
    }
    
    console.log('[refreshCharts] About to update chart:', entry.def.canvasId);
    
    // Mettre à jour le graphique
    entry.chart.update('none');
    
    // Restaurer l'état après update
    restoreChartState(entry.chart);
    
    updateStats(entry);
    
    console.log('[refreshCharts] Chart updated successfully:', entry.def.canvasId);
  });
  
  console.log('[refreshCharts] Refresh completed');
}

export function setChartActive(canvasId, active) {
  if (!canvasId) return;
  if (active) inactiveCharts.delete(canvasId);
  else inactiveCharts.add(canvasId);
}

export function resetChartView(chartId) {
  const entry = registry.get(chartId);
  if (!entry) return;
  
  const chart = entry.chart;
  
  console.log('[resetChartView] Resetting chart:', chartId);
  
  // Réinitialiser l'état de zoom
  chartStates.set(chartId, { userZoomed: false });
  
  // Reset du zoom si disponible (revient aux bornes d'origine)
  if (chart.resetZoom) {
    chart.resetZoom();
  }
  
  // Supprimer les limites min/max pour revenir aux bornes d'origine
  if (chart.options.scales.x) {
    delete chart.options.scales.x.min;
    delete chart.options.scales.x.max;
  }
  if (chart.options.scales.y) {
    delete chart.options.scales.y.min;
    delete chart.options.scales.y.max;
  }
  
  // Mettre à jour le chart
  chart.update();
  
  console.log('[resetChartView] Chart reset completed');
}

// Gestionnaire de resize avec debounce
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    console.log('[resize] Resizing charts with debounce');
    registry.forEach((entry) => {
      if (inactiveCharts.has(entry.def.canvasId)) return;
      
      // Sauvegarder l'état avant resize
      saveChartState(entry.chart);
      
      // Redimensionner le chart
      entry.chart.resize();
      
      // Restaurer l'état après resize
      restoreChartState(entry.chart);
    });
  }, 150);
});

// Debounce pour les updates de données
let updateTimeout;
export function debouncedRefreshCharts() {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    console.log('[debouncedRefreshCharts] Refreshing charts with debounce');
    refreshCharts();
  }, 100);
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
