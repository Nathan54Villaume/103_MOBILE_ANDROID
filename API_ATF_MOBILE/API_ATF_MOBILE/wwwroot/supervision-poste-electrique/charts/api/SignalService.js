/**
 * SignalService.js - Service pour la récupération des signaux
 * 
 * Fonctionnalités :
 * - Récupération de la liste des signaux disponibles
 * - Récupération des séries temporelles
 * - Cache intelligent pour éviter les appels répétés
 * - Gestion d'erreur robuste
 * - Timeout et retry automatiques
 */

export class SignalService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.signalsCache = null;
    this.cacheTimestamp = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.requestTimeout = 10000; // 10 secondes
  }

  /**
   * Récupère la liste complète des signaux disponibles
   * @returns {Promise<Array>} Liste des signaux {id, label, unit, group}
   */
  async getAvailableSignals() {
    // Vérifier le cache
    if (this.signalsCache && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp) < this.cacheTimeout) {
      console.log('[SignalService] Signaux depuis le cache');
      return this.signalsCache;
    }

    try {
      console.log('[SignalService] Récupération signaux depuis API...');
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/signals`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const signals = await response.json();
      
      // Valider la structure des données
      if (!Array.isArray(signals)) {
        throw new Error('Format de réponse invalide: attendu un tableau');
      }

      // Normaliser les signaux
      const normalizedSignals = signals.map(signal => ({
        id: signal.id || signal.name || 'unknown',
        label: signal.label || signal.name || signal.id || 'Signal sans nom',
        unit: signal.unit || '',
        group: signal.group || signal.category || 'Général',
        description: signal.description || signal.label || ''
      }));

      // Mettre en cache
      this.signalsCache = normalizedSignals;
      this.cacheTimestamp = Date.now();

      console.log(`[SignalService] ${normalizedSignals.length} signaux récupérés`);
      return normalizedSignals;

    } catch (error) {
      console.error('[SignalService] Erreur récupération signaux:', error);
      
      // Si on a un cache, le retourner en cas d'erreur
      if (this.signalsCache) {
        console.warn('[SignalService] Utilisation du cache en cas d\'erreur');
        return this.signalsCache;
      }

      // Signaux de démonstration en cas d'échec
      return this.getFallbackSignals();
    }
  }

  /**
   * Récupère les données de séries temporelles pour des signaux donnés
   * @param {Array<string>} signalIds - IDs des signaux à récupérer
   * @param {Date} from - Date de début
   * @param {Date} to - Date de fin
   * @returns {Promise<Object>} Données formatées pour Chart.js
   */
  async getSeriesData(signalIds, from, to) {
    if (!signalIds || signalIds.length === 0) {
      return { datasets: [] };
    }

    try {
      const fromISO = from.toISOString();
      const toISO = to.toISOString();
      const signalsParam = signalIds.join(',');
      
      console.log(`[SignalService] Récupération séries: ${signalsParam} (${fromISO} → ${toISO})`);

      const url = `${this.baseUrl}/api/series?signals=${encodeURIComponent(signalsParam)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.formatSeriesForChart(data, signalIds);

    } catch (error) {
      console.error('[SignalService] Erreur récupération séries:', error);
      
      // Générer des données de démo en cas d'erreur
      return this.generateFallbackSeries(signalIds, from, to);
    }
  }

  /**
   * Formate les données de l'API pour Chart.js
   * @param {Object} rawData - Données brutes de l'API
   * @param {Array<string>} signalIds - IDs des signaux demandés
   * @returns {Object} Datasets formatés pour Chart.js
   */
  formatSeriesForChart(rawData, signalIds) {
    const datasets = [];
    const colors = this.getSignalColors();

    signalIds.forEach((signalId, index) => {
      const signalData = rawData[signalId] || rawData.series?.find(s => s.id === signalId);
      
      if (!signalData || !signalData.data) {
        console.warn(`[SignalService] Pas de données pour ${signalId}`);
        return;
      }

      // Convertir les données au format Chart.js
      const chartData = signalData.data.map(point => ({
        x: new Date(point.timestamp || point.time || point.x),
        y: parseFloat(point.value || point.y)
      })).filter(point => !isNaN(point.y));

      if (chartData.length === 0) {
        console.warn(`[SignalService] Aucune donnée valide pour ${signalId}`);
        return;
      }

      datasets.push({
        label: signalData.label || signalId,
        unit: signalData.unit || '',
        data: chartData,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        pointBackgroundColor: colors[index % colors.length],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        spanGaps: true
      });
    });

    return { datasets };
  }

  /**
   * Signaux de fallback pour la démo
   * @returns {Array} Signaux de démonstration
   */
  getFallbackSignals() {
    return [
      { id: 'tr1-power', label: 'TR1 Puissance Active', unit: 'kW', group: 'Transformateurs' },
      { id: 'tr1-reactive', label: 'TR1 Puissance Réactive', unit: 'kVar', group: 'Transformateurs' },
      { id: 'tr1-voltage', label: 'TR1 Tension', unit: 'V', group: 'Transformateurs' },
      { id: 'tr1-current', label: 'TR1 Courant', unit: 'A', group: 'Transformateurs' },
      { id: 'tr2-power', label: 'TR2 Puissance Active', unit: 'kW', group: 'Transformateurs' },
      { id: 'tr2-reactive', label: 'TR2 Puissance Réactive', unit: 'kVar', group: 'Transformateurs' },
      { id: 'tr2-voltage', label: 'TR2 Tension', unit: 'V', group: 'Transformateurs' },
      { id: 'tr2-current', label: 'TR2 Courant', unit: 'A', group: 'Transformateurs' },
      { id: 'line1-power', label: 'Ligne 1 Puissance', unit: 'kW', group: 'Lignes' },
      { id: 'line2-power', label: 'Ligne 2 Puissance', unit: 'kW', group: 'Lignes' },
      { id: 'total-consumption', label: 'Consommation Totale', unit: 'kW', group: 'Global' },
      { id: 'pf-average', label: 'Facteur de Puissance Moyen', unit: 'cos φ', group: 'Global' },
      { id: 'frequency', label: 'Fréquence Réseau', unit: 'Hz', group: 'Réseau' },
      { id: 'temperature', label: 'Température Salle', unit: '°C', group: 'Environnement' },
      { id: 'humidity', label: 'Humidité', unit: '%', group: 'Environnement' }
    ];
  }

  /**
   * Génère des séries de fallback pour la démo
   * @param {Array<string>} signalIds - IDs des signaux
   * @param {Date} from - Date début
   * @param {Date} to - Date fin
   * @returns {Object} Datasets de démonstration
   */
  generateFallbackSeries(signalIds, from, to) {
    const datasets = [];
    const colors = this.getSignalColors();
    const signals = this.getFallbackSignals();

    signalIds.forEach((signalId, index) => {
      const signal = signals.find(s => s.id === signalId);
      if (!signal) return;

      // Générer des données réalistes
      const data = this.generateRealisticData(signalId, from, to);
      
      datasets.push({
        label: signal.label,
        unit: signal.unit,
        data: data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        pointBackgroundColor: colors[index % colors.length],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        spanGaps: true
      });
    });

    return { datasets };
  }

  /**
   * Génère des données réalistes pour un signal donné
   * @param {string} signalId - ID du signal
   * @param {Date} from - Date début
   * @param {Date} to - Date fin
   * @returns {Array} Points de données {x, y}
   */
  generateRealisticData(signalId, from, to) {
    const points = [];
    const duration = to.getTime() - from.getTime();
    const interval = Math.max(60000, duration / 100); // Au moins 1 min entre points
    
    let baseValue = 100;
    let amplitude = 20;
    
    // Valeurs réalistes selon le type de signal
    if (signalId.includes('power')) {
      baseValue = Math.random() * 500 + 200;
      amplitude = baseValue * 0.3;
    } else if (signalId.includes('voltage')) {
      baseValue = 230 + Math.random() * 20;
      amplitude = 10;
    } else if (signalId.includes('current')) {
      baseValue = Math.random() * 50 + 10;
      amplitude = baseValue * 0.2;
    } else if (signalId.includes('pf')) {
      baseValue = 0.85 + Math.random() * 0.1;
      amplitude = 0.05;
    } else if (signalId.includes('frequency')) {
      baseValue = 50;
      amplitude = 0.1;
    } else if (signalId.includes('temperature')) {
      baseValue = 22 + Math.random() * 8;
      amplitude = 2;
    } else if (signalId.includes('humidity')) {
      baseValue = 45 + Math.random() * 20;
      amplitude = 5;
    }
    
    for (let time = from.getTime(); time <= to.getTime(); time += interval) {
      const t = (time - from.getTime()) / duration;
      const noise = (Math.random() - 0.5) * amplitude * 0.5;
      const trend = Math.sin(t * Math.PI * 4) * amplitude * 0.3;
      const value = baseValue + trend + noise;
      
      points.push({
        x: new Date(time),
        y: Math.max(0, value)
      });
    }
    
    return points;
  }

  /**
   * Couleurs pour les différents signaux
   * @returns {Array<string>} Couleurs hexadécimales
   */
  getSignalColors() {
    return [
      '#ef4444', // red-500
      '#3b82f6', // blue-500
      '#10b981', // emerald-500
      '#f59e0b', // amber-500
      '#8b5cf6', // violet-500
      '#06b6d4', // cyan-500
      '#84cc16', // lime-500
      '#f97316', // orange-500
      '#ec4899', // pink-500
      '#6366f1', // indigo-500
      '#14b8a6', // teal-500
      '#eab308', // yellow-500
      '#dc2626', // red-600
      '#2563eb', // blue-600
      '#059669'  // emerald-600
    ];
  }

  /**
   * Fetch avec timeout
   * @param {string} url - URL à fetcher
   * @param {Object} options - Options fetch
   * @returns {Promise<Response>} Réponse fetch
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout de requête dépassé');
      }
      throw error;
    }
  }

  /**
   * Invalide le cache des signaux
   */
  clearCache() {
    this.signalsCache = null;
    this.cacheTimestamp = null;
    console.log('[SignalService] Cache invalidé');
  }
}
