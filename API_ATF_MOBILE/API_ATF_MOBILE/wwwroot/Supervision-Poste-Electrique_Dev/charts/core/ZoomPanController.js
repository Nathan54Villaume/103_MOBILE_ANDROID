/**
 * ZoomPanController.js - Contrôleur zoom/pan custom fiable
 * 
 * Fonctionnalités :
 * - Pan horizontal à la souris (clic + glisser sans CTRL)
 * - Zoom molette : X sur courbe, Y sur axe selon position
 * - Hard bounds : pas de dé-zoom au-delà des données
 * - Pincement tactile supporté
 * - Aucun reset intempestif
 */

export class ZoomPanController {
  constructor(chartInstance, options = {}) {
    this.chart = chartInstance;
    this.canvas = chartInstance.canvas;
    
    // Configuration
    this.config = {
      pan: {
        enabled: true,
        mode: 'x', // Pan horizontal uniquement
        threshold: 5, // Pixels min pour déclencher le pan
        ...options.pan
      },
      zoom: {
        enabled: true,
        wheel: {
          enabled: true,
          speed: 0.1,
          modifierKey: null // Pas besoin de CTRL
        },
        pinch: {
          enabled: true
        },
        ...options.zoom
      }
    };
    
    // État interne
    this.isPanning = false;
    this.panStart = null;
    this.originalBounds = null;
    
    // Bindings
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    
    this.init();
  }
  
  /**
   * Initialise les event listeners
   */
  init() {
    if (!this.canvas) return;
    
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    
    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    
    console.log('[ZoomPanController] Initialisé');
  }
  
  /**
   * Définit les bornes maximales (hard bounds)
   */
  setBounds(bounds) {
    this.originalBounds = bounds;
    console.log('[ZoomPanController] Bornes définies:', bounds);
  }
  
  /**
   * Obtient la position relative de la souris sur le canvas
   */
  getRelativePosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  
  /**
   * Détermine si la position est sur un axe Y
   */
  isOnYAxis(relativePos) {
    const chartArea = this.chart.chartArea;
    const margin = 60; // Marge pour détecter l'axe Y
    
    return relativePos.x < chartArea.left + margin || 
           relativePos.x > chartArea.right - margin;
  }
  
  /**
   * Gestion du clic souris (début pan)
   */
  handleMouseDown(event) {
    if (!this.config.pan.enabled) return;
    if (event.button !== 0) return; // Uniquement clic gauche
    
    event.preventDefault();
    
    const pos = this.getRelativePosition(event);
    
    this.isPanning = true;
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      canvasX: pos.x,
      canvasY: pos.y,
      scaleX: this.chart.scales.x?.min || 0,
      scaleY: this.chart.scales.y?.min || 0
    };
    
    // Changement du curseur
    this.canvas.style.cursor = 'grabbing';
    
