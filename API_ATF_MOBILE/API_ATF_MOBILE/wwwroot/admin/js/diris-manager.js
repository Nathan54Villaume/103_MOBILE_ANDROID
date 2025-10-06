// ========================================
// DIRIS Manager Module
// Gestion de l'onglet DIRIS
// ========================================

export class DirisManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.autoRefreshInterval = null;
    this.charts = {};
    this.chartData = {
      throughput: [],
      latency: [],
      devices: [],
      labels: []
    };
    this.maxDataPoints = 50;
    this.chartsPaused = false;
    this.alerts = [];
    this.alertThresholds = {
      maxLatency: 2000,
      minThroughput: 1,
      minDevices: 1
    };
    this.history = [];
  }

  // ========================================
  // Initialisation
  // ========================================
  init() {
    console.log('🚀 Initialisation DIRIS Manager');
    this.attachEventListeners();
    this.initCharts();
    this.initAlerts();
    this.initHistory();
    
    // Start auto-refresh if checkbox is checked
    const autoRefreshCheckbox = document.getElementById('dirisAutoRefresh');
    if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
      this.startAutoRefresh();
    }
  }

  // ========================================
  // Event Listeners
  // ========================================
  attachEventListeners() {
    // Refresh
    document.getElementById('btnRefreshDiris')?.addEventListener('click', () => this.loadAllData());
    
    // Auto-refresh toggle
    document.getElementById('dirisAutoRefresh')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
        this.showInfo('Auto-refresh activé (5s)');
      } else {
        this.stopAutoRefresh();
        this.showInfo('Auto-refresh désactivé');
      }
    });
    
    // Services Controls
    document.getElementById('btnStartAcquisition')?.addEventListener('click', () => this.startAcquisition());
    document.getElementById('btnStopAcquisition')?.addEventListener('click', () => this.stopAcquisition());
    document.getElementById('btnTriggerCleanup')?.addEventListener('click', () => this.triggerCleanup());
    
    // Configuration
    document.getElementById('btnSaveDirisConfig')?.addEventListener('click', () => this.saveConfiguration());
    document.getElementById('btnResetDirisConfig')?.addEventListener('click', () => this.resetConfiguration());
    
    // Configuration validation
    document.getElementById('configParallelism')?.addEventListener('input', (e) => this.validateConfigField('parallelism', e.target.value));
    document.getElementById('configPollInterval')?.addEventListener('input', (e) => this.validateConfigField('pollInterval', e.target.value));
    document.getElementById('configMaxBatch')?.addEventListener('input', (e) => this.validateConfigField('maxBatch', e.target.value));
    document.getElementById('configRetentionDays')?.addEventListener('input', (e) => this.validateConfigField('retentionDays', e.target.value));
    document.getElementById('configCleanupHour')?.addEventListener('input', (e) => this.validateConfigField('cleanupHour', e.target.value));
    
    // Devices
    document.getElementById('btnAddDevice')?.addEventListener('click', () => this.showAddDeviceDialog());
    
    // Charts controls
    document.getElementById('btnPauseCharts')?.addEventListener('click', () => this.toggleChartsPause());
    document.getElementById('btnResetCharts')?.addEventListener('click', () => this.resetCharts());
    
    // Alerts controls
    document.getElementById('dirisAlertsEnabled')?.addEventListener('change', (e) => this.toggleAlerts(e.target.checked));
    document.getElementById('alertMaxLatency')?.addEventListener('input', (e) => this.updateAlertThreshold('maxLatency', e.target.value));
    document.getElementById('alertMinThroughput')?.addEventListener('input', (e) => this.updateAlertThreshold('minThroughput', e.target.value));
    document.getElementById('alertMinDevices')?.addEventListener('input', (e) => this.updateAlertThreshold('minDevices', e.target.value));
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
      
      // Update charts with new data
      this.updateCharts(response);
      
      // Check alerts
      this.checkAlerts(response);
      
      // Update global status
      this.updateGlobalStatus(response);
      
    } catch (error) {
      console.error('Erreur chargement métriques:', error);
    }
  }

  async updateServiceStatus(metrics) {
    try {
      // Récupérer le statut de l'acquisition
      const statusResponse = await this.apiClient.request('/api/diris/acquisition/status');
      
      // Acquisition Service
      const acqStatusDot = document.getElementById('dirisAcqStatusDot');
      const acqStatus = document.getElementById('dirisAcqStatus');
      
      if (statusResponse.success && statusResponse.data) {
        const isRunning = statusResponse.data.isRunning;
        if (isRunning) {
          acqStatusDot.className = 'status-dot online';
          acqStatus.textContent = '✅ En cours d\'acquisition';
        } else {
          acqStatusDot.className = 'status-dot offline';
          acqStatus.textContent = '⏸️ Arrêté';
        }
      } else {
        // Fallback sur les métriques si le statut n'est pas disponible
        if (metrics && metrics.throughput && metrics.throughput.pointsPerSecond > 0) {
          acqStatusDot.className = 'status-dot online';
          acqStatus.textContent = '✅ En cours d\'acquisition';
        } else {
          acqStatusDot.className = 'status-dot offline';
          acqStatus.textContent = '⏸️ Arrêté ou aucune donnée';
        }
      }
      
      // Retention Service
      const retStatusDot = document.getElementById('dirisRetStatusDot');
      const retStatus = document.getElementById('dirisRetStatus');
      retStatusDot.className = 'status-dot online';
      retStatus.textContent = '✅ Service actif';
    } catch (error) {
      console.error('Erreur mise à jour statut service:', error);
      // Fallback sur les métriques
      const acqStatusDot = document.getElementById('dirisAcqStatusDot');
      const acqStatus = document.getElementById('dirisAcqStatus');
      if (metrics && metrics.throughput && metrics.throughput.pointsPerSecond > 0) {
        acqStatusDot.className = 'status-dot online';
        acqStatus.textContent = '✅ En cours d\'acquisition';
      } else {
        acqStatusDot.className = 'status-dot offline';
        acqStatus.textContent = '⏸️ Arrêté ou aucune donnée';
      }
    }
  }

  updateGlobalStatus(metrics) {
    try {
      // Update devices count
      const devicesCount = metrics.devices?.length || 0;
      document.getElementById('dirisDevicesCount').textContent = devicesCount;
      
      // Update performance status
      const throughput = metrics.throughput?.pointsPerSecond || 0;
      const latency = metrics.throughput?.p95LatencyMs || 0;
      
      let performanceStatus = '⚡ Bon';
      let performanceClass = 'text-green-400';
      
      if (throughput < 1) {
        performanceStatus = '⚠️ Faible';
        performanceClass = 'text-orange-400';
      } else if (latency > 2000) {
        performanceStatus = '🐌 Lent';
        performanceClass = 'text-red-400';
      } else if (throughput > 10) {
        performanceStatus = '🚀 Excellent';
        performanceClass = 'text-green-400';
      }
      
      const performanceElement = document.getElementById('dirisPerformanceStatus');
      performanceElement.textContent = performanceStatus;
      performanceElement.className = `text-lg font-bold ${performanceClass}`;
      
      // Update alerts count
      document.getElementById('dirisAlertsCount').textContent = this.alerts.length;
      
      // Update global status
      const globalStatusDot = document.getElementById('dirisGlobalStatusDot');
      const globalStatusText = document.getElementById('dirisGlobalStatusText');
      
      const isAcquisitionRunning = metrics.throughput?.pointsPerSecond > 0;
      const hasActiveDevices = devicesCount > 0;
      const hasAlerts = this.alerts.length > 0;
      
      if (isAcquisitionRunning && hasActiveDevices && !hasAlerts) {
        globalStatusDot.className = 'status-dot online';
        globalStatusText.textContent = '✅ Système opérationnel';
      } else if (isAcquisitionRunning && hasActiveDevices && hasAlerts) {
        globalStatusDot.className = 'status-dot warning';
        globalStatusText.textContent = '⚠️ Fonctionnel avec alertes';
      } else if (isAcquisitionRunning && !hasActiveDevices) {
        globalStatusDot.className = 'status-dot warning';
        globalStatusText.textContent = '⚠️ Acquisition active, pas de devices';
      } else if (!isAcquisitionRunning && hasActiveDevices) {
        globalStatusDot.className = 'status-dot offline';
        globalStatusText.textContent = '⏸️ Acquisition arrêtée';
      } else if (!isAcquisitionRunning && !hasActiveDevices) {
        globalStatusDot.className = 'status-dot unknown';
        globalStatusText.textContent = '❓ Aucun device configuré';
      } else {
        globalStatusDot.className = 'status-dot warning';
        globalStatusText.textContent = '⚠️ État inconnu';
      }
      
    } catch (error) {
      console.error('Erreur mise à jour statut global:', error);
    }
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
      // Load from DIRIS config endpoint
      const response = await this.apiClient.request('/api/diris/config');
      
      if (response.success && response.data) {
        const config = response.data;
        
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

  validateConfigField(field, value) {
    const numValue = parseInt(value);
    let isValid = true;
    let message = '';
    
    switch (field) {
      case 'parallelism':
        if (numValue < 1 || numValue > 20) {
          isValid = false;
          message = 'Parallélisme doit être entre 1 et 20';
        }
        break;
      case 'pollInterval':
        if (numValue < 500 || numValue > 10000) {
          isValid = false;
          message = 'Intervalle de poll doit être entre 500ms et 10000ms';
        }
        break;
      case 'maxBatch':
        if (numValue < 100 || numValue > 5000) {
          isValid = false;
          message = 'Taille des lots doit être entre 100 et 5000';
        }
        break;
      case 'retentionDays':
        if (numValue < 1 || numValue > 365) {
          isValid = false;
          message = 'Durée de rétention doit être entre 1 et 365 jours';
        }
        break;
      case 'cleanupHour':
        if (numValue < 0 || numValue > 23) {
          isValid = false;
          message = 'Heure de nettoyage doit être entre 0 et 23';
        }
        break;
    }
    
    const input = document.getElementById(`config${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (input) {
      if (isValid) {
        input.style.borderColor = 'rgba(255,255,255,0.1)';
        input.title = '';
      } else {
        input.style.borderColor = '#ef4444';
        input.title = message;
      }
    }
    
    return isValid;
  }

  async saveConfiguration() {
    try {
      // Validate all fields before saving
      const fields = ['parallelism', 'pollInterval', 'maxBatch', 'retentionDays', 'cleanupHour'];
      const allValid = fields.every(field => {
        const value = document.getElementById(`config${field.charAt(0).toUpperCase() + field.slice(1)}`).value;
        return this.validateConfigField(field, value);
      });
      
      if (!allValid) {
        this.showError('❌ Veuillez corriger les erreurs de validation avant de sauvegarder');
        return;
      }
      
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
      
      this.showInfo('💾 Sauvegarde de la configuration en cours...');
      
      const response = await this.apiClient.request('/api/diris/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });
      
      if (response.success) {
        this.showSuccess('✅ Configuration DIRIS sauvegardée avec succès');
        this.addHistoryEvent('success', 'Configuration sauvegardée', 'Paramètres DIRIS mis à jour');
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible de sauvegarder la configuration'}`);
        this.addHistoryEvent('error', 'Échec sauvegarde configuration', response.message || 'Erreur inconnue');
      }
      
    } catch (error) {
      console.error('Erreur sauvegarde configuration:', error);
      this.showError('Erreur lors de la sauvegarde de la configuration');
      this.addHistoryEvent('error', 'Erreur sauvegarde configuration', error.message);
    }
  }

  async resetConfiguration() {
    if (!confirm('Restaurer la configuration DIRIS aux valeurs par défaut ? Cette action est irréversible.')) {
      return;
    }

    try {
      this.showInfo('🔄 Restauration de la configuration par défaut...');
      
      const response = await this.apiClient.request('/api/diris/config/reset', {
        method: 'POST'
      });
      
      if (response.success) {
        this.showSuccess('✅ Configuration restaurée aux valeurs par défaut');
        this.addHistoryEvent('success', 'Configuration réinitialisée', 'Paramètres DIRIS restaurés aux valeurs par défaut');
        
        // Reload configuration to update UI
        await this.loadConfiguration();
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible de restaurer la configuration'}`);
        this.addHistoryEvent('error', 'Échec réinitialisation', response.message || 'Erreur inconnue');
      }
      
    } catch (error) {
      console.error('Erreur réinitialisation configuration:', error);
      this.showError('Erreur lors de la réinitialisation de la configuration');
      this.addHistoryEvent('error', 'Erreur réinitialisation', error.message);
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
      this.showInfo(`${enable ? 'Activation' : 'Désactivation'} du device ${deviceId}...`);
      
      const response = await this.apiClient.request(`/api/diris/devices/${deviceId}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: enable })
      });
      
      if (response.success) {
        const action = enable ? 'activé' : 'désactivé';
        this.showSuccess(`✅ Device ${deviceId} ${action} avec succès`);
        this.addHistoryEvent('success', `Device ${action}`, `Device ${deviceId} ${action} avec succès`);
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible de modifier le statut du device'}`);
        this.addHistoryEvent('error', 'Échec modification device', response.message || 'Erreur inconnue');
      }
      
      // Reload devices after toggle
      setTimeout(() => this.loadDevices(), 1000);
    } catch (error) {
      console.error('Erreur toggle device:', error);
      this.showError(`Erreur lors de la ${enable ? 'activation' : 'désactivation'} du device ${deviceId}`);
      this.addHistoryEvent('error', 'Erreur modification device', error.message);
    }
  }

  showAddDeviceDialog() {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Ajouter un device DIRIS</h3>
          <button class="close-modal text-slate-400 hover:text-white">✕</button>
        </div>
        
        <form id="addDeviceForm" class="space-y-4">
          <div>
            <label class="block text-sm text-slate-300 mb-1">Nom du device</label>
            <input type="text" id="deviceName" class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" placeholder="Ex: DIRIS_Poste_01" required>
          </div>
          
          <div>
            <label class="block text-sm text-slate-300 mb-1">Adresse IP</label>
            <input type="text" id="deviceIp" class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" placeholder="192.168.1.100" required>
          </div>
          
          <div>
            <label class="block text-sm text-slate-300 mb-1">Intervalle de poll (ms)</label>
            <input type="number" id="devicePollInterval" class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" value="1500" min="500" max="10000">
          </div>
          
          <div>
            <label class="block text-sm text-slate-300 mb-1">Description (optionnel)</label>
            <textarea id="deviceDescription" class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" rows="2" placeholder="Description du device..."></textarea>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="submit" class="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-lg text-sm font-medium transition-colors">
              ➕ Ajouter
            </button>
            <button type="button" class="close-modal px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    modal.querySelector('#addDeviceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addDevice({
        name: document.getElementById('deviceName').value,
        ipAddress: document.getElementById('deviceIp').value,
        pollIntervalMs: parseInt(document.getElementById('devicePollInterval').value),
        description: document.getElementById('deviceDescription').value,
        enabled: true
      });
      modal.remove();
    });
  }

  async addDevice(deviceData) {
    try {
      this.showInfo('Ajout du device en cours...');
      
      const response = await this.apiClient.request('/api/diris/devices', {
        method: 'POST',
        body: JSON.stringify(deviceData)
      });
      
      if (response && response.deviceId) {
        this.showSuccess(`✅ Device ajouté avec succès (ID: ${response.deviceId})`);
        this.addHistoryEvent('success', 'Device ajouté', `Device ${deviceData.name} ajouté avec succès`);
      } else {
        this.showError('❌ Erreur lors de l\'ajout du device');
        this.addHistoryEvent('error', 'Échec ajout device', 'Erreur lors de l\'ajout du device');
      }
      
      // Reload devices list
      setTimeout(() => this.loadDevices(), 1000);
      
    } catch (error) {
      console.error('Erreur ajout device:', error);
      this.showError('Erreur lors de l\'ajout du device');
      this.addHistoryEvent('error', 'Erreur ajout device', error.message);
    }
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
  // Export des données
  // ========================================
  async exportData(format = 'csv') {
    try {
      this.showInfo(`Export des données DIRIS en ${format.toUpperCase()}...`);
      
      // Get latest readings for export
      const readings = await this.apiClient.request('/api/diris/readings/latest');
      const devices = await this.apiClient.request('/api/diris/devices');
      
      let content = '';
      let filename = '';
      
      if (format === 'csv') {
        content = this.generateCsvExport(readings, devices);
        filename = `diris-export-${new Date().toISOString().split('T')[0]}.csv`;
      } else if (format === 'json') {
        content = JSON.stringify({ readings, devices, timestamp: new Date().toISOString() }, null, 2);
        filename = `diris-export-${new Date().toISOString().split('T')[0]}.json`;
      }
      
      // Download file
      const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showSuccess(`✅ Export ${format.toUpperCase()} téléchargé: ${filename}`);
      
    } catch (error) {
      console.error('Erreur export données:', error);
      this.showError('Erreur lors de l\'export des données');
    }
  }

  generateCsvExport(readings, devices) {
    let csv = 'Device ID,Device Name,IP Address,Signal,Value,Unit,Timestamp\n';
    
    readings.forEach(device => {
      const deviceInfo = devices.find(d => d.deviceId === device.deviceId);
      const deviceName = deviceInfo?.name || `Device ${device.deviceId}`;
      const ipAddress = deviceInfo?.ipAddress || 'N/A';
      
      (device.signals || []).forEach(signal => {
        csv += `${device.deviceId},${deviceName},${ipAddress},${signal.signal},${signal.value},${signal.unit || ''},${device.timestamp || new Date().toISOString()}\n`;
      });
    });
    
    return csv;
  }

  // ========================================
  // Contrôles services
  // ========================================
  async startAcquisition() {
    try {
      this.showInfo('▶️ Démarrage de l\'acquisition DIRIS...');
      
      const result = await this.apiClient.request('/api/diris/acquisition/start', { method: 'POST' });
      
      if (result.success) {
        this.showSuccess('✅ Acquisition DIRIS démarrée avec succès');
        this.addHistoryEvent('success', 'Acquisition démarrée', 'Service d\'acquisition DIRIS démarré avec succès');
        // Rafraîchir les métriques pour voir le changement
        await this.loadMetrics();
      } else {
        this.showError(`❌ Erreur: ${result.message || 'Impossible de démarrer l\'acquisition'}`);
        this.addHistoryEvent('error', 'Échec démarrage acquisition', result.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur démarrage acquisition:', error);
      this.showError('Erreur lors du démarrage de l\'acquisition');
    }
  }

  async stopAcquisition() {
    try {
      this.showInfo('⏸️ Arrêt de l\'acquisition DIRIS...');
      
      const result = await this.apiClient.request('/api/diris/acquisition/stop', { method: 'POST' });
      
      if (result.success) {
        this.showSuccess('✅ Acquisition DIRIS arrêtée avec succès');
        this.addHistoryEvent('success', 'Acquisition arrêtée', 'Service d\'acquisition DIRIS arrêté avec succès');
        // Rafraîchir les métriques pour voir le changement
        await this.loadMetrics();
      } else {
        this.showError(`❌ Erreur: ${result.message || 'Impossible d\'arrêter l\'acquisition'}`);
        this.addHistoryEvent('error', 'Échec arrêt acquisition', result.message || 'Erreur inconnue');
      }
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
        this.addHistoryEvent('success', 'Nettoyage effectué', `${result.stats.deletedCount} mesures supprimées, ${result.stats.retainedCount} conservées`);
        await this.loadDatabaseStats();
      } else {
        this.showError('❌ Erreur lors du nettoyage');
        this.addHistoryEvent('error', 'Échec nettoyage', 'Erreur lors du nettoyage des données');
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
  // Graphiques temps réel
  // ========================================
  initCharts() {
    try {
      // Throughput Chart
      const throughputCtx = document.getElementById('dirisThroughputChart');
      if (throughputCtx) {
        this.charts.throughput = new Chart(throughputCtx, {
          type: 'line',
          data: {
            labels: this.chartData.labels,
            datasets: [{
              label: 'Points/seconde',
              data: this.chartData.throughput,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                display: false
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.1)' },
                ticks: { color: '#94a3b8' }
              }
            },
            elements: {
              point: { radius: 0 }
            }
          }
        });
      }

      // Latency Chart
      const latencyCtx = document.getElementById('dirisLatencyChart');
      if (latencyCtx) {
        this.charts.latency = new Chart(latencyCtx, {
          type: 'line',
          data: {
            labels: this.chartData.labels,
            datasets: [{
              label: 'Latence P95 (ms)',
              data: this.chartData.latency,
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                display: false
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.1)' },
                ticks: { color: '#94a3b8' }
              }
            },
            elements: {
              point: { radius: 0 }
            }
          }
        });
      }

      // Devices Chart
      const devicesCtx = document.getElementById('dirisDevicesChart');
      if (devicesCtx) {
        this.charts.devices = new Chart(devicesCtx, {
          type: 'line',
          data: {
            labels: this.chartData.labels,
            datasets: [{
              label: 'Devices actifs',
              data: this.chartData.devices,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                display: false
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.1)' },
                ticks: { color: '#94a3b8' }
              }
            },
            elements: {
              point: { radius: 0 }
            }
          }
        });
      }
    } catch (error) {
      console.error('Erreur initialisation graphiques:', error);
    }
  }

  updateCharts(metrics) {
    if (this.chartsPaused) return;

    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Add new data points
    this.chartData.labels.push(now);
    this.chartData.throughput.push(metrics.throughput?.pointsPerSecond || 0);
    this.chartData.latency.push(metrics.throughput?.p95LatencyMs || 0);
    this.chartData.devices.push(metrics.devices?.filter(d => d.status === 'Healthy' || d.status === 'healthy').length || 0);

    // Keep only last maxDataPoints
    if (this.chartData.labels.length > this.maxDataPoints) {
      this.chartData.labels.shift();
      this.chartData.throughput.shift();
      this.chartData.latency.shift();
      this.chartData.devices.shift();
    }

    // Update charts
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.update('none');
      }
    });
  }

  toggleChartsPause() {
    this.chartsPaused = !this.chartsPaused;
    const btn = document.getElementById('btnPauseCharts');
    if (btn) {
      btn.textContent = this.chartsPaused ? '▶️ Reprendre' : '⏸️ Pause';
    }
    this.showInfo(this.chartsPaused ? 'Graphiques en pause' : 'Graphiques repris');
  }

  resetCharts() {
    this.chartData = {
      throughput: [],
      latency: [],
      devices: [],
      labels: []
    };

    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.data.labels = this.chartData.labels;
        chart.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        chart.update();
      }
    });

    this.showInfo('Graphiques réinitialisés');
  }

  // ========================================
  // Système d'alertes
  // ========================================
  initAlerts() {
    // Load alert thresholds from localStorage or use defaults
    const savedThresholds = localStorage.getItem('diris-alert-thresholds');
    if (savedThresholds) {
      this.alertThresholds = { ...this.alertThresholds, ...JSON.parse(savedThresholds) };
    }
    
    // Update UI with current thresholds
    document.getElementById('alertMaxLatency').value = this.alertThresholds.maxLatency;
    document.getElementById('alertMinThroughput').value = this.alertThresholds.minThroughput;
    document.getElementById('alertMinDevices').value = this.alertThresholds.minDevices;
    
    // Load saved alerts
    const savedAlerts = localStorage.getItem('diris-alerts');
    if (savedAlerts) {
      this.alerts = JSON.parse(savedAlerts);
      this.updateAlertsDisplay();
    }
  }

  updateAlertThreshold(type, value) {
    this.alertThresholds[type] = parseInt(value);
    localStorage.setItem('diris-alert-thresholds', JSON.stringify(this.alertThresholds));
  }

  toggleAlerts(enabled) {
    const checkbox = document.getElementById('dirisAlertsEnabled');
    if (checkbox) {
      checkbox.checked = enabled;
    }
    this.showInfo(enabled ? 'Alertes activées' : 'Alertes désactivées');
  }

  checkAlerts(metrics) {
    const alertsEnabled = document.getElementById('dirisAlertsEnabled')?.checked;
    if (!alertsEnabled) return;

    const now = new Date();
    const newAlerts = [];

    // Check if acquisition is running
    const isAcquisitionRunning = metrics.throughput?.pointsPerSecond > 0;
    
    // Check latency threshold (only if acquisition is running)
    const latency = metrics.throughput?.p95LatencyMs || 0;
    if (isAcquisitionRunning && latency > this.alertThresholds.maxLatency) {
      newAlerts.push({
        id: `latency-${now.getTime()}`,
        type: 'warning',
        title: 'Latence élevée',
        message: `Latence P95: ${latency}ms (seuil: ${this.alertThresholds.maxLatency}ms)`,
        timestamp: now,
        metric: 'latency',
        value: latency,
        threshold: this.alertThresholds.maxLatency
      });
    }

    // Check throughput threshold (only if acquisition is running)
    const throughput = metrics.throughput?.pointsPerSecond || 0;
    if (isAcquisitionRunning && throughput < this.alertThresholds.minThroughput) {
      newAlerts.push({
        id: `throughput-${now.getTime()}`,
        type: 'error',
        title: 'Throughput faible',
        message: `Throughput: ${throughput.toFixed(1)} pts/s (seuil: ${this.alertThresholds.minThroughput} pts/s)`,
        timestamp: now,
        metric: 'throughput',
        value: throughput,
        threshold: this.alertThresholds.minThroughput
      });
    }

    // Check devices threshold (only if acquisition is running and devices are configured)
    const totalDevices = metrics.devices?.length || 0;
    const activeDevices = metrics.devices?.filter(d => d.status === 'Healthy' || d.status === 'healthy').length || 0;
    
    // Only alert about devices if:
    // 1. Acquisition is running (we expect devices to be active)
    // 2. We have devices configured (totalDevices > 0)
    // 3. Active devices are below threshold
    if (isAcquisitionRunning && totalDevices > 0 && activeDevices < this.alertThresholds.minDevices) {
      newAlerts.push({
        id: `devices-${now.getTime()}`,
        type: 'error',
        title: 'Peu de devices actifs',
        message: `Devices actifs: ${activeDevices}/${totalDevices} (seuil: ${this.alertThresholds.minDevices})`,
        timestamp: now,
        metric: 'devices',
        value: activeDevices,
        threshold: this.alertThresholds.minDevices
      });
    }

    // Add new alerts and limit to last 20
    this.alerts = [...newAlerts, ...this.alerts].slice(0, 20);
    
    // Save to localStorage
    localStorage.setItem('diris-alerts', JSON.stringify(this.alerts));
    
    // Update display
    this.updateAlertsDisplay();
    
    // Show notifications for new alerts
    newAlerts.forEach(alert => {
      this.showAlertNotification(alert);
    });
  }

  updateAlertsDisplay() {
    const container = document.getElementById('dirisAlertsList');
    if (!container) return;

    if (this.alerts.length === 0) {
      container.innerHTML = '<p class="text-center text-slate-400 py-4">Aucune alerte récente</p>';
      return;
    }

    container.innerHTML = this.alerts.map(alert => `
      <div class="p-3 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded ${
              alert.type === 'error' ? 'bg-red-500/20 text-red-400' :
              alert.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
              'bg-blue-500/20 text-blue-400'
            }">
              ${alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span class="text-sm font-medium">${alert.title}</span>
          </div>
          <span class="text-xs text-slate-400">${alert.timestamp.toLocaleTimeString('fr-FR')}</span>
        </div>
        <p class="text-xs text-slate-300">${alert.message}</p>
      </div>
    `).join('');
  }

  showAlertNotification(alert) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 left-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 max-w-sm ${
      alert.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
      alert.type === 'warning' ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' :
      'bg-blue-500/20 border-blue-500/30 text-blue-400'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-start gap-2">
        <span class="text-lg">${alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <div>
          <p class="font-medium text-sm">${alert.title}</p>
          <p class="text-xs opacity-90">${alert.message}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 8 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 8000);
  }

  // ========================================
  // Historique des actions
  // ========================================
  initHistory() {
    // Load saved history from localStorage
    const savedHistory = localStorage.getItem('diris-history');
    if (savedHistory) {
      this.history = JSON.parse(savedHistory).map(item => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
      this.updateHistoryDisplay();
    }
  }

  addHistoryEvent(type, action, details = '') {
    const event = {
      id: `event-${Date.now()}`,
      type, // 'info', 'success', 'warning', 'error'
      action,
      details,
      timestamp: new Date()
    };

    this.history.unshift(event);
    
    // Keep only last 100 events
    this.history = this.history.slice(0, 100);
    
    // Save to localStorage
    localStorage.setItem('diris-history', JSON.stringify(this.history));
    
    // Update display
    this.updateHistoryDisplay();
  }

  updateHistoryDisplay() {
    const container = document.getElementById('dirisHistoryList');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucun événement enregistré</p>';
      return;
    }

    container.innerHTML = this.history.map(event => `
      <div class="p-3 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-1 rounded ${
              event.type === 'error' ? 'bg-red-500/20 text-red-400' :
              event.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
              event.type === 'success' ? 'bg-green-500/20 text-green-400' :
              'bg-blue-500/20 text-blue-400'
            }">
              ${event.type === 'error' ? '❌' : 
                event.type === 'warning' ? '⚠️' : 
                event.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span class="text-sm font-medium">${event.action}</span>
          </div>
          <span class="text-xs text-slate-400">${event.timestamp.toLocaleString('fr-FR')}</span>
        </div>
        ${event.details ? `<p class="text-xs text-slate-300">${event.details}</p>` : ''}
      </div>
    `).join('');
  }

  clearHistory() {
    if (confirm('Vider tout l\'historique des actions DIRIS ?')) {
      this.history = [];
      localStorage.removeItem('diris-history');
      this.updateHistoryDisplay();
      this.showSuccess('Historique vidé');
    }
  }

  exportHistory() {
    try {
      const csvContent = this.generateHistoryCsv();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diris-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showSuccess('✅ Historique exporté en CSV');
    } catch (error) {
      console.error('Erreur export historique:', error);
      this.showError('Erreur lors de l\'export de l\'historique');
    }
  }

  generateHistoryCsv() {
    let csv = 'Timestamp,Type,Action,Détails\n';
    this.history.forEach(event => {
      csv += `${event.timestamp.toLocaleString('fr-FR')},${event.type},${event.action},"${event.details}"\n`;
    });
    return csv;
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

