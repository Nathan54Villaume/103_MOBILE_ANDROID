/**
 * CrosshairPlugin.js - Plugin crosshair vertical pour Chart.js 4
 * 
 * Fonctionnalités :
 * - Ligne verticale suivant le curseur
 * - Activation/désactivation configurable
 * - Couleur et style personnalisables
 * - Performance optimisée (pas de re-render)
 * - Compatible zoom/pan
 */

export const CrosshairPlugin = {
  id: 'crosshair',
  
  defaults: {
    enabled: true,
    color: 'rgba(226, 232, 240, 0.6)', // slate-200 avec transparence
    width: 1,
    style: 'solid', // 'solid', 'dashed', 'dotted'
    snapToData: false // Si true, s'accroche aux points de données
  },
  
  beforeInit(chart, args, options) {
    // État interne du plugin
    chart.crosshair = {
      x: null,
      y: null,
      active: false,
      options: { ...this.defaults, ...options }
    };
  },
  
  afterInit(chart) {
    const canvas = chart.canvas;
    if (!canvas) return;
    
    // Event listeners pour le crosshair
    const updateCrosshair = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Vérifier si on est dans la zone du graphique
      const chartArea = chart.chartArea;
      const inBounds = x >= chartArea.left && 
                      x <= chartArea.right && 
                      y >= chartArea.top && 
                      y <= chartArea.bottom;
      
      if (inBounds && chart.crosshair.options.enabled) {
        chart.crosshair.x = x;
        chart.crosshair.y = y;
        chart.crosshair.active = true;
        
        // Snap to data si activé
        if (chart.crosshair.options.snapToData) {
          const snappedX = this.snapToNearestDataPoint(chart, x);
          if (snappedX !== null) {
            chart.crosshair.x = snappedX;
          }
        }
        
        // Redessiner uniquement la zone overlay
        this.drawCrosshair(chart);
      } else {
        chart.crosshair.active = false;
        this.clearCrosshair(chart);
      }
    };
    
    const hideCrosshair = () => {
      chart.crosshair.active = false;
      this.clearCrosshair(chart);
    };
    
    // Attacher les listeners
    canvas.addEventListener('mousemove', updateCrosshair);
    canvas.addEventListener('mouseleave', hideCrosshair);
    
    // Stocker les listeners pour cleanup
    chart.crosshair.updateCrosshair = updateCrosshair;
    chart.crosshair.hideCrosshair = hideCrosshair;
  },
  
  beforeDestroy(chart) {
    // Cleanup des event listeners
    const canvas = chart.canvas;
    if (!canvas || !chart.crosshair) return;
    
    if (chart.crosshair.updateCrosshair) {
      canvas.removeEventListener('mousemove', chart.crosshair.updateCrosshair);
    }
    if (chart.crosshair.hideCrosshair) {
      canvas.removeEventListener('mouseleave', chart.crosshair.hideCrosshair);
    }
  },
  
  afterDraw(chart) {
    if (!chart.crosshair || !chart.crosshair.active || !chart.crosshair.options.enabled) {
      return;
    }
    
    this.drawCrosshair(chart);
  },
  
  drawCrosshair(chart) {
    if (!chart.crosshair.active) return;
    
    const ctx = chart.ctx;
    const { x, y, options } = chart.crosshair;
    const chartArea = chart.chartArea;
    
    if (x === null || !chartArea) return;
    
    ctx.save();
    
    // Style de la ligne
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.width;
    
    // Style de ligne (solid, dashed, dotted)
    switch (options.style) {
      case 'dashed':
        ctx.setLineDash([5, 5]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 2]);
        break;
      default:
        ctx.setLineDash([]);
    }
    
    // Dessiner la ligne verticale
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    
    ctx.restore();
  },
  
  clearCrosshair(chart) {
    // Chart.js se charge du redraw automatiquement
    chart.update('none');
  },
  
  snapToNearestDataPoint(chart, mouseX) {
    let nearestX = null;
    let minDistance = Infinity;
    
    chart.data.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      dataset.data.forEach(point => {
        if (!point || typeof point.x === 'undefined') return;
        
        const pixelX = chart.scales.x.getPixelForValue(point.x);
        const distance = Math.abs(pixelX - mouseX);
        
        if (distance < minDistance && distance < 20) { // Tolérance de 20px
          minDistance = distance;
          nearestX = pixelX;
        }
      });
    });
    
    return nearestX;
  },
  
  // API publique pour contrôler le crosshair
  enable(chart) {
    if (chart.crosshair) {
      chart.crosshair.options.enabled = true;
    }
  },
  
  disable(chart) {
    if (chart.crosshair) {
      chart.crosshair.options.enabled = false;
      chart.crosshair.active = false;
      this.clearCrosshair(chart);
    }
  },
  
  setColor(chart, color) {
    if (chart.crosshair) {
      chart.crosshair.options.color = color;
    }
  },
  
  setStyle(chart, style) {
    if (chart.crosshair) {
      chart.crosshair.options.style = style;
    }
  },
  
  setSnapToData(chart, enabled) {
    if (chart.crosshair) {
      chart.crosshair.options.snapToData = enabled;
    }
  }
};
