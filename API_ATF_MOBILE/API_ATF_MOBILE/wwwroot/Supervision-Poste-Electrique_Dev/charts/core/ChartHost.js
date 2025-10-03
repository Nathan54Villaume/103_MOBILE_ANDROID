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
    
    // État interne pour la gestion des bases de temps
    this.currentTimeRange = 60; // 1 heure par défaut
    this.persistenceKey = `chart-${canvasId}`;
    
    // Paramètres sauvegardés
    this.currentSettings = null;
    
    // Restaurer la base de temps et les paramètres depuis localStorage
    this.loadTimeRange();
    this.loadSettings();
    
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
    // Utiliser directement l'URL de l'API sans proxy local
    const baseUrl = 'http://10.250.13.4:8088/api/energy';
    this.signalService = new SignalService(baseUrl);
    this.contextMenu = new ContextMenu(this.signalService);
    
    // Event listener pour clic droit
    this.canvas.addEventListener('contextmenu', (event) => {
      console.log('[ChartHost] Clic droit détecté sur canvas:', this.canvas.id);
      console.log('[ChartHost] Event details:', { 
        clientX: event.clientX, 
        clientY: event.clientY, 
        target: event.target,
        canvas: this.canvas 
      });
      this.handleContextMenu(event);
    });
    
    
    // Appliquer les paramètres sauvegardés après initialisation
    setTimeout(() => {
      this.applySavedSettings();
    }, 100);
    
    // ChartHost initialisé
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
    
    // Mettre à jour les limites des axes selon les données et la base de temps
    this.updateTimeAxis(this.currentTimeRange);
    
    // Mettre à jour le graphique avec animation
    this.chart.update('active');
    
    // Réappliquer les paramètres sauvegardés après mise à jour des données
    // Cela inclut les paramètres Y qui doivent écraser updateYAxis()
    setTimeout(() => {
      this.applySavedSettings();
      // Si pas de paramètres Y spécifiques, alors calculer automatiquement
      if (!this.currentSettings?.yZero && !this.currentSettings?.yAuto) {
        this.updateYAxis();
      }
    }, 50);
    
    // Données mises à jour
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
    
    // Bornes calculées
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
    
    // Vue réinitialisée
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
    
    // Vue appliquée
  }
  
  /**
   * Gère le clic droit sur le canvas
   * @param {MouseEvent} event - Événement de clic droit
   */
  async handleContextMenu(event) {
    console.log('[ChartHost] handleContextMenu appelé');
    if (!this.contextMenu) {
      console.warn('[ChartHost] Pas de contextMenu disponible');
      return;
    }
    
    // Extraire les IDs des signaux actuels
    const currentSignalIds = this.datasets.map(dataset => dataset.signalId || dataset.label).filter(Boolean);
    
    try {
      console.log('[ChartHost] Ouverture du menu contextuel...');
      await this.contextMenu.show(
        event, 
        this.chart, 
        currentSignalIds, 
        (selectedSignalIds) => this.onSignalSelectionChange(selectedSignalIds)
      );
      console.log('[ChartHost] Menu contextuel ouvert avec succès');
    } catch (error) {
      console.error('[ChartHost] Erreur ouverture menu contextuel:', error);
    }
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
      // Chargement des signaux
      
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
      // Signaux mis à jour
      
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
   * Change la base de temps et recharge les données
   * @param {number} minutes - Nouvelle base de temps en minutes (15, 60, 240, 1440)
   */
  setTimeRange(minutes) {
    const validRanges = [15, 60, 240, 1440];
    if (!validRanges.includes(minutes)) {
      console.warn(`[ChartHost] Base de temps invalide: ${minutes}. Utilisation de 60.`);
      minutes = 60;
    }
    
    this.currentTimeRange = minutes;
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem(`${this.persistenceKey}-timerange`, String(minutes));
    } catch (error) {
      console.warn('[ChartHost] Erreur sauvegarde localStorage:', error);
    }
    
    // Adapter l'affichage de l'axe X selon la base de temps
    this.updateTimeAxis(minutes);
    
    // Base de temps changée
  }
  
  /**
   * Met à jour l'affichage de l'axe X selon la base de temps
   * @param {number} minutes - Base de temps en minutes
   */
  updateTimeAxis(minutes) {
    if (!this.chart || !this.chart.options.scales.x) return;
    
    const now = Date.now();
    const timeSpan = minutes * 60 * 1000;
    
    // Mettre à jour les limites
    this.chart.options.scales.x.min = now - timeSpan;
    this.chart.options.scales.x.max = now;
    
    // Adapter l'unité de temps selon la durée
    if (minutes <= 15) {
      this.chart.options.scales.x.time.unit = 'minute';
      this.chart.options.scales.x.time.stepSize = 1;
    } else if (minutes <= 60) {
      this.chart.options.scales.x.time.unit = 'minute';
      this.chart.options.scales.x.time.stepSize = 5;
    } else if (minutes <= 240) {
      this.chart.options.scales.x.time.unit = 'hour';
      this.chart.options.scales.x.time.stepSize = 1;
    } else {
      this.chart.options.scales.x.time.unit = 'hour';
      this.chart.options.scales.x.time.stepSize = 4;
    }
    
    // Forcer la mise à jour
    this.chart.update('active');
    
    // Axe X mis à jour
  }
  
  /**
   * Récupère la base de temps actuelle
   * @returns {number} Base de temps en minutes
   */
  getTimeRange() {
    return this.currentTimeRange;
  }
  
  /**
   * Restaure la base de temps depuis localStorage
   */
  loadTimeRange() {
    try {
      const saved = localStorage.getItem(`${this.persistenceKey}-timerange`);
      if (saved) {
        const minutes = parseInt(saved, 10);
        if ([15, 60, 240, 1440].includes(minutes)) {
          this.currentTimeRange = minutes;
          // Base de temps restaurée
        }
      }
    } catch (error) {
      console.warn('[ChartHost] Erreur chargement localStorage:', error);
    }
  }

  /**
   * Sauvegarde les paramètres dans localStorage
   * @param {Object} settings - Paramètres à sauvegarder
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(`${this.persistenceKey}-settings`, JSON.stringify(settings));
      this.currentSettings = settings;
      // Paramètres sauvegardés
    } catch (error) {
      console.warn('[ChartHost] Erreur sauvegarde localStorage:', error);
    }
  }

  /**
   * Restaure les paramètres depuis localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(`${this.persistenceKey}-settings`);
      if (saved) {
        this.currentSettings = JSON.parse(saved);
        // Paramètres restaurés
      }
    } catch (error) {
      console.warn('[ChartHost] Erreur chargement paramètres localStorage:', error);
    }
  }

  /**
   * Applique les paramètres sauvegardés au chart
   */
  applySavedSettings() {
    if (!this.currentSettings || !this.chart) return;
    
    const settings = this.currentSettings;
    const chart = this.chart;
    const options = chart.options;
    
    // Application des paramètres sauvegardés
    
    // Appliquer les paramètres de base
    if (options.scales?.x?.grid) {
      options.scales.x.grid.display = settings.showGrid ?? true;
    }
    if (options.plugins?.legend) {
      options.plugins.legend.display = settings.showLegend ?? true;
    }
    if (options.plugins?.tooltip) {
      options.plugins.tooltip.enabled = settings.showTooltips ?? true;
    }
    if (options.plugins?.crosshair) {
      options.plugins.crosshair.enabled = settings.showCrosshair ?? true;
    }
    
    // Appliquer les paramètres Y
    if (settings.yZero) {
      options.scales.y.min = 0;
      options.scales.y.max = undefined;
    } else if (settings.yAuto) {
      options.scales.y.min = undefined;
      options.scales.y.max = undefined;
    }
    
    // Appliquer les paramètres des datasets
    chart.data.datasets?.forEach(dataset => {
      if (settings.lineWidth !== undefined) {
        dataset.borderWidth = settings.lineWidth;
      }
      if (settings.tension !== undefined) {
        dataset.tension = settings.tension;
      }
      if (settings.alpha !== undefined && dataset.backgroundColor && dataset.borderColor) {
        const baseColor = dataset.borderColor;
        const alphaHex = Math.round(settings.alpha * 2.55).toString(16).padStart(2, '0');
        dataset.backgroundColor = baseColor + alphaHex;
      }
    });
    
    // Appliquer les paramètres de zoom/pan
    if (this.zoomPanController) {
      this.zoomPanController.setZoomEnabled(settings.enableZoom ?? true);
      this.zoomPanController.setPanEnabled(settings.enablePan ?? true);
    }
    
    chart.update('none');
  }

  /**
   * Met à jour l'axe Y selon les bornes calculées des données
   */
  updateYAxis() {
    if (!this.chart || !this.chart.options.scales.y || !this.originalBounds) return;
    
    // Appliquer les bornes Y calculées
    this.chart.options.scales.y.min = this.originalBounds.y.min;
    this.chart.options.scales.y.max = this.originalBounds.y.max;
    
    // Axe Y mis à jour
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
    
    // Instance détruite
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