    console.log('[ZoomPanController] Pan started');
  }
  
  /**
   * Gestion du mouvement de souris (pan en cours)
   */
  handleMouseMove(event) {
    if (!this.isPanning || !this.panStart) return;
    
    event.preventDefault();
    
    const deltaX = event.clientX - this.panStart.x;
    const chartArea = this.chart.chartArea;
    const xScale = this.chart.scales.x;
    
    if (!xScale || !chartArea) return;
    
    // Calcul du facteur de pan basé sur la largeur du graphique
    const chartWidth = chartArea.right - chartArea.left;
    const currentRange = xScale.max - xScale.min;
    const panFactor = (currentRange / chartWidth) * deltaX;
    
    // Nouvelles limites
    const newMin = this.panStart.scaleX - panFactor;
    const newMax = newMin + currentRange;
    
    // Application des hard bounds
    const { clampedMin, clampedMax } = this.clampToBounds(newMin, newMax, 'x');
    
    // Mise à jour
    xScale.options.min = clampedMin;
    xScale.options.max = clampedMax;
    
    this.chart.update('none');
  }
  
  /**
   * Gestion de la fin du pan
   */
  handleMouseUp(event) {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      this.canvas.style.cursor = 'default';
      console.log('[ZoomPanController] Pan ended');
    }
  }
  
  /**
   * Gestion du zoom molette
   */
  handleWheel(event) {
    if (!this.config.zoom.enabled || !this.config.zoom.wheel.enabled) return;
    
    event.preventDefault();
    
    const pos = this.getRelativePosition(event);
    const isOnY = this.isOnYAxis(pos);
    const zoomAxis = isOnY ? 'y' : 'x';
    
    const scale = this.chart.scales[zoomAxis];
    if (!scale) return;
    
    // Direction et force du zoom
    const direction = event.deltaY > 0 ? 1 : -1; // 1 = zoom out, -1 = zoom in
    const zoomFactor = 1 + (direction * this.config.zoom.wheel.speed);
    
    // Point de pivot (centre du zoom)
    let pivotValue;
    if (zoomAxis === 'x') {
      pivotValue = scale.getValueForPixel(pos.x);
    } else {
      pivotValue = scale.getValueForPixel(pos.y);
    }
    
    if (!Number.isFinite(pivotValue)) return;
    
    // Calcul des nouvelles limites
    const currentMin = scale.min;
    const currentMax = scale.max;
    const currentRange = currentMax - currentMin;
    const newRange = currentRange * zoomFactor;
    
    // Position relative du pivot dans la plage actuelle
    const pivotRatio = (pivotValue - currentMin) / currentRange;
    
    const newMin = pivotValue - (newRange * pivotRatio);
    const newMax = pivotValue + (newRange * (1 - pivotRatio));
    
    // Application des hard bounds
    const { clampedMin, clampedMax } = this.clampToBounds(newMin, newMax, zoomAxis);
    
    // Mise à jour
    scale.options.min = clampedMin;
    scale.options.max = clampedMax;
    
    this.chart.update('none');
    
    console.log(`[ZoomPanController] Zoom ${zoomAxis}: ${direction > 0 ? 'out' : 'in'}`);
  }
  
  /**
   * Gestion du début tactile (pincement)
   */
  handleTouchStart(event) {
    if (!this.config.zoom.pinch.enabled) return;
    
    if (event.touches.length === 2) {
      event.preventDefault();
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      this.touchState = {
        initialDistance: this.getTouchDistance(touch1, touch2),
        initialMidpoint: this.getTouchMidpoint(touch1, touch2),
        initialScale: {
          x: { min: this.chart.scales.x?.min, max: this.chart.scales.x?.max },
          y: { min: this.chart.scales.y?.min, max: this.chart.scales.y?.max }
        }
      };
      
      console.log('[ZoomPanController] Pinch started');
    }
  }
  
  /**
   * Gestion du mouvement tactile (pincement)
   */
  handleTouchMove(event) {
    if (!this.config.zoom.pinch.enabled || !this.touchState) return;
    
    if (event.touches.length === 2) {
      event.preventDefault();
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const currentDistance = this.getTouchDistance(touch1, touch2);
      const zoomFactor = this.touchState.initialDistance / currentDistance;
      
      // Zoom sur les deux axes
      ['x', 'y'].forEach(axis => {
        const scale = this.chart.scales[axis];
        if (!scale) return;
        
        const initialMin = this.touchState.initialScale[axis].min;
        const initialMax = this.touchState.initialScale[axis].max;
        const initialRange = initialMax - initialMin;
        const newRange = initialRange * zoomFactor;
        
        const center = (initialMin + initialMax) / 2;
        const newMin = center - newRange / 2;
        const newMax = center + newRange / 2;
        
        const { clampedMin, clampedMax } = this.clampToBounds(newMin, newMax, axis);
        
        scale.options.min = clampedMin;
        scale.options.max = clampedMax;
      });
      
      this.chart.update('none');
    }
  }
  
  /**
   * Gestion de la fin tactile
   */
  handleTouchEnd(event) {
    if (event.touches.length < 2) {
      this.touchState = null;
      console.log('[ZoomPanController] Pinch ended');
    }
  }
  
  /**
   * Calcule la distance entre deux touches
   */
  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Calcule le point médian entre deux touches
   */
  getTouchMidpoint(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }
  
  /**
   * Applique les hard bounds pour éviter le dé-zoom excessif
   */
  clampToBounds(min, max, axis) {
    if (!this.originalBounds || !this.originalBounds[axis]) {
      return { clampedMin: min, clampedMax: max };
    }
    
    const bounds = this.originalBounds[axis];
    const proposedRange = max - min;
    const maxRange = bounds.max - bounds.min;
    
    let clampedMin = min;
    let clampedMax = max;
    
    // Empêcher un zoom out plus large que les données
    if (proposedRange >= maxRange) {
      clampedMin = bounds.min;
      clampedMax = bounds.max;
    } else {
      // Empêcher de sortir des bornes
      if (clampedMin < bounds.min) {
        const shift = bounds.min - clampedMin;
        clampedMin += shift;
        clampedMax += shift;
      }
      
      if (clampedMax > bounds.max) {
        const shift = clampedMax - bounds.max;
        clampedMin -= shift;
        clampedMax -= shift;
      }
      
      // Double vérification
      clampedMin = Math.max(clampedMin, bounds.min);
      clampedMax = Math.min(clampedMax, bounds.max);
    }
    
    return { clampedMin, clampedMax };
  }
  
  /**
   * Remet à zéro le zoom
   */
  resetZoom() {
    if (!this.originalBounds) return;
    
    ['x', 'y'].forEach(axis => {
      const scale = this.chart.scales[axis];
      const bounds = this.originalBounds[axis];
      
      if (scale && bounds) {
        scale.options.min = bounds.min;
        scale.options.max = bounds.max;
      }
    });
    
    this.chart.update('none');
    console.log('[ZoomPanController] Zoom reset');
  }
  
  /**
   * Active/désactive le pan
   */
  setPanEnabled(enabled) {
    this.config.pan.enabled = enabled;
  }
  
  /**
   * Active/désactive le zoom
   */
  setZoomEnabled(enabled) {
    this.config.zoom.enabled = enabled;
  }
  
  /**
   * Nettoie les event listeners
   */
  destroy() {
    if (!this.canvas) return;
    
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    
    console.log('[ZoomPanController] Détruit');
  }
}
