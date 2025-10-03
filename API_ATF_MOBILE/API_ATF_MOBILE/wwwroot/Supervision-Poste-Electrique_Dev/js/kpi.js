import { fmt, isValidNumber, formatDateTime } from './utils.js';
import { initCollapsibles } from './ui-collapsibles.js';
import { bindHoverTooltip } from './ui-tooltips.js';

const REGISTRY = new Map();
let detailsDialog = null;

const ICON_BY_KIND = {
  p_kw: '#i-bolt',
  q_kvar: '#i-bolt',
  pf: '#i-pf',
  u: '#i-wave',
  i: '#i-gauge',
  e: '#i-battery'
};

function ensureDialog() {
  if (detailsDialog) return detailsDialog;
  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="dialog-content">
      <header class="dialog-head">
        <div>
          <h2 class="text-lg font-semibold" id="kpi-detail-title">Details KPI</h2>
          <p class="text-xs text-slate-400" id="kpi-detail-sub">-</p>
        </div>
        <button type="submit" class="btn btn-soft">Fermer</button>
      </header>
      <div class="space-y-4">
        <div class="detail-row">
          <span>Valeur</span>
          <strong id="kpi-detail-value">-</strong>
        </div>
        <div class="detail-row">
          <span>Moyenne</span>
          <strong id="kpi-detail-avg">-</strong>
        </div>
        <div class="detail-row">
          <span>Max</span>
          <strong id="kpi-detail-max">-</strong>
        </div>
        <div class="detail-row">
          <span>Dernière mise à jour</span>
          <strong id="kpi-detail-ts">-</strong>
        </div>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = () => dialog.setAttribute('open', 'open');
    dialog.close = () => dialog.removeAttribute('open');
  }
  detailsDialog = dialog;
  return dialog;
}

function createIcon(iconId) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'icon stroke');
  const use = document.createElementNS(svgNS, 'use');
  use.setAttributeNS(null, 'href', iconId);
  svg.appendChild(use);
  return svg;
}

function resolveIcon(def) {
  if (def.icon) return def.icon.startsWith('#') ? def.icon : `#i-${def.icon}`;
  if (def.kind && ICON_BY_KIND[def.kind]) return ICON_BY_KIND[def.kind];
  const suffix = def.key?.split('.').pop();
  return suffix && ICON_BY_KIND[suffix] ? ICON_BY_KIND[suffix] : '#i-bolt';
}

function buildCard(def) {
  const card = document.createElement('div');
  card.className = 'kpi card';
  card.dataset.key = def.key;
  if (def.kind) card.dataset.kind = def.kind;

  const header = document.createElement('div');
  header.className = 'kpi-title';
  header.appendChild(createIcon(resolveIcon(def)));
  header.append(def.title || def.key);

  const stats = document.createElement('div');
  stats.className = 'kpi-stats';
  stats.innerHTML = `
    <div class="kpi-stats-labels">
      <span class="kpi-stat-label">MOYENNE</span>
      <span class="kpi-stat-label">MAX</span>
    </div>
    <div class="kpi-stats-values">
      <span class="kpi-stat-value" data-role="avg">-</span>
      <span class="kpi-stat-value" data-role="max">-</span>
    </div>`;

  const valueWrap = document.createElement('div');
  valueWrap.className = 'kpi-value';
  const valueEl = document.createElement('span');
  valueEl.className = 'kpi-value-number';
  valueEl.textContent = '-';
  const unitEl = document.createElement('span');
  unitEl.className = 'kpi-unit';
  unitEl.textContent = def.unit || '';
  valueWrap.append(valueEl, unitEl);

  card.append(header, valueWrap, stats);

  header.addEventListener('click', () => {
    const dialog = ensureDialog();
    const entry = REGISTRY.get(def.key);
    if (!entry) return;
    dialog.querySelector('#kpi-detail-title').textContent = def.title;
    dialog.querySelector('#kpi-detail-sub').textContent = def.key;
    dialog.querySelector('#kpi-detail-value').textContent = entry.lastValue;
    dialog.querySelector('#kpi-detail-avg').textContent = entry.lastAvg;
    dialog.querySelector('#kpi-detail-max').textContent = entry.lastMax;
    dialog.querySelector('#kpi-detail-ts').textContent = entry.lastTs ? formatDateTime(entry.lastTs) : '-';
    dialog.showModal();
  });
  bindHoverTooltip(header, 'Cliquer pour ouvrir/fermer');

  return {
    element: card,
    valueEl,
    unitEl,
    avgEl: stats.querySelector('[data-role="avg"]'),
    maxEl: stats.querySelector('[data-role="max"]'),
    decimals: def.decimals ?? 1
  };
}

export const Kpi = {
  create(containerId, defs) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`container #${containerId} introuvable`);
    defs.forEach(def => {
      const card = buildCard(def);
      container.appendChild(card.element);
      REGISTRY.set(def.key, {
        element: card.element,
        valueEl: card.valueEl,
        unitEl: card.unitEl,
        avgEl: card.avgEl,
        maxEl: card.maxEl,
        config: def,
        decimals: card.decimals,
        lastValue: '-',
        lastAvg: '-',
        lastMax: '-',
        lastTs: null
      });
    });
  },

  update(key, payload) {
    const entry = REGISTRY.get(key);
    if (!entry) return;
    const { value, avg, max, unit, ts } = payload;
    const decimals = entry.config.decimals ?? entry.decimals;

    if (isValidNumber(value)) {
      entry.valueEl.textContent = fmt(value, decimals);
      entry.unitEl.textContent = unit ? ` ${unit}` : '';
    } else {
      entry.valueEl.textContent = '-';
      entry.unitEl.textContent = '';
    }

    if (entry.avgEl) {
      entry.avgEl.textContent = isValidNumber(avg) ? fmt(avg, decimals) + (unit ? ` ${unit}` : '') : '-';
    }
    if (entry.maxEl) {
      entry.maxEl.textContent = isValidNumber(max) ? fmt(max, decimals) + (unit ? ` ${unit}` : '') : '-';
    }

    entry.lastValue = entry.valueEl.textContent;
    entry.lastAvg = entry.avgEl?.textContent || '-';
    entry.lastMax = entry.maxEl?.textContent || '-';
    entry.lastTs = ts ?? Date.now();
  }
};

export function initKpiCollapsibles(rootIds = []) {
  rootIds.forEach(id => {
    const root = document.getElementById(id);
    if (root) initCollapsibles(root);
  });
}
