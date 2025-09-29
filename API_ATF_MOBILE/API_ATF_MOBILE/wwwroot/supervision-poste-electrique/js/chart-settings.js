import { updateChartSettings, resetChartSettings, listCharts, getChartState, getChartDefinition, getCanvas, resetChartView } from './charts.js';

let currentChartKey = null;
const dialog = document.getElementById('chart-settings-dialog');
const form = dialog?.querySelector('form');
const body = dialog?.querySelector('#chart-settings-body');
const titleEl = dialog?.querySelector('#chart-settings-title');
const subEl = dialog?.querySelector('#chart-settings-sub');
const resetBtn = dialog?.querySelector('#chart-settings-reset');
const applyAllBtn = dialog?.querySelector('#chart-settings-apply-all');

const exportPngId = 'chart-export-png';
const exportCsvId = 'chart-export-csv';

function ensureDialog() {
  if (!dialog) return;
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = () => dialog.setAttribute('open', 'open');
    dialog.close = () => dialog.removeAttribute('open');
  }
}

function resolveValue(input, fallback) {
  if (!input) return fallback;
  return input.value || fallback;
}

function renderForm(def, state) {
  if (!body) return;
  body.innerHTML = `
    <div class="space-y-6">
      <section class="space-y-3">
        <h3 class="text-sm font-medium text-gray-700">Courbe</h3>
        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-600">Épaisseur</span>
            <input type="range" min="1" max="6" step="1" name="lineWidth" value="${state.settings.lineWidth}" class="w-full">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-600">Interpolation</span>
            <select name="mode" class="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="line" ${state.settings.stepped ? '' : 'selected'}>Linéaire</option>
              <option value="stepped" ${state.settings.stepped ? 'selected' : ''}>Escaliers</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-600">Lissage</span>
            <input type="range" min="0" max="0.6" step="0.05" name="tension" value="${state.settings.tension}" class="w-full">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-gray-600">Moyenne mobile</span>
            <select name="movingAvg" class="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="0" ${state.settings.movingAvg === 0 ? 'selected' : ''}>Aucun</option>
              <option value="3" ${state.settings.movingAvg === 3 ? 'selected' : ''}>3 points</option>
              <option value="5" ${state.settings.movingAvg === 5 ? 'selected' : ''}>5 points</option>
              <option value="9" ${state.settings.movingAvg === 9 ? 'selected' : ''}>9 points</option>
            </select>
          </label>
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="showPoints" ${state.settings.showPoints ? 'checked' : ''} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
          <span class="text-sm text-gray-700">Afficher les points</span>
        </label>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-medium text-gray-700">Axes</h3>
        <div class="grid grid-cols-2 gap-4">
          <fieldset class="space-y-2">
            <legend class="text-xs text-gray-600">Échelle Y</legend>
            <div class="space-y-1">
              <label class="flex items-center gap-2">
                <input type="radio" name="scaleMode" value="linear" ${state.settings.scaleMode !== 'log' ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500">
                <span class="text-sm text-gray-700">Linéaire</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="radio" name="scaleMode" value="log" ${state.settings.scaleMode === 'log' ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500">
                <span class="text-sm text-gray-700">Logarithmique</span>
              </label>
            </div>
          </fieldset>
          <div class="space-y-2">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">Min Y</span>
              <input type="number" name="yMin" step="0.1" placeholder="auto" value="${state.settings.yMin || ''}" class="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">Max Y</span>
              <input type="number" name="yMax" step="0.1" placeholder="auto" value="${state.settings.yMax || ''}" class="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            </label>
          </div>
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="showGrid" ${state.settings.showGrid ? 'checked' : ''} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
          <span class="text-sm text-gray-700">Afficher la grille</span>
        </label>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-medium text-gray-700">Affichage</h3>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="showLegend" ${state.settings.showLegend ? 'checked' : ''} class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
          <span class="text-sm text-gray-700">Afficher la légende</span>
        </label>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-medium text-gray-700">Export</h3>
        <div class="flex gap-2">
          <button type="button" class="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 focus:ring-2 focus:ring-indigo-500" id="${exportPngId}">Exporter PNG</button>
          <button type="button" class="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 focus:ring-2 focus:ring-indigo-500" id="${exportCsvId}">Exporter CSV</button>
          <button type="button" class="px-3 py-2 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 focus:ring-2 focus:ring-orange-500" id="chart-reset-view">Reset</button>
        </div>
      </section>
    </div>
  `;
}

function fillValues(state) {
  if (!body) return;
  const { settings } = state;
  const mode = body.querySelector('select[name="mode"]');
  const tension = body.querySelector('input[name="tension"]');
  const lineWidth = body.querySelector('input[name="lineWidth"]');
  const moving = body.querySelector('select[name="movingAvg"]');
  const showPoints = body.querySelector('input[name="showPoints"]');
  const showGrid = body.querySelector('input[name="showGrid"]');
  const showLegend = body.querySelector('input[name="showLegend"]');
  const yMin = body.querySelector('input[name="yMin"]');
  const yMax = body.querySelector('input[name="yMax"]');
  const scaleLinear = body.querySelector('input[name="scaleMode"][value="linear"]');
  const scaleLog = body.querySelector('input[name="scaleMode"][value="log"]');

  if (mode) mode.value = settings.stepped ? 'stepped' : 'line';
  if (tension) tension.value = String(settings.tension ?? 0);
  if (lineWidth) lineWidth.value = String(settings.lineWidth ?? 2);
  if (moving) moving.value = String(settings.movingAvg ?? 0);
  if (showPoints) showPoints.checked = Boolean(settings.showPoints);
  if (showGrid) showGrid.checked = Boolean(settings.showGrid);
  if (showLegend) showLegend.checked = Boolean(settings.showLegend);
  if (yMin) yMin.value = settings.yMin ?? '';
  if (yMax) yMax.value = settings.yMax ?? '';
  if (scaleLinear) scaleLinear.checked = settings.scaleMode !== 'log';
  if (scaleLog) scaleLog.checked = settings.scaleMode === 'log';
}

