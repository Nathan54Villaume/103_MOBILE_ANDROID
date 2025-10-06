// js/main.js
import { $, fmt } from './utils.js';
import { state, setWindow, setApiBase } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
// NOUVEAU SYSTÈME DE CHARTS
import { initChart, updateChart, resetChart, getChart } from '../charts/index.js';
import { bufs } from './state.js';
import { Kpi, initKpiCollapsibles } from './kpi.js';
import { initCollapsibles } from './ui-collapsibles.js';
import { initSettingsDialog } from './settings.js';
// Ancien système de menu contextuel supprimé - on utilise le nouveau système dans ChartHost.js
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
    if (expanded && !init) {
      refreshNewChartSystem(); // NOUVEAU système
    }
    return;
  }

  if (type === 'section' && element) {
    if (expanded && !init) {
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
  // Support pour les classes .sel et les selects dans .tesla-btn
  const selectors = document.querySelectorAll('.sel, select[id^="win-"]');
  selectors.forEach(select => {
    select.addEventListener('change', async () => {
      const key = select.id.split('-')[1];
      const minutes = Number(select.value);
      
      // Ancien système (à conserver pour la compatibilité)
      setWindow(key, minutes);
      // Déterminer le trId basé sur la clé (p1, u1, pf1 -> TR1, etc.)
      const trId = key.match(/\d+/)?.[0] || '1';
      
      try {
        // Nouveau système - gestion des bases de temps via ChartHost
        const { handleTimeRangeChange } = await import('../charts/bridge/TimeRangeBridge.js');
        handleTimeRangeChange(select.id, minutes);
        
        // Chargement de données pour le nouveau système
        await loadSeries(trId);
        refreshNewChartSystem();
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
    { key: 'tr1.pf', title: 'Cos φ', unit: '', kind: 'pf', decimals: 3 },
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
    { key: 'tr2.pf', title: 'Cos φ', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr2.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr2.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr2.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
  ];

  // Définitions des KPI pour TR3 - Ordre selon la photo
  const tr3KpiDefs = [
    { key: 'tr3.p_kw', title: 'Puissance', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr3.u1', title: 'U12', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr3.u2', title: 'U23', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr3.u3', title: 'U31', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr3.pf', title: 'Cos φ', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr3.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr3.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr3.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr3.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr3.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
  ];

  // Définitions des KPI pour TR4 - Ordre selon la photo
  const tr4KpiDefs = [
    { key: 'tr4.p_kw', title: 'Puissance', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr4.u1', title: 'U12', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr4.u2', title: 'U23', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr4.u3', title: 'U31', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr4.pf', title: 'Cos φ', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr4.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr4.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr4.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr4.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr4.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
  ];

  // Définitions des KPI pour TR5 - Ordre selon la photo
  const tr5KpiDefs = [
    { key: 'tr5.p_kw', title: 'Puissance', unit: 'kW', kind: 'p_kw', decimals: 1 },
    { key: 'tr5.u1', title: 'U12', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr5.u2', title: 'U23', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr5.u3', title: 'U31', unit: 'V', kind: 'u', decimals: 0 },
    { key: 'tr5.pf', title: 'Cos φ', unit: '', kind: 'pf', decimals: 3 },
    { key: 'tr5.q_kvar', title: 'Réactive', unit: 'kvar', kind: 'q_kvar', decimals: 1 },
    { key: 'tr5.i1', title: 'I1', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr5.i2', title: 'I2', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr5.i3', title: 'I3', unit: 'A', kind: 'i', decimals: 1 },
    { key: 'tr5.e_kwh', title: 'Énergie', unit: 'MWh', kind: 'e', decimals: 1 }
  ];

  // Créer les KPI
  try {
    Kpi.create('tr1-kpis', tr1KpiDefs);
    Kpi.create('tr2-kpis', tr2KpiDefs);
    Kpi.create('tr3-kpis', tr3KpiDefs);
    Kpi.create('tr4-kpis', tr4KpiDefs);
    Kpi.create('tr5-kpis', tr5KpiDefs);
    // KPI créés avec succès
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

  // Support pour les classes .chart-btn et .tesla-btn
  document.querySelectorAll('.chart-btn[data-action="settings"], .tesla-btn[data-action="settings"]').forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const chartKey = btn.closest('[data-chart]')?.dataset.chart;
      if (!chartKey) return;
      document.dispatchEvent(new CustomEvent('chart:open-settings', { detail: { chartKey } }));
    });
  });

  document.querySelectorAll('.chart-btn[data-action="reset"], .tesla-btn[data-action="reset"]').forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const chartKey = btn.closest('[data-chart]')?.dataset.chart;
      if (!chartKey) return;
      document.dispatchEvent(new CustomEvent('chart:reset-view', { detail: { chartKey } }));
    });
  });
}

function syncSelectorsFromState() {
  ['p1', 'u1', 'pf1', 'p2', 'u2', 'pf2', 'p3', 'u3', 'pf3', 'p4', 'u4', 'pf4', 'p5', 'u5', 'pf5'].forEach(key => {
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
  // Afficher le loader immédiatement au chargement
  const { showLoader } = await import('./ui.js');
  showLoader('Initialisation de l\'interface...');
  
  // Initialiser l'API base directement
  setApiBase('http://10.250.13.4/api/energy_Poste_19');
  // API configurée

  syncWelcome();
  initModeBanner();
  initClock();
  initSettingsDialog();
  // initContextMenus(); // Ancien système supprimé - menu contextuel géré par ChartHost.js
  initChartSettings();
  initCollapsibles(document);
  initKPIs(); // Créer les KPI
  initKpiCollapsibles(['tr1-kpis', 'tr2-kpis', 'tr3-kpis', 'tr4-kpis', 'tr5-kpis']);
  initToolbars();
  initWindows();
  syncSelectorsFromState();
  watchSettingsChanges();

  // Initialisation du NOUVEAU système de charts
  showLoader('Initialisation des graphiques...');
  initializeNewChartSystem();
  
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
    showLoader('Chargement des données TR1...');
    await loadSeries(1);
    showLoader('Chargement des données TR2...');
    await loadSeries(2);
    showLoader('Chargement des données TR3...');
    await loadSeries(3);
    showLoader('Chargement des données TR4...');
    await loadSeries(4);
    showLoader('Chargement des données TR5...');
    await loadSeries(5);
    showLoader('Mise à jour des graphiques...');
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
    { cardId: 'tr2-pf', canvasId: 'chartPF2', config: { type: 'power-factor', tr: 2 } },
    { cardId: 'tr3-power', canvasId: 'chartP3', config: { type: 'power', tr: 3 } },
    { cardId: 'tr3-tension', canvasId: 'chartU3', config: { type: 'voltage', tr: 3 } },
    { cardId: 'tr3-pf', canvasId: 'chartPF3', config: { type: 'power-factor', tr: 3 } },
    { cardId: 'tr4-power', canvasId: 'chartP4', config: { type: 'power', tr: 4 } },
    { cardId: 'tr4-tension', canvasId: 'chartU4', config: { type: 'voltage', tr: 4 } },
    { cardId: 'tr4-pf', canvasId: 'chartPF4', config: { type: 'power-factor', tr: 4 } },
    { cardId: 'tr5-power', canvasId: 'chartP5', config: { type: 'power', tr: 5 } },
    { cardId: 'tr5-tension', canvasId: 'chartU5', config: { type: 'voltage', tr: 5 } },
    { cardId: 'tr5-pf', canvasId: 'chartPF5', config: { type: 'power-factor', tr: 5 } }
  ];
  
  chartDefinitions.forEach(({ cardId, canvasId, config }) => {
    try {
      const chartInstance = initChart(cardId, canvasId, config);
      if (!chartInstance) {
        console.warn(`[main] Chart ${cardId} initialization failed`);
      }
    } catch (error) {
      console.error(`[main] Error initializing chart ${cardId}:`, error);
    }
  });
}

// Fonction pour alimenter les nouveaux charts avec les données existantes
function refreshNewChartSystem() {
  
  const chartDataMap = {
    'tr1-power': { 
      bufferKeys: ['p1', 'q1'], 
      signalIds: ['P_TR1', 'Q_TR1'], 
      labels: ['Puissance active — TR1', 'Puissance réactive — TR1'], 
      colors: ['#eab308', '#3b82f6'] 
    },
    'tr1-tension': { 
      bufferKeys: ['u1_12', 'u1_23', 'u1_31'], 
      signalIds: ['U12_TR1', 'U23_TR1', 'U31_TR1'], 
      labels: ['U12 — TR1', 'U23 — TR1', 'U31 — TR1'], 
      colors: ['#10b981', '#10b981', '#10b981'] 
    },
    'tr1-pf': { 
      bufferKeys: ['pf1'], 
      signalIds: ['PF_TR1'], 
      labels: ['Cos φ — TR1'], 
      colors: ['#06b6d4'] 
    },
    'tr2-power': { 
      bufferKeys: ['p2', 'q2'], 
      signalIds: ['P_TR2', 'Q_TR2'], 
      labels: ['Puissance active — TR2', 'Puissance réactive — TR2'], 
      colors: ['#eab308', '#3b82f6'] 
    },
    'tr2-tension': { 
      bufferKeys: ['u2_12', 'u2_23', 'u2_31'], 
      signalIds: ['U12_TR2', 'U23_TR2', 'U31_TR2'], 
      labels: ['U12 — TR2', 'U23 — TR2', 'U31 — TR2'], 
      colors: ['#10b981', '#10b981', '#10b981'] 
    },
    'tr2-pf': { 
      bufferKeys: ['pf2'], 
      signalIds: ['PF_TR2'], 
      labels: ['Cos φ — TR2'], 
      colors: ['#06b6d4'] 
    },
    'tr3-power': { 
      bufferKeys: ['p3', 'q3'], 
      signalIds: ['P_TR3', 'Q_TR3'], 
      labels: ['Puissance active — TR3', 'Puissance réactive — TR3'], 
      colors: ['#eab308', '#3b82f6'] 
    },
    'tr3-tension': { 
      bufferKeys: ['u3_12', 'u3_23', 'u3_31'], 
      signalIds: ['U12_TR3', 'U23_TR3', 'U31_TR3'], 
      labels: ['U12 — TR3', 'U23 — TR3', 'U31 — TR3'], 
      colors: ['#10b981', '#10b981', '#10b981'] 
    },
    'tr3-pf': { 
      bufferKeys: ['pf3'], 
      signalIds: ['PF_TR3'], 
      labels: ['Cos φ — TR3'], 
      colors: ['#06b6d4'] 
    },
    'tr4-power': { 
      bufferKeys: ['p4', 'q4'], 
      signalIds: ['P_TR4', 'Q_TR4'], 
      labels: ['Puissance active — TR4', 'Puissance réactive — TR4'], 
      colors: ['#eab308', '#3b82f6'] 
    },
    'tr4-tension': { 
      bufferKeys: ['u4_12', 'u4_23', 'u4_31'], 
      signalIds: ['U12_TR4', 'U23_TR4', 'U31_TR4'], 
      labels: ['U12 — TR4', 'U23 — TR4', 'U31 — TR4'], 
      colors: ['#10b981', '#10b981', '#10b981'] 
    },
    'tr4-pf': { 
      bufferKeys: ['pf4'], 
      signalIds: ['PF_TR4'], 
      labels: ['Cos φ — TR4'], 
      colors: ['#06b6d4'] 
    },
    'tr5-power': { 
      bufferKeys: ['p5', 'q5'], 
      signalIds: ['P_TR5', 'Q_TR5'], 
      labels: ['Puissance active — TR5', 'Puissance réactive — TR5'], 
      colors: ['#eab308', '#3b82f6'] 
    },
    'tr5-tension': { 
      bufferKeys: ['u5_12', 'u5_23', 'u5_31'], 
      signalIds: ['U12_TR5', 'U23_TR5', 'U31_TR5'], 
      labels: ['U12 — TR5', 'U23 — TR5', 'U31 — TR5'], 
      colors: ['#10b981', '#10b981', '#10b981'] 
    },
    'tr5-pf': { 
      bufferKeys: ['pf5'], 
      signalIds: ['PF_TR5'], 
      labels: ['Cos φ — TR5'], 
      colors: ['#06b6d4'] 
    }
  };
  
  Object.entries(chartDataMap).forEach(([cardId, { bufferKeys, signalIds, labels, colors }]) => {
    try {
      const chartInstance = getChart(cardId);
      if (!chartInstance) {
        console.warn(`[main] Chart ${cardId} not found for data refresh`);
        return;
      }
      
      // Vérifier si le chart est zoomé (arrêter le rafraîchissement automatique)
      const canvasId = chartInstance.host?.canvasId;
      if (canvasId && isChartZoomed(canvasId)) {
        console.log(`[main] Chart ${canvasId} is zoomed, skipping auto-refresh`);
        return;
      }
      
      // Récupérer l'état actuel des datasets pour préserver la visibilité
      const currentDatasets = chartInstance.host.chart?.data?.datasets || [];
      const datasetVisibility = {};
      currentDatasets.forEach(dataset => {
        if (dataset.label) {
          datasetVisibility[dataset.label] = dataset.hidden || false;
        }
      });
      
      const datasets = [];
      bufferKeys.forEach((bufferKey, index) => {
        const buffer = bufs[bufferKey];
        if (!buffer || !buffer.length) {
          return;
        }
        
        const data = buffer.map(item => ({
          x: item.x,  // Format correct selon appendUnique()
          y: item.y   // Format correct selon appendUnique()
        }));
        
        // Récupérer les paramètres sauvegardés
        const savedSettings = chartInstance.host.currentSettings;
        const lineWidth = savedSettings?.lineWidth || 2;
        const tension = savedSettings?.tension || 0.1;
        const alpha = savedSettings?.alpha || 20;
        
        // Calculer la couleur de fond avec transparence
        const baseColor = colors[index] || '#3b82f6';
        const alphaHex = Math.round(alpha * 2.55).toString(16).padStart(2, '0');
        const backgroundColor = baseColor + alphaHex;
        
        const label = labels[index] || bufferKey;
        
        datasets.push({
          label: label,
          signalId: signalIds[index], // Ajouter l'ID du signal pour le menu contextuel
          data: data,
          borderColor: baseColor,
          backgroundColor: backgroundColor,
          fill: false,
          tension: tension,
          borderWidth: lineWidth,
          pointRadius: 0,           // Pas de points visibles
          pointHoverRadius: 0,      // Pas de points au survol non plus
          pointBorderWidth: 0,      // Pas de bordure de points
          pointBackgroundColor: 'transparent',  // Points transparents
          hidden: datasetVisibility[label] || false // Préserver l'état de visibilité
        });
        
        // Dataset créé
      });
      
      if (datasets.length > 0) {
        updateChart(cardId, datasets);
        // Chart mis à jour
      }
      
    } catch (error) {
      console.error(`❌ [main] Error refreshing chart ${cardId}:`, error);
    }
  });
}

// Gestion des charts zoomés (arrêt du rafraîchissement automatique)
const zoomedCharts = new Set();

// Écouter les événements de zoom
document.addEventListener('chart:zoom-start', (event) => {
  const { canvasId } = event.detail;
  zoomedCharts.add(canvasId);
  console.log(`[main] Chart ${canvasId} zoomed - refresh stopped`);
  showResumeButton(canvasId);
});

document.addEventListener('chart:zoom-end', (event) => {
  const { canvasId } = event.detail;
  // Ne pas retirer immédiatement, laisser l'utilisateur décider
  console.log(`[main] Chart ${canvasId} zoom ended`);
});

// Fonction pour réactiver le rafraîchissement d'un chart
export function resumeChartRefresh(canvasId) {
  zoomedCharts.delete(canvasId);
  console.log(`[main] Chart ${canvasId} refresh resumed`);
  hideResumeButton(canvasId);
}

// Fonction pour afficher le bouton "Reprendre" au-dessus de la légende
function showResumeButton(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  // Vérifier si le bouton existe déjà
  let resumeBtn = document.getElementById(`resume-btn-${canvasId}`);
  if (resumeBtn) return;
  
  // Trouver le conteneur parent du canvas (généralement un div avec position relative)
  let container = canvas.parentElement;
  while (container && container.tagName !== 'DIV') {
    container = container.parentElement;
  }
  
  if (!container) {
    console.warn(`[main] No suitable container found for ${canvasId}`);
    return;
  }
  
  // S'assurer que le conteneur a une position relative
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  
  // Créer le bouton
  resumeBtn = document.createElement('button');
  resumeBtn.id = `resume-btn-${canvasId}`;
  resumeBtn.className = 'resume-refresh-btn';
  resumeBtn.innerHTML = `
    <svg class="icon stroke" style="width: 16px; height: 16px;" aria-hidden="true">
      <use href="#i-play" />
    </svg>
    <span>Reprendre</span>
  `;
  
  // Styles du bouton
  resumeBtn.style.cssText = `
    position: absolute !important;
    top: 10px !important;
    right: 10px !important;
    background: #10b981 !important;
    border: 1px solid #10b981 !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    color: white !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    z-index: 9999 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    font-family: inherit !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  `;
  
  // Hover effect
  resumeBtn.addEventListener('mouseenter', () => {
    resumeBtn.style.background = '#059669';
    resumeBtn.style.transform = 'translateY(-1px)';
  });
  
  resumeBtn.addEventListener('mouseleave', () => {
    resumeBtn.style.background = '#10b981';
    resumeBtn.style.transform = 'translateY(0)';
  });
  
  // Click handler
  resumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`[main] Resume button clicked for ${canvasId}`);
    resumeChartRefresh(canvasId);
    refreshNewChartSystem();
  });
  
  // Ajouter le bouton au conteneur
  container.appendChild(resumeBtn);
  
  console.log(`[main] Resume button shown for ${canvasId} in container:`, container);
  console.log(`[main] Button element:`, resumeBtn);
  console.log(`[main] Button computed style:`, getComputedStyle(resumeBtn));
}

// Fonction pour masquer le bouton "Reprendre"
function hideResumeButton(canvasId) {
  const resumeBtn = document.getElementById(`resume-btn-${canvasId}`);
  if (resumeBtn) {
    resumeBtn.remove();
    console.log(`[main] Resume button hidden for ${canvasId}`);
  }
}

// Fonction pour vérifier si un chart est zoomé
export function isChartZoomed(canvasId) {
  return zoomedCharts.has(canvasId);
}

// Export pour utilisation dans polling.js
export { refreshNewChartSystem };

export function listRegisteredCharts() {
  // Retourner les charts du nouveau système
  // Cette fonction sera remplacée par l'import direct dans polling.js
  return [];
}
