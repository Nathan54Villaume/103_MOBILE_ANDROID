// ========================================
// DIRIS Manager Module
// Gestion de l'onglet DIRIS
// ========================================

export class DirisManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.autoRefreshInterval = null;
  }

  // ========================================
  // Initialisation
  // ========================================
  init() {
    console.log('🚀 Initialisation DIRIS Manager');
    this.attachEventListeners();
  }

  // ========================================
  // Event Listeners
  // ========================================
  attachEventListeners() {
    // Refresh
    document.getElementById('btnRefreshDiris')?.addEventListener('click', () => this.loadAllData());
    
    // Services Controls
    document.getElementById('btnStartAcquisition')?.addEventListener('click', () => this.startAcquisition());
    document.getElementById('btnStopAcquisition')?.addEventListener('click', () => this.stopAcquisition());
    document.getElementById('btnTriggerCleanup')?.addEventListener('click', () => this.triggerCleanup());
    
    // Configuration
    document.getElementById('btnSaveDirisConfig')?.addEventListener('click', () => this.saveConfiguration());
    
    // Devices
    document.getElementById('btnAddDevice')?.addEventListener('click', () => this.showAddDeviceDialog());
  }

  // ========================================
  // Chargement des données
  // ========================================
  async loadAllData() {
    try {
      await Promise.all([
        this.loadMetrics(),
        this.loadDatabaseStats(),
        this.loadConfiguration(),
        this.loadDevices(),
        this.loadLatestReadings()
      ]);
    } catch (error) {
      console.error('❌ Erreur chargement données DIRIS:', error);
      this.showError('Erreur lors du chargement des données DIRIS');
    }
  }

  // ========================================
  // Métriques d'acquisition
  // ========================================
  async loadMetrics() {
    try {
      const response = await this.apiClient.request('/api/diris/metrics/acquisition');
      
      if (response.throughput) {
        document.getElementById('dirisPointsPerSec').textContent = 
          response.throughput.pointsPerSecond?.toFixed(1) || '0';
        document.getElementById('dirisDevicesPerSec').textContent = 
          response.throughput.devicesPerSecond?.toFixed(2) || '0';
        document.getElementById('dirisP95Latency').textContent = 
          Math.round(response.throughput.p95LatencyMs || 0) + 'ms';
      }
      
      if (response.devices) {
        const activeDevices = response.devices.filter(d => d.status === 'Healthy' || d.status === 'healthy').length;
        document.getElementById('dirisActiveDevices').textContent = activeDevices;
      }
      
      // Update service status
      this.updateServiceStatus(response);
      
    } catch (error) {
      console.error('Erreur chargement métriques:', error);
    }
  }

  updateServiceStatus(metrics) {
    // Acquisition Service
    const acqStatusDot = document.getElementById('dirisAcqStatusDot');
    const acqStatus = document.getElementById('dirisAcqStatus');
    
    if (metrics && metrics.throughput && metrics.throughput.pointsPerSecond > 0) {
      acqStatusDot.className = 'status-dot online';
      acqStatus.textContent = '✅ En cours d\'acquisition';
    } else {
      acqStatusDot.className = 'status-dot offline';
      acqStatus.textContent = '⏸️ Arrêté ou aucune donnée';
    }
    
    // Retention Service
    const retStatusDot = document.getElementById('dirisRetStatusDot');
    const retStatus = document.getElementById('dirisRetStatus');
    retStatusDot.className = 'status-dot online';
    retStatus.textContent = '✅ Service actif';
  }

  // ========================================
  // Statistiques base de données
  // ========================================
  async loadDatabaseStats() {
    try {
      const response = await this.apiClient.request('/api/diris/cleanup/stats');
      
      if (response.success && response.data) {
        const data = response.data;
        
        document.getElementById('dirisTotalMeasurements').textContent = 
          this.formatNumber(data.totalMeasurements || 0);
        document.getElementById('dirisMeasurementsToDelete').textContent = 
          this.formatNumber(data.measurementsToDelete || 0);
        document.getElementById('dirisDatabaseSize').textContent = 
          data.databaseSize || '0 MB';
        
        document.getElementById('dirisOldestMeasurement').textContent = 
          data.oldestMeasurement ? new Date(data.oldestMeasurement).toLocaleString('fr-FR') : '-';
        document.getElementById('dirisNewestMeasurement').textContent = 
          data.newestMeasurement ? new Date(data.newestMeasurement).toLocaleString('fr-FR') : '-';
      }
    } catch (error) {
      console.error('Erreur chargement stats BDD:', error);
    }
  }

  // ========================================
  // Configuration
  // ========================================
  async loadConfiguration() {
    try {
      // Load from appsettings or config endpoint
      const config = await this.apiClient.request('/api/admin/config');
      
      if (config.acquisition) {
        document.getElementById('configParallelism').value = config.acquisition.parallelism || 6;
        document.getElementById('configPollInterval').value = config.acquisition.defaultPollIntervalMs || 1500;
        document.getElementById('configMaxBatch').value = config.acquisition.maxBatchPoints || 1000;
      }
      
      if (config.dataRetention) {
        document.getElementById('configRetentionDays').value = config.dataRetention.retentionDays || 10;
        document.getElementById('configCleanupHour').value = config.dataRetention.cleanupHour || 2;
        document.getElementById('configRetentionEnabled').checked = config.dataRetention.enabled !== false;
      }
    } catch (error) {
      console.error('Erreur chargement configuration:', error);
      // Set default values
      document.getElementById('configParallelism').value = 6;
      document.getElementById('configPollInterval').value = 1500;
      document.getElementById('configMaxBatch').value = 1000;
      document.getElementById('configRetentionDays').value = 10;
      document.getElementById('configCleanupHour').value = 2;
      document.getElementById('configRetentionEnabled').checked = true;
    }
  }

  async saveConfiguration() {
    try {
      const config = {
        acquisition: {
          parallelism: parseInt(document.getElementById('configParallelism').value),
          defaultPollIntervalMs: parseInt(document.getElementById('configPollInterval').value),
          maxBatchPoints: parseInt(document.getElementById('configMaxBatch').value)
        },
        dataRetention: {
          enabled: document.getElementById('configRetentionEnabled').checked,
          retentionDays: parseInt(document.getElementById('configRetentionDays').value),
          cleanupHour: parseInt(document.getElementById('configCleanupHour').value)
        }
      };
      
      // Note: This would need a backend endpoint to save config
      // For now, just show success message
      this.showSuccess('⚠️ Fonctionnalité en cours de développement. Modifiez appsettings.json pour changer la configuration.');
      
    } catch (error) {
      console.error('Erreur sauvegarde configuration:', error);
      this.showError('Erreur lors de la sauvegarde de la configuration');
    }
  }

  // ========================================
  // Devices
  // ========================================
  async loadDevices() {
    try {
      const devices = await this.apiClient.request('/api/diris/devices');
      const container = document.getElementById('dirisDevicesList');
      
      if (!devices || devices.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucun device configuré</p>';
        return;
      }
      
      container.innerHTML = devices.map(device => `
        <div class="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="status-dot ${device.enabled ? 'online' : 'offline'}"></div>
            <div>
              <p class="font-medium text-sm">${this.escapeHtml(device.name || `Device ${device.deviceId}`)}</p>
              <p class="text-xs text-slate-400">${this.escapeHtml(device.ipAddress || 'N/A')} • Poll: ${device.pollIntervalMs || 1500}ms</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="window.dirisManager.testDevice(${device.deviceId})" 
                    class="px-2 py-1 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors">
              🔍 Test
            </button>
            <button onclick="window.dirisManager.toggleDevice(${device.deviceId}, ${!device.enabled})" 
                    class="px-2 py-1 text-xs rounded ${device.enabled ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'} hover:opacity-80 transition-colors">
              ${device.enabled ? '⏸️ Désactiver' : '▶️ Activer'}
            </button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Erreur chargement devices:', error);
      document.getElementById('dirisDevicesList').innerHTML = 
        '<p class="text-center text-red-400 py-8">Erreur de chargement des devices</p>';
    }
  }

  async testDevice(deviceId) {
    try {
      this.showInfo(`Test du device ${deviceId} en cours...`);
      const result = await this.apiClient.request(`/api/diris/devices/${deviceId}/poll`, { method: 'POST' });
      
      if (result.isSuccess) {
        this.showSuccess(`✅ Device ${deviceId}: ${result.measurements?.length || 0} mesures lues en ${Math.round(result.pollDuration * 1000)}ms`);
      } else {
        this.showError(`❌ Erreur device ${deviceId}: ${result.errorMessage || 'Inconnu'}`);
      }
    } catch (error) {
      console.error('Erreur test device:', error);
      this.showError(`Erreur lors du test du device ${deviceId}`);
    }
  }

  async toggleDevice(deviceId, enable) {
    try {
      // This would need a backend endpoint
      this.showInfo(`${enable ? 'Activation' : 'Désactivation'} du device ${deviceId}...`);
      // Reload devices after toggle
      setTimeout(() => this.loadDevices(), 1000);
    } catch (error) {
      console.error('Erreur toggle device:', error);
    }
  }

  showAddDeviceDialog() {
    this.showInfo('⚠️ Fonctionnalité en cours de développement. Ajoutez des devices via l\'API ou la base de données.');
  }

  // ========================================
  // Dernières mesures
  // ========================================
  async loadLatestReadings() {
    try {
      const readings = await this.apiClient.request('/api/diris/readings/latest');
      const container = document.getElementById('dirisLatestReadings');
      
      if (!readings || readings.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucune mesure disponible</p>';
        return;
      }
      
      container.innerHTML = readings.slice(0, 10).map(device => `
        <div class="p-3 bg-white/5 rounded-lg border border-white/10">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-sm">${this.escapeHtml(device.deviceName || `Device ${device.deviceId}`)}</h4>
            <span class="text-xs text-slate-400">${device.signals?.length || 0} signaux</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            ${(device.signals || []).slice(0, 6).map(signal => `
              <div class="p-2 bg-white/5 rounded">
                <p class="text-slate-400 truncate">${this.escapeHtml(signal.signal)}</p>
                <p class="font-mono font-bold">${signal.value?.toFixed(2) || '0'} ${this.escapeHtml(signal.unit || '')}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Erreur chargement dernières mesures:', error);
      document.getElementById('dirisLatestReadings').innerHTML = 
        '<p class="text-center text-red-400 py-8">Erreur de chargement des mesures</p>';
    }
  }

  // ========================================
  // Contrôles services
  // ========================================
  async startAcquisition() {
    try {
      this.showInfo('⚠️ Fonctionnalité en cours de développement. L\'acquisition démarre automatiquement au lancement du serveur.');
    } catch (error) {
      console.error('Erreur démarrage acquisition:', error);
      this.showError('Erreur lors du démarrage de l\'acquisition');
    }
  }

  async stopAcquisition() {
    try {
      this.showInfo('⚠️ Fonctionnalité en cours de développement. Redémarrez le serveur pour arrêter l\'acquisition.');
    } catch (error) {
      console.error('Erreur arrêt acquisition:', error);
      this.showError('Erreur lors de l\'arrêt de l\'acquisition');
    }
  }

  async triggerCleanup() {
    if (!confirm('Déclencher le nettoyage des données anciennes maintenant ?')) {
      return;
    }
    
    try {
      this.showInfo('🧹 Nettoyage en cours...');
      const result = await this.apiClient.request('/api/diris/cleanup', { method: 'POST' });
      
      if (result.success && result.stats) {
        this.showSuccess(`✅ Nettoyage terminé: ${result.stats.deletedCount} mesures supprimées, ${result.stats.retainedCount} conservées`);
        await this.loadDatabaseStats();
      } else {
        this.showError('❌ Erreur lors du nettoyage');
      }
    } catch (error) {
      console.error('Erreur nettoyage:', error);
      this.showError('Erreur lors du nettoyage des données');
    }
  }

  // ========================================
  // Auto-refresh
  // ========================================
  startAutoRefresh(intervalMs = 5000) {
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      this.loadMetrics();
      this.loadDatabaseStats();
    }, intervalMs);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  // ========================================
  // Utilitaires
  // ========================================
  formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 ${
      type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
      type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
      'bg-blue-500/20 border-blue-500/30 text-blue-400'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Make it globally accessible for inline onclick handlers
window.dirisManager = null;

