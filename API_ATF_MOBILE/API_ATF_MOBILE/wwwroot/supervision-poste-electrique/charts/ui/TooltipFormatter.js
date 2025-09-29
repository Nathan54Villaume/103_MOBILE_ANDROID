/**
 * TooltipFormatter.js - Formatage avancé des tooltips
 * 
 * Fonctionnalités :
 * - Format HH:mm:ss garanti pour les timestamps
 * - Unités précises dans les tooltips  
 * - Valeurs formatées selon le type
 * - Gestion des valeurs nulles/NaN
 * - Couleurs cohérentes avec les datasets
 */

export class TooltipFormatter {
  
  /**
   * Formate un timestamp en HH:mm:ss français
   * @param {number|Date|string} timestamp - Timestamp à formater
   * @returns {string} Format HH:mm:ss ou date complète si > 24h
   */
  static formatTime(timestamp) {
    try {
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) {
        return '--:--:--';
      }
      
      // Vérifier si c'est aujourd'hui
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        // Format HH:mm:ss pour aujourd'hui
        return date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',  
          second: '2-digit',
          hour12: false
        });
      } else {
        // Format complet pour les autres jours
        return date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
    } catch (error) {
      console.warn('[TooltipFormatter] Erreur formatage time:', error);
      return '--:--:--';
    }
  }
  
  /**
   * Formate une valeur numérique avec unité
   * @param {number} value - Valeur à formater
   * @param {string} unit - Unité (kW, V, A, etc.)
   * @param {number} decimals - Nombre de décimales
   * @returns {string} Valeur formatée avec unité
   */
  static formatValue(value, unit = '', decimals = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return `N/A${unit ? ` ${unit}` : ''}`;
    }
    
    // Formatage selon l'unité
    let formattedValue;
    let displayUnit = unit;
    
    switch (unit.toLowerCase()) {
      case 'kw':
      case 'kvar':
        // Puissance : 2 décimales, passage en MW si > 1000
        if (Math.abs(value) >= 1000) {
          formattedValue = (value / 1000).toFixed(3);
          displayUnit = unit.replace('k', 'M');
        } else {
          formattedValue = value.toFixed(2);
        }
        break;
        
      case 'kwh':
        // Énergie : passage en MWh si > 1000
        if (Math.abs(value) >= 1000) {
          formattedValue = (value / 1000).toFixed(2);
          displayUnit = 'MWh';
        } else {
          formattedValue = value.toFixed(1);
        }
        break;
        
      case 'v':
        // Tension : 1 décimale
        formattedValue = value.toFixed(1);
        break;
        
      case 'a':
        // Courant : 1 décimale  
        formattedValue = value.toFixed(1);
        break;
        
      case '':
      case 'pu':
        // Facteur de puissance : 3 décimales
        if (value <= 1.2 && value >= 0) {
          formattedValue = value.toFixed(3);
          displayUnit = displayUnit || 'cos φ';
        } else {
          formattedValue = value.toFixed(decimals);
        }
        break;
        
      default:
        // Autres unités : selon paramètre
        formattedValue = value.toFixed(decimals);
    }
    
    // Formatage français des nombres (espace pour milliers)
    if (Math.abs(parseFloat(formattedValue)) >= 1000) {
      formattedValue = parseFloat(formattedValue).toLocaleString('fr-FR', {
        minimumFractionDigits: formattedValue.includes('.') ? formattedValue.split('.')[1].length : 0,
        maximumFractionDigits: formattedValue.includes('.') ? formattedValue.split('.')[1].length : 0
      });
    }
    
    return `${formattedValue}${displayUnit ? ` ${displayUnit}` : ''}`;
  }
  
  /**
   * Génère le callback title pour Chart.js tooltips
   * @returns {Function} Callback function
   */
  static getTitleCallback() {
    return (tooltipItems) => {
      if (!tooltipItems || tooltipItems.length === 0) {
        return '';
      }
      
      const firstItem = tooltipItems[0];
      if (!firstItem || !firstItem.parsed) {
        return '';
      }
      
      return this.formatTime(firstItem.parsed.x);
    };
  }
  
  /**
   * Génère le callback label pour Chart.js tooltips
   * @returns {Function} Callback function
   */
  static getLabelCallback() {
    return (context) => {
      if (!context || !context.dataset) {
        return '';
      }
      
      const dataset = context.dataset;
      const value = context.parsed.y;
      const label = dataset.label || 'Signal';
      const unit = dataset.unit || '';
      
      // Déterminer le nombre de décimales selon l'unité
      let decimals = 2;
      if (unit.toLowerCase() === 'v' || unit.toLowerCase() === 'a') {
        decimals = 1;
      } else if (!unit || unit.toLowerCase().includes('pf') || unit.toLowerCase().includes('cos')) {
        decimals = 3;
      }
      
      const formattedValue = this.formatValue(value, unit, decimals);
      
      return `${label}: ${formattedValue}`;
    };
  }
  
  /**
   * Configuration complète des tooltips pour Chart.js
   * @param {Object} options - Options additionnelles
   * @returns {Object} Configuration tooltip
   */
  static getTooltipConfig(options = {}) {
    return {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      titleColor: '#f1f5f9',
      bodyColor: '#e2e8f0',
      borderColor: 'rgba(148,163,184,0.3)',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12,
      displayColors: true,
      titleFont: {
        size: 13,
        weight: '600'
      },
      bodyFont: {
        size: 12,
        weight: 'normal'
      },
      titleMarginBottom: 8,
      bodySpacing: 6,
      caretPadding: 6,
      ...options,
      callbacks: {
        title: this.getTitleCallback(),
        label: this.getLabelCallback(),
        ...options.callbacks
      }
    };
  }
  
  /**
   * Formate une plage de temps pour les axes
   * @param {number} timestamp - Timestamp
   * @param {string} unit - Unité de temps ('minute', 'hour', 'day')
   * @returns {string} Label formaté
   */
  static formatAxisTime(timestamp, unit = 'minute') {
    try {
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) {
        return '';
      }
      
      switch (unit) {
        case 'second':
          return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
        case 'minute':
          return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
        case 'hour':
          return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
        case 'day':
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit'
          });
          
        default:
          return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
      }
    } catch (error) {
      console.warn('[TooltipFormatter] Erreur formatage axis:', error);
      return '';
    }
  }
}
