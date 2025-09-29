// js/main.js
import { $, fmt } from './utils.js';
import { state, setWindow, setApiBase } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries, fetchDailySummary } from './api.js';
import { refreshCharts, initializeCharts, setChartActive, resetChartView, listCharts } from './charts.js';
import { Kpi, initKpiCollapsibles } from './kpi.js';
import { initCollapsibles } from './ui-collapsibles.js';
import { initSettingsDialog } from './settings.js';
import { initContextMenus } from './contextmenu.js';
import { initChartSettings } from './chart-settings.js';
import { showToast } from './ui.js';

const ICONS = {
  p_kw: '#i-bolt',
  q_kvar: '#i-bolt',
  pf: '#i-pf',
  u: '#i-wave',
  i: '#i-gauge',
  e: '#i-battery'
};

function handleCollapsibleChange(event) {
  const detail = event.detail || {};
  const { id, expanded, type, element, init } = detail;
  if (!id) return;

  if (type === 'chart') {
    setChartActive(id, expanded !== false);
    if (expanded && !init) refreshCharts();
    return;
  }

  if (type === 'section' && element) {
    element.querySelectorAll('[data-collapsible-type="chart"]').forEach(card => {
      const canvas = card.querySelector('canvas');
      if (!canvas || !canvas.id) return;
      setChartActive(canvas.id, expanded !== false);
    });
    if (expanded && !init) refreshCharts();
  }
}

document.addEventListener('collapsible:change', handleCollapsibleChange);

function syncWelcome() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const welcomeEl = $('#welcome-message');
    const userName = user ? (user.Nom || user.nom || user.NOM) : null;
    if (userName && welcomeEl) {
      const firstName = userName.split(' ')[0];
      welcomeEl.innerHTML = `Bonjour <span class="font-bold">${firstName}</span> !`;
    }
  } catch (err) {
    console.warn('[main] welcome failed', err);
  }
}

function syncModeIndicator() {
  const indicator = $('#mode-indicator');
  if (!indicator) return;
  if (state.modeDev) {
    indicator.textContent = state.demoEnabled ? 'Mode développement (mock)' : 'Mode développement';
    indicator.classList.add('badge-dev-soft');
  } else {
    indicator.textContent = 'Mode production';
    indicator.classList.remove('badge-dev-soft');
  }
}

function initClock() {
  const clockEl = $('#top-clock');
  const update = () => {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  update();
  setInterval(update, 30_000);
}

function initWindows() {
  document.querySelectorAll('.sel').forEach(select => {
    select.addEventListener('change', async () => {
      const key = select.id.split('-')[1];
      setWindow(key, Number(select.value));
      const trId = key.includes('1') ? 1 : 2;
      try {
        await loadSeries(trId);
        refreshCharts();
      } catch (err) {
        console.error('[main] change window failed', err);
        showToast('Erreur lors de la mise à jour de la fenêtre', { variant: 'error' });
      }
      recomputeAdaptivePolling();
    });
  });

  const sync = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val);
  };
  sync('win-p1', state.win.p1);
  sync('win-u1', state.win.u1);
  sync('win-pf1', state.win.pf1);
  sync('win-p2', state.win.p2);
  sync('win-u2', state.win.u2);
  sync('win-pf2', state.win.pf2);
}

function decorateKpiCards(rootIds = ['tr1-kpis', 'tr2-kpis']) {
  rootIds.forEach(id => {
    const root = document.getElementById(id);
    if (!root) return;
    root.querySelectorAll('.kpi').forEach(card => {
      if (card.querySelector('svg')) return;
      const kind = card.dataset.kind;
      const title = card.querySelector('.kpi-title');
      if (!title || !kind || !ICONS[kind]) return;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon stroke');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttributeNS(null, 'href', ICONS[kind]);
      icon.appendChild(use);
      title.prepend(icon);
    });
  });
}