function gatherSettings() {
  if (!body) return {};
  const lineWidth = Number(resolveValue(body.querySelector('input[name="lineWidth"]'), 2));
  const tension = Number(resolveValue(body.querySelector('input[name="tension"]'), 0));
  const mode = resolveValue(body.querySelector('select[name="mode"]'), 'line');
  const movingAvg = Number(resolveValue(body.querySelector('select[name="movingAvg"]'), 0));
  const showPoints = body.querySelector('input[name="showPoints"]').checked;
  const showGrid = body.querySelector('input[name="showGrid"]').checked;
  const showLegend = body.querySelector('input[name="showLegend"]').checked;
  const scaleMode = body.querySelector('input[name="scaleMode"]:checked')?.value || 'linear';
  const yMinRaw = body.querySelector('input[name="yMin"]').value;
  const yMaxRaw = body.querySelector('input[name="yMax"]').value;

  const yMin = yMinRaw === '' ? null : Number(yMinRaw);
  const yMax = yMaxRaw === '' ? null : Number(yMaxRaw);

  return {
    lineWidth: Number.isFinite(lineWidth) ? lineWidth : 2,
    tension: Number.isFinite(tension) ? tension : 0,
    stepped: mode === 'stepped',
    showPoints,
    movingAvg: Number.isFinite(movingAvg) ? movingAvg : 0,
    showGrid,
    showLegend,
    scaleMode,
    yMin: Number.isFinite(yMin) ? yMin : null,
    yMax: Number.isFinite(yMax) ? yMax : null
  };
}

function exportChart(chartKey, format) {
  const canvas = getCanvas(chartKey);
  if (!canvas) return;
  const chart = window.Chart?.getChart(canvas);
  if (!chart) return;

  if (format === 'png') {
    const url = chart.toBase64Image('image/png', 1);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chartKey}.png`;
    link.click();
    return;
  }

  if (format === 'csv') {
    const rows = [];
    const headers = ['time', ...chart.data.datasets.map(ds => ds.label || 'Serie')];
    rows.push(headers.join(';'));
    const maxLen = Math.max(...chart.data.datasets.map(ds => ds.data.length));
    for (let idx = 0; idx < maxLen; idx += 1) {
      const time = chart.data.datasets[0]?.data?.[idx]?.x;
      const row = [time ? new Date(time).toISOString() : ''];
      chart.data.datasets.forEach(ds => {
        const point = ds.data[idx];
        row.push(point && Number.isFinite(point.y) ? String(point.y) : '');
      });
      rows.push(row.join(';'));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${chartKey}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

function openSettings(chartKey) {
  if (!dialog || !body) return;
  const def = getChartDefinition(chartKey);
  const state = getChartState(chartKey);
  if (!def || !state) return;
  currentChartKey = chartKey;
  ensureDialog();
  renderForm(def, state);
  
  // Ajouter les gestionnaires d'événements
  const pngBtn = body.querySelector(`#${exportPngId}`);
  const csvBtn = body.querySelector(`#${exportCsvId}`);
  const resetBtn = body.querySelector('#chart-reset-view');
  
  pngBtn?.addEventListener('click', () => exportChart(chartKey, 'png'));
  csvBtn?.addEventListener('click', () => exportChart(chartKey, 'csv'));
  resetBtn?.addEventListener('click', () => {
    resetChartView(chartKey);
    closeDialog();
  });
  
  if (titleEl) titleEl.textContent = `Réglages - ${def.key}`;
  if (subEl) subEl.textContent = def.canvasId;
  
  // Gérer la fermeture avec Escape
  const handleKeydown = (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      closeDialog();
    }
  };
  
  // Gérer la fermeture avec clic sur overlay
  const handleBackdropClick = (evt) => {
    if (evt.target === dialog) {
      closeDialog();
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  dialog.addEventListener('click', handleBackdropClick);
  
  // Stocker les gestionnaires pour les supprimer plus tard
  dialog._keydownHandler = handleKeydown;
  dialog._backdropHandler = handleBackdropClick;
  
  dialog.showModal();
}

function closeDialog() {
  if (!dialog) return;
  
  // Supprimer les gestionnaires d'événements
  if (dialog._keydownHandler) {
    document.removeEventListener('keydown', dialog._keydownHandler);
    delete dialog._keydownHandler;
  }
  if (dialog._backdropHandler) {
    dialog.removeEventListener('click', dialog._backdropHandler);
    delete dialog._backdropHandler;
  }
  
  dialog.close();
  currentChartKey = null;
}

if (form) {
  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    if (!currentChartKey) return;
    updateChartSettings(currentChartKey, gatherSettings());
    closeDialog();
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (!currentChartKey) return;
    resetChartSettings(currentChartKey);
    const state = getChartState(currentChartKey);
    if (state) fillValues(state);
  });
}

if (applyAllBtn) {
  applyAllBtn.addEventListener('click', () => {
    if (!currentChartKey) return;
    const nextSettings = gatherSettings();
    listCharts().forEach(key => updateChartSettings(key, nextSettings));
  });
}

if (dialog) {
  dialog.addEventListener('cancel', (evt) => {
    evt.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('close', () => { currentChartKey = null; });
}

document.addEventListener('chart:open-settings', (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  openSettings(chartKey);
});

document.addEventListener('chart:export', (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  openSettings(chartKey);
});

document.addEventListener('chart:reset-view', (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  resetChartView(chartKey);
});

export function initChartSettings() {
  ensureDialog();
}
