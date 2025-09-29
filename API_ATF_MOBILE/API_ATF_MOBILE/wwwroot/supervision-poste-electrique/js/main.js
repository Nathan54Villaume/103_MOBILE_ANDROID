// js/main.js
import { $, fmt } from './utils.js';
import { state, setWindow, setApiBase } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
// NOUVEAU SYSTÈME DE CHARTS
import { initChart, updateChart, resetChart, getChart } from '../charts/index.js';
// Ancien système conservé pour compatibilité temporaire
import { refreshCharts, setChartActive, resetChartView, listCharts } from './charts.js';
import { bufs } from './state.js';
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
    if (expanded && !init) {
      // refreshCharts(); // Ancien système
      refreshNewChartSystem(); // NOUVEAU système
    }
    return;
  }

  if (type === 'section' && element) {
    element.querySelectorAll('[data-collapsible-type="chart"]').forEach(card => {
      const canvas = card.querySelector('canvas');
      if (!canvas || !canvas.id) return;
      setChartActive(canvas.id, expanded !== false);
    });
    if (expanded && !init) {
      // refreshCharts(); // Ancien système
      refreshNewChartSystem(); // NOUVEAU système
    }
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
      const minutes = Number(select.value);
      
      // Ancien système (à conserver pour la compatibilité)
      setWindow(key, minutes);
      const trId = key.includes('1') ? 1 : 2;
      
      try {
        // Nouveau système - gestion des bases de temps via ChartHost
        const { handleTimeRangeChange } = await import('../charts/bridge/TimeRangeBridge.js');
        handleTimeRangeChange(select.id, minutes);
        
        // Ancien système de chargement de données
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
  // Définitions des KPI pour TR1 - Ordre selon la photo
  const tr1KpiDefs = [
    { key: 'tr1.p_kw', title: 'Puissance', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr1.u1', title: 'U12', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr1.u2', title: 'U23', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr1.u3', title: 'U31', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr1.pf', title: 'Facteur de Puissance', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr1.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr1.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 0 },
    { key: 'tr1.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 0 },
    { key: 'tr1.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 0 },
    { key: 'tr1.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
  ];

  // Définitions des KPI pour TR2 - Ordre selon la photo
  const tr2KpiDefs = [
    { key: 'tr2.p_kw', title: 'Puissance', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr2.u1', title: 'U12', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr2.u2', title: 'U23', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr2.u3', title: 'U31', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr2.pf', title: 'Facteur de Puissance', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr2.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr2.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
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
  // Boutons export supprimés - maintenant dans les paramètres

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

  // Initialisation du NOUVEAU système de charts
  console.log('🚀 [main] Initializing NEW chart system...');
  initializeNewChartSystem();
  
  // Conserve l'ancien système pour backup temporaire
  console.log('🔄 [main] Initializing backup chart system...');
  // initializeCharts(); // Temporairement désactivé
  // refreshCharts();    // Temporairement désactivé
  
  // Restaurer les bases de temps depuis localStorage après initialisation
  setTimeout(async () => {
    try {
      const { restoreAllTimeRanges } = await import('../charts/bridge/TimeRangeBridge.js');
      restoreAllTimeRanges();
    } catch (err) {
      console.warn('[main] Failed to restore time ranges:', err);
    }
  }, 1000);

  try {
    await loadSeries(1);
    await loadSeries(2);
    // refreshCharts(); // Ancien système désactivé
    refreshNewChartSystem(); // NOUVEAU système
  } catch (err) {
    console.error('[main] initial load failed', err);
  }

  attachVisibilityHandler();
  await startPolling();

  document.body.classList.add('ready');
});

// expose for other modules if needed
// === NOUVEAU SYSTÈME DE CHARTS ===
function initializeNewChartSystem() {
  const chartDefinitions = [
    { cardId: 'tr1-power', canvasId: 'chartP1', config: { type: 'power', tr: 1 } },
    { cardId: 'tr1-tension', canvasId: 'chartU1', config: { type: 'voltage', tr: 1 } },
    { cardId: 'tr1-pf', canvasId: 'chartPF1', config: { type: 'power-factor', tr: 1 } },
    { cardId: 'tr2-power', canvasId: 'chartP2', config: { type: 'power', tr: 2 } },
    { cardId: 'tr2-tension', canvasId: 'chartU2', config: { type: 'voltage', tr: 2 } },
    { cardId: 'tr2-pf', canvasId: 'chartPF2', config: { type: 'power-factor', tr: 2 } }
  ];
  
  chartDefinitions.forEach(({ cardId, canvasId, config }) => {
    try {
      console.log(`[main] Initializing new chart system: ${cardId} -> ${canvasId}`);
      const chartInstance = initChart(cardId, canvasId, config);
      if (chartInstance) {
        console.log(`✅ [main] Chart ${cardId} initialized successfully`);
      } else {
        console.warn(`⚠️ [main] Chart ${cardId} initialization failed`);
      }
    } catch (error) {
      console.error(`❌ [main] Error initializing chart ${cardId}:`, error);
    }
  });
}

// Fonction pour alimenter les nouveaux charts avec les données existantes
function refreshNewChartSystem() {
  console.log('🔄 [main] Refreshing new chart system with data...');
  
  const chartDataMap = {
    'tr1-power': { bufferKeys: ['p1', 'q1'], labels: ['Puissance active', 'Puissance réactive'], colors: ['#3b82f6', '#f59e0b'] },
    'tr1-tension': { bufferKeys: ['u1_12', 'u1_23', 'u1_31'], labels: ['U12', 'U23', 'U31'], colors: ['#ef4444', '#10b981', '#8b5cf6'] },
    'tr1-pf': { bufferKeys: ['pf1'], labels: ['Facteur de puissance'], colors: ['#06b6d4'] },
    'tr2-power': { bufferKeys: ['p2', 'q2'], labels: ['Puissance active', 'Puissance réactive'], colors: ['#3b82f6', '#f59e0b'] },
    'tr2-tension': { bufferKeys: ['u2_12', 'u2_23', 'u2_31'], labels: ['U12', 'U23', 'U31'], colors: ['#ef4444', '#10b981', '#8b5cf6'] },
    'tr2-pf': { bufferKeys: ['pf2'], labels: ['Facteur de puissance'], colors: ['#06b6d4'] }
  };
  
  Object.entries(chartDataMap).forEach(([cardId, { bufferKeys, labels, colors }]) => {
    try {
      const chartInstance = getChart(cardId);
      if (!chartInstance) {
        console.warn(`[main] Chart ${cardId} not found for data refresh`);
        return;
      }
      
      const datasets = [];
      bufferKeys.forEach((bufferKey, index) => {
        const buffer = bufs[bufferKey];
        if (!buffer || !buffer.length) {
          console.log(`[main] No data in buffer ${bufferKey}`);
          return;
        }
        
        const data = buffer.map(item => ({
          x: item.x,  // Format correct selon appendUnique()
          y: item.y   // Format correct selon appendUnique()
        }));
        
        datasets.push({
          label: labels[index] || bufferKey,
          data: data,
          borderColor: colors[index] || '#3b82f6',
          backgroundColor: colors[index] + '20' || '#3b82f620',
          fill: false,
          tension: 0.1,
          pointRadius: 0,           // Pas de points visibles
          pointHoverRadius: 0,      // Pas de points au survol non plus
          pointBorderWidth: 0,      // Pas de bordure de points
          pointBackgroundColor: 'transparent'  // Points transparents
        });
        
        console.log(`[main] Dataset ${bufferKey} created with ${data.length} points`);
      });
      
      if (datasets.length > 0) {
        updateChart(cardId, datasets);
        console.log(`✅ [main] Chart ${cardId} updated with ${datasets.length} dataset(s)`);
      }
      
    } catch (error) {
      console.error(`❌ [main] Error refreshing chart ${cardId}:`, error);
    }
  });
}

// Export pour utilisation dans polling.js
export { refreshNewChartSystem };

export function listRegisteredCharts() {
  return listCharts();
}
