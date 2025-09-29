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
    <section class="settings-group">
      <h3 class="settings-title">Courbe</h3>
      <div class="settings-grid">
        <label class="settings-field">
          <span>Epaisseur</span>
          <input type="range" min="1" max="6" step="1" name="lineWidth" value="${state.settings.lineWidth}">
        </label>
        <label class="settings-field">
          <span>Interpolation</span>
          <select name="mode">
            <option value="line">Lineaire</option>
            <option value="stepped">Escaliers</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Lissage</span>
          <input type="range" min="0" max="0.6" step="0.05" name="tension" value="${state.settings.tension}">
        </label>
        <label class="settings-field checkbox">
          <input type="checkbox" name="showPoints"> Afficher les points
        </label>
        <label class="settings-field">
          <span>Moyenne mobile</span>
          <select name="movingAvg">
            <option value="0">Aucun</option>
            <option value="3">3 points</option>
            <option value="5">5 points</option>
            <option value="9">9 points</option>
          </select>
        </label>
      </div>
    </section>
    <section class="settings-group">
      <h3 class="settings-title">Axes</h3>
      <div class="settings-grid">
        <fieldset class="settings-field fieldset">
          <legend>Echelle Y</legend>
          <label><input type="radio" name="scaleMode" value="linear"> Lineaire</label>
          <label><input type="radio" name="scaleMode" value="log"> Logarithmique</label>
        </fieldset>
        <label class="settings-field checkbox">
          <input type="checkbox" name="showGrid"> Afficher la grille
        </label>
        <label class="settings-field">
          <span>Min Y</span>
          <input type="number" name="yMin" step="0.1" placeholder="auto">
        </label>
        <label class="settings-field">
          <span>Max Y</span>
          <input type="number" name="yMax" step="0.1" placeholder="auto">
        </label>
      </div>
    </section>
    <section class="settings-group">
      <h3 class="settings-title">Affichage</h3>
      <div class="settings-grid">
        <label class="settings-field checkbox">
          <input type="checkbox" name="showLegend"> Afficher la legende
        </label>
      </div>
    </section>
    <section class="settings-group">
      <h3 class="settings-title">Export</h3>
      <div class="settings-actions">
        <button type="button" class="btn btn-soft" id="${exportPngId}">Exporter PNG</button>
        <button type="button" class="btn btn-soft" id="${exportCsvId}">Exporter CSV</button>
      </div>
    </section>
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
  fillValues(state);
  const pngBtn = body.querySelector(`#${exportPngId}`);
  const csvBtn = body.querySelector(`#${exportCsvId}`);
  pngBtn?.addEventListener('click', () => exportChart(chartKey, 'png'));
  csvBtn?.addEventListener('click', () => exportChart(chartKey, 'csv'));
  if (titleEl) titleEl.textContent = `Réglages - ${def.key}`;
  if (subEl) subEl.textContent = def.canvasId;
  dialog.showModal();
}

if (form) {
  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    if (!currentChartKey) return;
    updateChartSettings(currentChartKey, gatherSettings());
    dialog.close();
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
    dialog.close();
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
