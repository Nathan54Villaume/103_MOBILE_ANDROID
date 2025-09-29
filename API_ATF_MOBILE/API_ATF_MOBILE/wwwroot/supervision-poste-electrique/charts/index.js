/**
 * charts/index.js - Point d'entrée principal pour le système de courbes
 * 
 * Bootstrap et initialisation des cartes de courbes
 */

import { ChartHost } from './core/ChartHost.js';

// Registre global des instances de courbes
const chartInstances = new Map();

/**
 * Initialise une carte de courbe
 * @param {string} cardId - ID de la carte (ex: 'tr1-power')
 * @param {string} canvasId - ID du canvas
 * @param {Object} config - Configuration spécifique
 */
export function initChart(cardId, canvasId, config = {}) {
  try {
    // Vérifier si déjà initialisé
    if (chartInstances.has(cardId)) {
      console.warn(`[Charts] Carte ${cardId} déjà initialisée`);
      return chartInstances.get(cardId);
    }
    
    // Créer l'instance ChartHost
    const chartHost = new ChartHost(canvasId, config.options);
    
    // Stocker dans le registre
    chartInstances.set(cardId, {
      host: chartHost,
      config: config,
      cardId: cardId,
      canvasId: canvasId
    });
    
    console.log(`[Charts] Carte ${cardId} initialisée`);
    return chartInstances.get(cardId);
    
  } catch (error) {
    console.error(`[Charts] Erreur lors de l'initialisation de ${cardId}:`, error);
    return null;
  }
}

/**
 * Récupère une instance de courbe
 * @param {string} cardId - ID de la carte
 * @returns {Object|null} Instance ou null si non trouvée
 */
export function getChart(cardId) {
  return chartInstances.get(cardId) || null;
}

/**
 * Met à jour les données d'une courbe
 * @param {string} cardId - ID de la carte
 * @param {Array} datasets - Données à afficher
 */
export function updateChart(cardId, datasets) {
  const instance = chartInstances.get(cardId);
  if (!instance) {
    console.warn(`[Charts] Carte ${cardId} non trouvée pour mise à jour`);
    return false;
  }
  
  instance.host.setData(datasets);
  return true;
}

/**
 * Remet à zéro une courbe
 * @param {string} cardId - ID de la carte
 */
export function resetChart(cardId) {
  const instance = chartInstances.get(cardId);
  if (!instance) {
    console.warn(`[Charts] Carte ${cardId} non trouvée pour reset`);
    return false;
  }
  
  instance.host.resetView();
  return true;
}

/**
 * Nettoie une instance de courbe
 * @param {string} cardId - ID de la carte
 */
export function destroyChart(cardId) {
  const instance = chartInstances.get(cardId);
  if (!instance) return false;
  
  instance.host.destroy();
  chartInstances.delete(cardId);
  
  console.log(`[Charts] Carte ${cardId} supprimée`);
  return true;
}

/**
 * Nettoie toutes les instances
 */
export function destroyAllCharts() {
  chartInstances.forEach((instance, cardId) => {
    instance.host.destroy();
  });
  chartInstances.clear();
  console.log('[Charts] Toutes les cartes supprimées');
}

/**
 * Liste toutes les cartes initialisées
 * @returns {Array<string>} Liste des IDs
 */
export function listCharts() {
  return Array.from(chartInstances.keys());
}

// Utilitaires de génération de datasets pour tests
export const TestDataGenerator = {
  /**
   * Génère un dataset de test sinusoïdal
   * @param {string} label - Label du dataset
   * @param {string} color - Couleur (hex)
   * @param {number} points - Nombre de points
   * @param {number} amplitude - Amplitude de la sinusoïde
   * @param {number} offset - Décalage vertical
   * @returns {Object} Dataset Chart.js
   */
  generateSineWave(label, color, points = 100, amplitude = 100, offset = 0) {
    const data = [];
    const now = Date.now();
    const timeSpan = 3600000; // 1 heure
    
    for (let i = 0; i < points; i++) {
      const x = now - timeSpan + (i * timeSpan / points);
      const y = offset + amplitude * Math.sin((i / points) * 4 * Math.PI) + (Math.random() - 0.5) * 10;
      
      data.push({ x: x, y: Number(y.toFixed(2)) });
    }
    
    return {
      label: label,
      data: data,
      borderColor: color,
      backgroundColor: 'transparent',
      unit: 'kW'
    };
  },
  
  /**
   * Génère des datasets de test pour TR1
   */
  generateTR1Data() {
    return [
      this.generateSineWave('Puissance TR1', '#6366f1', 120, 80, 420),
      this.generateSineWave('Puissance Réactive TR1', '#f97316', 120, 30, 120)
    ];
  },
  
  /**
   * Génère des datasets de test pour TR2
   */
  generateTR2Data() {
    return [
      this.generateSineWave('Puissance TR2', '#f43f5e', 120, 75, 470),
      this.generateSineWave('Puissance Réactive TR2', '#f59e0b', 120, 35, 110)
    ];
  }
};