function updateDailyMetrics(data) {
  const energy = $('#daily-kwh');
  const power = $('#daily-kw-max');
  const pf = $('#daily-pf-min');
  if (energy) energy.textContent = data?.kwh != null ? fmt(data.kwh, 1) : '\u2014';
  if (power) power.textContent = data?.kwMax != null ? fmt(data.kwMax, 1) : '\u2014';
  if (pf) pf.textContent = data?.pfMin != null ? fmt(data.pfMin, 3) : '\u2014';
}

async function loadDailySummary(date) {
  try {
    const summary = await fetchDailySummary(date);
    updateDailyMetrics(summary);
  } catch (err) {
    console.error('[main] daily summary failed', err);
    showToast("Impossible de charger la vue journalière", { variant: 'error' });
  }
}

function initDailyView() {
  const input = $('#daily-date');
  const prev = $('#daily-prev');
  const next = $('#daily-next');
  if (!input) return;

  const setDate = (date) => {
    const iso = date.toISOString().slice(0, 10);
    input.value = iso;
    loadDailySummary(iso);
  };

  input.addEventListener('change', () => {
    const value = input.value;
    if (value) loadDailySummary(value);
  });

  prev?.addEventListener('click', () => {
    if (!input.value) return;
    const date = new Date(input.value);
    date.setDate(date.getDate() - 1);
    setDate(date);
  });

  next?.addEventListener('click', () => {
    if (!input.value) return;
    const date = new Date(input.value);
    date.setDate(date.getDate() + 1);
    setDate(date);
  });

  setDate(new Date());
}

function initModeBanner() {
  if (!state.modeDev) return;
  const banner = document.querySelector('.dev-banner');
  if (banner) banner.classList.remove('hidden');
}

function initToolbars() {
  document.querySelectorAll('.chart-btn[data-action="export"]').forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const chartKey = btn.closest('[data-chart]')?.dataset.chart;
      if (!chartKey) return;
      document.dispatchEvent(new CustomEvent('chart:export', { detail: { chartKey } }));
    });
  });

  document.querySelectorAll('.chart-btn[data-action="settings"]').forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const chartKey = btn.closest('[data-chart]')?.dataset.chart;
      if (!chartKey) return;
      document.dispatchEvent(new CustomEvent('chart:open-settings', { detail: { chartKey } }));
    });
  });

  document.querySelectorAll('.chart-btn[data-action="reset"]').forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const chartKey = btn.closest('[data-chart]')?.dataset.chart;
      if (!chartKey) return;
      document.dispatchEvent(new CustomEvent('chart:reset-view', { detail: { chartKey } }));
    });
  });
}

function syncSelectorsFromState() {
  ['p1', 'u1', 'pf1', 'p2', 'u2', 'pf2'].forEach(key => {
    const element = document.getElementById(`win-${key}`);
    if (element) element.value = String(state.win[key]);
  });
}

function watchSettingsChanges() {
  document.addEventListener('settings:changed', (evt) => {
    const { apiBase } = evt.detail || {};
    if (apiBase) {
      showToast('API mise à jour, relance du polling', { variant: 'info' });
      startPolling();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialiser l'API base directement
  setApiBase('http://10.250.13.4:8088/api/energy');
  console.log('🌐 API configurée:', state.apiBase);

  syncWelcome();
  syncModeIndicator();
  initModeBanner();
  initClock();
  initSettingsDialog();
  initContextMenus();
  initChartSettings();
  initCollapsibles(document);
  initKpiCollapsibles(['tr1-kpis', 'tr2-kpis']);
  initToolbars();
  initDailyView();
  initWindows();
  syncSelectorsFromState();
  decorateKpiCards();
  watchSettingsChanges();

  initializeCharts();
  refreshCharts();

  try {
    await loadSeries(1);
    await loadSeries(2);
    refreshCharts();
  } catch (err) {
    console.error('[main] initial load failed', err);
  }

  attachVisibilityHandler();
  await startPolling();

  document.body.classList.add('ready');
});

// expose for other modules if needed
export function listRegisteredCharts() {
  return listCharts();
}
