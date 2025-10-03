/**
 * TimeRangeBridge.js - Pont entre l'ancien système et le nouveau ChartHost
 * 
 * Permet d'intégrer progressivement les nouvelles fonctionnalités
 * dans l'architecture existante
 */

// Registre des instances ChartHost pour le système de base de temps
const chartHostInstances = new Map();

// Registre des instances ChartHost pour les paramètres
const chartSettingsInstances = new Map();

/**
 * Enregistre une instance ChartHost pour la gestion des bases de temps
 * @param {string} chartKey - Clé du chart (ex: 'tr1-power')
 * @param {ChartHost} chartHost - Instance ChartHost
 */
export function registerChartHost(chartKey, chartHost) {
  chartHostInstances.set(chartKey, chartHost);
  chartSettingsInstances.set(chartKey, chartHost); // Aussi pour les paramètres
  console.log(`[TimeRangeBridge] ChartHost enregistré: ${chartKey}`);
}

/**
 * Obtient une instance ChartHost pour les paramètres
 * @param {string} chartKey - Clé du chart
 * @returns {ChartHost|null} Instance ChartHost ou null
 */
export function getChartHost(chartKey) {
  return chartSettingsInstances.get(chartKey) || null;
}

/**
 * Change la base de temps d'un chart spécifique
 * @param {string} chartKey - Clé du chart
 * @param {number} minutes - Base de temps en minutes
 */
export function setChartTimeRange(chartKey, minutes) {
  const chartHost = chartHostInstances.get(chartKey);
  if (chartHost && typeof chartHost.setTimeRange === 'function') {
    chartHost.setTimeRange(minutes);
    console.log(`[TimeRangeBridge] Base de temps changée: ${chartKey} → ${minutes} min`);
  } else {
    console.warn(`[TimeRangeBridge] ChartHost non trouvé: ${chartKey}`);
  }
}

/**
 * Mappe les IDs de sélecteurs vers les clés de charts
 */
const SELECTOR_TO_CHART_MAP = {
  'win-p1': 'tr1-power',
  'win-u1': 'tr1-tension', 
  'win-pf1': 'tr1-pf',
  'win-p2': 'tr2-power',
  'win-u2': 'tr2-tension',
  'win-pf2': 'tr2-pf'
};

/**
 * Gère le changement de base de temps depuis les sélecteurs HTML
 * @param {string} selectorId - ID du sélecteur (ex: 'win-p1')
 * @param {number} minutes - Nouvelle base de temps
 */
export function handleTimeRangeChange(selectorId, minutes) {
  const chartKey = SELECTOR_TO_CHART_MAP[selectorId];
  if (chartKey) {
    setChartTimeRange(chartKey, minutes);
  } else {
    console.warn(`[TimeRangeBridge] Mapping non trouvé: ${selectorId}`);
  }
}

/**
 * Restaure toutes les bases de temps depuis localStorage
 */
export function restoreAllTimeRanges() {
  Object.entries(SELECTOR_TO_CHART_MAP).forEach(([selectorId, chartKey]) => {
    const chartHost = chartHostInstances.get(chartKey);
    if (chartHost && typeof chartHost.loadTimeRange === 'function') {
      chartHost.loadTimeRange();
      
      // Synchroniser le sélecteur HTML avec la valeur restaurée
      const selector = document.getElementById(selectorId);
      if (selector) {
        selector.value = String(chartHost.getTimeRange());
      }
    }
  });
  
  console.log(`[TimeRangeBridge] Bases de temps restaurées pour ${chartHostInstances.size} charts`);
}

/**
 * Obtient la liste des charts enregistrés
 * @returns {string[]} Liste des clés de charts
 */
export function getRegisteredCharts() {
  return Array.from(chartHostInstances.keys());
}

/**
 * Nettoie toutes les instances (pour cleanup)
 */
export function cleanup() {
  chartHostInstances.clear();
  console.log('[TimeRangeBridge] Cleanup effectué');
}
