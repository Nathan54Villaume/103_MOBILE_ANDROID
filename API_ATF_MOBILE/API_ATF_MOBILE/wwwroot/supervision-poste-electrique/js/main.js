// js/main.js
import { $, fmt } from './utils.js';
import { state, setWindow, setApiBase } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
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
  // Fonction supprimée - plus de barre d'information supérieure
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

// Créer et initialiser les KPI pour les transformateurs
// Cette fonction remplace l'ancienne decorateKpiCards() qui ne créait pas les KPI
function initKPIs() {
  // Définitions des KPI pour TR1
  const tr1KpiDefs = [
    { key: 'tr1.p_kw', title: 'Puissance active', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr1.q_kvar', title: 'Puissance réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr1.pf', title: 'Facteur de puissance', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr1.u1', title: 'Tension U12', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr1.u2', title: 'Tension U23', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr1.u3', title: 'Tension U31', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr1.i1', title: 'Courant I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr1.i2', title: 'Courant I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr1.i3', title: 'Courant I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr1.e_kwh', title: 'Énergie', unit: 'kWh', kind: 'e', decimals: 1 }
  ];

  // Définitions des KPI pour TR2
  const tr2KpiDefs = [
    { key: 'tr2.p_kw', title: 'Puissance active', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr2.q_kvar', title: 'Puissance réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr2.pf', title: 'Facteur de puissance', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr2.u1', title: 'Tension U12', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr2.u2', title: 'Tension U23', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr2.u3', title: 'Tension U31', unit: 'V', kind: 'u', decimals: 1 },
    { key: 'tr2.i1', title: 'Courant I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i2', title: 'Courant I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i3', title: 'Courant I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.e_kwh', title: 'Énergie', unit: 'kWh', kind: 'e', decimals: 1 }
  ];

  // Créer les KPI
  try {
    Kpi.create('tr1-kpis', tr1KpiDefs);
    Kpi.create('tr2-kpis', tr2KpiDefs);
    console.log('✅ KPI créés avec succès');
  } catch (err) {
    console.error('❌ Erreur lors de la création des KPI:', err);
  }
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
  initModeBanner();
  initClock();
  initSettingsDialog();
  initContextMenus();
  initChartSettings();
  initCollapsibles(document);
  initKPIs(); // Créer les KPI
  initKpiCollapsibles(['tr1-kpis', 'tr2-kpis']);
  initToolbars();
  initWindows();
  syncSelectorsFromState();
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
