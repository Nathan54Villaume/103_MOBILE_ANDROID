/**
 * ChartHost.js - Fabrique et gestionnaire principal d'une instance Chart.js
 * 
 * API principale :
 * - new ChartHost(canvasId, options)
 * - setData(datasets) : met à jour les données
 * - resetView() : restaure la vue d'origine
 * - getView() : récupère le domaine actuel
 * - setView(range) : applique un domaine spécifique
 * - destroy() : nettoie l'instance
 */

import { ZoomPanController } from './ZoomPanController.js';
import { CrosshairPlugin } from '../ui/CrosshairPlugin.js';
import { TooltipFormatter } from '../ui/TooltipFormatter.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { SignalService } from '../api/SignalService.js';

export class ChartHost {
  constructor(canvasId, options = {}) {
    this.canvasId = canvasId;
    this.canvas = document.getElementById(canvasId);
    
    if (!this.canvas) {
      throw new Error(`Canvas #${canvasId} introuvable`);
    }
    
    // Options par défaut (thème sombre, décimation, formats)
    this.defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Pas d'animation pour la perf
      parsing: false,   // Données pré-formatées pour la perf
      
      // Décimation automatique pour gros datasets
      datasets: {
        line: {
          pointRadius: 0,           // Pas de points par défaut
          pointHoverRadius: 4,
          borderWidth: 2,
          spanGaps: true,
          tension: 0.1
        }
      },
      
      // Échelles
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'HH:mm:ss',
            displayFormats: {
              millisecond: 'HH:mm:ss.SSS',
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'dd/MM',
              month: 'MM/yyyy'
            }
          },
          ticks: {
            color: '#e2e8f0',
            font: { size: 11 }
          },
          grid: {
            color: 'rgba(148,163,184,0.15)',
            borderColor: 'rgba(148,163,184,0.3)'
          }
        },
        y: {
          ticks: {
            color: '#e2e8f0',
            font: { size: 11 }
          },
          grid: {
            color: 'rgba(148,163,184,0.1)',
            borderColor: 'rgba(148,163,184,0.3)'
          }
        }
      },
      
      // Plugins
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#e2e8f0',
            font: { size: 12 }
          }
        },
        tooltip: TooltipFormatter.getTooltipConfig(),
        crosshair: {
          enabled: true,
          color: 'rgba(226, 232, 240, 0.6)',
          width: 1,
          style: 'solid',
          snapToData: false
        }
      },
      
      // Interaction
      hover: {
        mode: 'index',
        intersect: false
      }
    };
    
    // Fusionner avec les options utilisateur
    this.options = this.mergeDeep(this.defaultOptions, options);
    
    // État interne
    this.chart = null;
    this.originalBounds = null; // Bornes d'origine des données
    this.datasets = [];
    this.zoomPanController = null;
    this.contextMenu = null;
    this.signalService = null;
    this.currentSignals = [];
    
    this.init();
  }
  
  /**
   * Initialise l'instance Chart.js
   */
  init() {
    const ctx = this.canvas.getContext('2d');
    
    // Enregistrer le plugin crosshair
    Chart.register(CrosshairPlugin);
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [] },
      options: this.options
    });
    
    // Initialiser le contrôleur zoom/pan
    this.zoomPanController = new ZoomPanController(this.chart, {
      pan: {
        enabled: true,
        mode: 'x'
      },
      zoom: {
        enabled: true,
        wheel: {
          enabled: true,
          speed: 0.1
        },
        pinch: {
          enabled: true
        }
      }
    });
    
    // Initialiser le service de signaux et le menu contextuel
    this.signalService = new SignalService();
    this.contextMenu = new ContextMenu(this.signalService);
    
    // Event listener pour clic droit
    this.canvas.addEventListener('contextmenu', (event) => {
      this.handleContextMenu(event);
    });
    
    console.log(`[ChartHost] Initialisé pour canvas #${this.canvasId}`);
  }
  
  /**
   * Met à jour les données du graphique
   * @param {Array} datasets - Tableaux de datasets Chart.js
   */
  setData(datasets) {
    if (!Array.isArray(datasets)) {
      console.warn('[ChartHost] setData: datasets doit être un array');
      return;
    }
    
    this.datasets = datasets;
    this.chart.data.datasets = [...datasets];
    
    // Calculer les bornes globales
    this.calculateBounds();
    
    // Mettre à jour le graphique
    this.chart.update('none');
    
    console.log(`[ChartHost] Données mises à jour: ${datasets.length} dataset(s)`);
  }
  
  /**
   * Calcule les bornes min/max globales des données
   */
  calculateBounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    this.datasets.forEach(dataset => {
      if (!Array.isArray(dataset.data)) return;
      
      dataset.data.forEach(point => {
        if (!point || typeof point.x === 'undefined' || typeof point.y === 'undefined') return;
        
        const x = new Date(point.x).getTime();
        const y = Number(point.y);
        
        if (Number.isFinite(x)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
        
        if (Number.isFinite(y)) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      });
    });
    
    // Ajouter une marge de 5% sur Y
    const yRange = maxY - minY;
    const yMargin = yRange * 0.05;
    
    this.originalBounds = {
      x: { min: minX, max: maxX },
      y: { min: minY - yMargin, max: maxY + yMargin }
    };
    
    // Transmettre les bornes au contrôleur zoom/pan
    if (this.zoomPanController) {
      this.zoomPanController.setBounds(this.originalBounds);
    }
    
    console.log('[ChartHost] Bornes calculées:', this.originalBounds);
  }
  
  /**
   * Restaure la vue d'origine (reset complet)
   */
  resetView() {
    if (this.zoomPanController) {
      // Utiliser le reset du contrôleur pour une cohérence
      this.zoomPanController.resetZoom();
    } else if (this.originalBounds) {
      // Fallback si pas de contrôleur
      this.chart.options.scales.x.min = this.originalBounds.x.min;
      this.chart.options.scales.x.max = this.originalBounds.x.max;
      this.chart.options.scales.y.min = this.originalBounds.y.min;
      this.chart.options.scales.y.max = this.originalBounds.y.max;
      
      this.chart.update('none');
    }
    
    console.log('[ChartHost] Vue réinitialisée');
  }
  
  /**
   * Récupère le domaine de vue actuel
   * @returns {Object} { x: {min, max}, y: {min, max} }
   */
  getView() {
    const scales = this.chart.scales;
    return {
      x: { 
        min: scales.x?.min || this.originalBounds?.x.min,
        max: scales.x?.max || this.originalBounds?.x.max
      },
      y: { 
        min: scales.y?.min || this.originalBounds?.y.min,
        max: scales.y?.max || this.originalBounds?.y.max
      }
    };
  }
  
  /**
   * Applique un domaine de vue spécifique
   * @param {Object} range - { x: {min, max}, y: {min, max} }
   */
  setView(range) {
    if (!range || typeof range !== 'object') return;
    
    if (range.x) {
      if (range.x.min !== undefined) this.chart.options.scales.x.min = range.x.min;
      if (range.x.max !== undefined) this.chart.options.scales.x.max = range.x.max;
    }
    
    if (range.y) {
      if (range.y.min !== undefined) this.chart.options.scales.y.min = range.y.min;
      if (range.y.max !== undefined) this.chart.options.scales.y.max = range.y.max;
    }
    
    this.chart.update('none');
    
    console.log('[ChartHost] Vue appliquée:', range);
  }
  
  /**
   * Gère le clic droit sur le canvas
   * @param {MouseEvent} event - Événement de clic droit
   */
  handleContextMenu(event) {
    if (!this.contextMenu) return;
    
    // Extraire les IDs des signaux actuels
    const currentSignalIds = this.datasets.map(dataset => dataset.signalId || dataset.label).filter(Boolean);
    
    this.contextMenu.show(
      event, 
      this.chart, 
      currentSignalIds, 
      (selectedSignalIds) => this.onSignalSelectionChange(selectedSignalIds)
    );
  }
  
  /**
   * Gère le changement de sélection des signaux
   * @param {Array<string>} selectedSignalIds - IDs des signaux sélectionnés
   */
  async onSignalSelectionChange(selectedSignalIds) {
    if (!this.signalService || selectedSignalIds.length === 0) {
      // Vider le graphique si aucun signal sélectionné
      this.setData([]);
      return;
    }
    
    try {
      console.log(`[ChartHost] Chargement de ${selectedSignalIds.length} signaux...`);
      
      // Calculer la plage de temps (dernières 24h par défaut)
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      
      // Récupérer les données
      const seriesData = await this.signalService.getSeriesData(selectedSignalIds, from, to);
      
      // Ajouter les IDs aux datasets pour le suivi
      const datasetsWithIds = seriesData.datasets.map((dataset, index) => ({
        ...dataset,
        signalId: selectedSignalIds[index] || dataset.label
      }));
      
      // Mettre à jour les données (sans perdre le zoom)
      const currentView = this.getView();
      this.setData(datasetsWithIds);
      
      // Restaurer le zoom si il y en avait un
      if (currentView && (currentView.x.min !== currentView.x.max || currentView.y.min !== currentView.y.max)) {
        setTimeout(() => {
          this.setView(currentView);
        }, 50);
      }
      
      this.currentSignals = selectedSignalIds;
      
    } catch (error) {
      console.error('[ChartHost] Erreur chargement signaux:', error);
    }
  }
  
  /**
   * Met à jour uniquement les signaux sélectionnés sans perdre le zoom
   * @param {Array<string>} signalIds - IDs des signaux à charger
   */
  async updateSignals(signalIds) {
    if (!signalIds || signalIds.length === 0) return;
    
    try {
      const currentView = this.getView();
      
      // Utiliser la plage actuelle si disponible, sinon dernières 24h
      let from, to;
      if (currentView && currentView.x.min && currentView.x.max) {
        from = new Date(currentView.x.min);
        to = new Date(currentView.x.max);
      } else {
        to = new Date();
        from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      }
      
      const seriesData = await this.signalService.getSeriesData(signalIds, from, to);
      
      const datasetsWithIds = seriesData.datasets.map((dataset, index) => ({
        ...dataset,
        signalId: signalIds[index] || dataset.label
      }));
      
      this.setData(datasetsWithIds);
      
      // Restaurer le zoom
      if (currentView && (currentView.x.min !== currentView.x.max || currentView.y.min !== currentView.y.max)) {
        setTimeout(() => {
          this.setView(currentView);
        }, 50);
      }
      
      this.currentSignals = signalIds;
      console.log(`[ChartHost] ${signalIds.length} signaux mis à jour`);
      
    } catch (error) {
      console.error('[ChartHost] Erreur mise à jour signaux:', error);
    }
  }
  
  /**
   * Obtient les signaux actuellement sélectionnés
   * @returns {Array<string>} IDs des signaux actuels
   */
  getCurrentSignals() {
    return [...this.currentSignals];
  }
  
  /**
   * Nettoie l'instance
   */
  destroy() {
    // Cleanup du menu contextuel
    if (this.contextMenu) {
      this.contextMenu.destroy();
      this.contextMenu = null;
    }
    
    if (this.zoomPanController) {
      this.zoomPanController.destroy();
      this.zoomPanController = null;
    }
    
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    // Cleanup event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
    
    console.log(`[ChartHost] Instance détruite pour #${this.canvasId}`);
  }
  
  /**
   * Fusion profonde d'objets
   */
  mergeDeep(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}
