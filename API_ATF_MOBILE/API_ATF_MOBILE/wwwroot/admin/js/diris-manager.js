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
    document.getElementById('configRequestTimeout')?.addEventListener('input', (e) => this.validateConfigField('requestTimeout', e.target.value));
    document.getElementById('configMaxErrors')?.addEventListener('input', (e) => this.validateConfigField('maxErrors', e.target.value));
    document.getElementById('configRetentionDays')?.addEventListener('input', (e) => this.validateConfigField('retentionDays', e.target.value));
    document.getElementById('configCleanupHour')?.addEventListener('input', (e) => this.validateConfigField('cleanupHour', e.target.value));
    document.getElementById('configMaxDatabaseSize')?.addEventListener('input', (e) => this.validateConfigField('maxDatabaseSize', e.target.value));
    
    // Devices
    document.getElementById('btnAddDevice')?.addEventListener('click', () => this.showAddDeviceDialog());
    document.getElementById('btnConfigurePresets')?.addEventListener('click', () => this.showPresetConfigurationModal());
    
    // Charts controls
    document.getElementById('btnPauseCharts')?.addEventListener('click', () => this.toggleChartsPause());
    document.getElementById('btnResetCharts')?.addEventListener('click', () => this.resetCharts());
    
    // Alerts controls
    document.getElementById('dirisAlertsEnabled')?.addEventListener('change', (e) => this.toggleAlerts(e.target.checked));
    document.getElementById('alertMaxLatency')?.addEventListener('input', (e) => this.updateAlertThreshold('maxLatency', e.target.value));
    document.getElementById('alertMinThroughput')?.addEventListener('input', (e) => this.updateAlertThreshold('minThroughput', e.target.value));
    document.getElementById('alertMinDevices')?.addEventListener('input', (e) => this.updateAlertThreshold('minDevices', e.target.value));
    
    // Coherence stats
    document.getElementById('btnRefreshCoherence')?.addEventListener('click', () => this.loadCoherenceStats());
    document.getElementById('btnResetCoherence')?.addEventListener('click', () => this.resetCoherence());
    document.getElementById('btnClearCoherenceData')?.addEventListener('click', () => this.clearCoherenceData());
    document.getElementById('btnClearGaps')?.addEventListener('click', () => this.clearGaps());
    
    // Alerts
    document.getElementById('btnClearAlerts')?.addEventListener('click', () => this.clearAlerts());
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
        this.loadLatestReadings(),
        this.loadCoherenceStats()
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
        
        // Format database size with ratio
        const currentSizeMB = data.currentSizeMB || 0;
        const maxSizeMB = data.maxDatabaseSizeMB || 1024;
        const maxSizeGB = (maxSizeMB / 1024).toFixed(maxSizeMB >= 1024 ? 1 : 0);
        const maxSizeDisplay = maxSizeMB >= 1024 ? `${maxSizeGB} GB` : `${maxSizeMB} MB`;
        
        document.getElementById('dirisDatabaseSize').textContent = 
          `${currentSizeMB.toFixed(2)} MB / ${maxSizeDisplay}`;
        
        // Update percentage with color coding and status badge
        const percentage = data.percentageUsed || 0;
        const percentageElement = document.getElementById('dirisDatabasePercentage');
        
        let statusBadge = '';
        let statusClass = '';
        
        if (percentage >= 98) {
          statusClass = 'text-red-400 font-semibold';
          statusBadge = ' 🛑 CRITIQUE';
          percentageElement.textContent = `${percentage.toFixed(1)}%${statusBadge}`;
        } else if (percentage >= 95) {
          statusClass = 'text-red-400 font-semibold';
          statusBadge = ' 🧹 Auto-nettoyage';
          percentageElement.textContent = `${percentage.toFixed(1)}%${statusBadge}`;
        } else if (percentage >= 90) {
          statusClass = 'text-orange-400 font-semibold';
          statusBadge = ' ⚠️ Alerte';
          percentageElement.textContent = `${percentage.toFixed(1)}%${statusBadge}`;
        } else if (percentage >= 75) {
          statusClass = 'text-orange-400 font-semibold';
          statusBadge = ' ⚠️';
          percentageElement.textContent = `${percentage.toFixed(1)}%${statusBadge}`;
        } else if (percentage >= 50) {
          statusClass = 'text-yellow-400';
          percentageElement.textContent = `${percentage.toFixed(1)}%`;
        } else {
          statusClass = 'text-green-400';
          percentageElement.textContent = `${percentage.toFixed(1)}%`;
        }
        
        percentageElement.className = statusClass;
        
        // Convertir les timestamps UTC en heure locale
        document.getElementById('dirisOldestMeasurement').textContent = 
          data.oldestMeasurement ? new Date(data.oldestMeasurement + 'Z').toLocaleString('fr-FR') : '-';
        document.getElementById('dirisNewestMeasurement').textContent = 
          data.newestMeasurement ? new Date(data.newestMeasurement + 'Z').toLocaleString('fr-FR') : '-';
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
          document.getElementById('configRequestTimeout').value = config.acquisition.requestTimeoutMs || 2000;
          document.getElementById('configMaxErrors').value = config.acquisition.maxConsecutiveErrors || 5;
        }
        
        if (config.dataRetention) {
          document.getElementById('configRetentionDays').value = config.dataRetention.retentionDays || 10;
          document.getElementById('configCleanupHour').value = config.dataRetention.cleanupHour || 2;
          document.getElementById('configMaxDatabaseSize').value = config.dataRetention.maxDatabaseSizeMB || 1024;
          document.getElementById('configRetentionEnabled').checked = config.dataRetention.enabled !== false;
        }
      }
    } catch (error) {
      console.error('Erreur chargement configuration:', error);
      // Set default values
      document.getElementById('configParallelism').value = 6;
      document.getElementById('configPollInterval').value = 1500;
      document.getElementById('configRequestTimeout').value = 2000;
      document.getElementById('configMaxErrors').value = 5;
      document.getElementById('configRetentionDays').value = 10;
      document.getElementById('configCleanupHour').value = 2;
      document.getElementById('configMaxDatabaseSize').value = 1024;
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
      case 'requestTimeout':
        if (numValue < 500 || numValue > 15000) {
          isValid = false;
          message = 'Timeout doit être entre 500ms et 15000ms';
        }
        break;
      case 'maxErrors':
        if (numValue < 1 || numValue > 50) {
          isValid = false;
          message = 'Erreurs max. doit être entre 1 et 50';
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
      case 'maxDatabaseSize':
        if (numValue < 100 || numValue > 10240) {
          isValid = false;
          message = 'Taille max BDD doit être entre 100 MB et 10240 MB (10 GB)';
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
      const fields = ['parallelism', 'pollInterval', 'requestTimeout', 'maxErrors', 'retentionDays', 'cleanupHour', 'maxDatabaseSize'];
      const allValid = fields.every(field => {
        let elementId = `config${field.charAt(0).toUpperCase() + field.slice(1)}`;
        if (field === 'maxErrors') elementId = 'configMaxErrors';
        if (field === 'requestTimeout') elementId = 'configRequestTimeout';
        
        const value = document.getElementById(elementId).value;
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
          requestTimeoutMs: parseInt(document.getElementById('configRequestTimeout').value),
          maxConsecutiveErrors: parseInt(document.getElementById('configMaxErrors').value)
        },
        dataRetention: {
          enabled: document.getElementById('configRetentionEnabled').checked,
          retentionDays: parseInt(document.getElementById('configRetentionDays').value),
          cleanupHour: parseInt(document.getElementById('configCleanupHour').value),
          maxDatabaseSizeMB: parseInt(document.getElementById('configMaxDatabaseSize').value)
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
        <div class="p-3 bg-white/5 rounded-lg border border-white/10">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <div class="status-dot ${device.enabled ? 'online' : 'offline'}"></div>
              <div>
                <p class="font-medium text-sm">${this.escapeHtml(device.name || `Device ${device.deviceId}`)}</p>
                <p class="text-xs text-slate-400">${this.escapeHtml(device.ipAddress || 'N/A')}</p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-right">
                  <p class="text-sm font-medium">${device.activeSignalCount} / ${device.totalSignalCount}</p>
                  <p class="text-xs text-slate-400">Signaux activés</p>
              </div>
              <div class="flex gap-2">
                <button onclick="window.dirisManager.testDevice(${device.deviceId})" 
                        class="px-2 py-1 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors" title="Tester la connexion">
                  🔍 Test
                </button>
                <button onclick="window.dirisManager.manageSignals(${device.deviceId})" 
                        class="px-2 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 transition-colors" title="Gérer les signaux (activer/désactiver)">
                  🏷️ Signaux
                </button>
                <button onclick="window.dirisManager.toggleDevice(${device.deviceId}, ${!device.enabled})" 
                        class="px-2 py-1 text-xs rounded ${device.enabled ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'} hover:opacity-80 transition-colors">
                  ${device.enabled ? '⏸️ Désactiver' : '▶️ Activer'}
                </button>
              </div>
            </div>
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
        const durationMs = result.pollDuration ? Math.round(result.pollDuration * 1000) : 
                          result.PollDuration ? Math.round(result.PollDuration.TotalMilliseconds) : 0;
        this.showSuccess(`✅ Device ${deviceId}: ${result.measurements?.length || 0} mesures lues en ${durationMs}ms`);
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

  async discoverTags(deviceId) {
    try {
      this.showInfo(`🔍 Découverte et création automatique de tous les signaux DIRIS pour device ${deviceId}...`);
      
      const response = await this.apiClient.request(`/api/diris/devices/${deviceId}/discover-tags`, {
        method: 'POST'
      });
      
      if (response.success) {
        const tagCount = response.tagMappings?.length || 0;
        this.showSuccess(`✅ ${tagCount} signaux DIRIS créés automatiquement pour device ${deviceId} (courants, tensions, puissances, THD, énergies)`);
        this.addHistoryEvent('success', 'TagMaps créés', `${tagCount} signaux DIRIS configurés pour device ${deviceId}`);
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible de découvrir les tags'}`);
        this.addHistoryEvent('error', 'Échec découverte tags', response.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur découverte tags:', error);
      this.showError(`Erreur lors de la découverte des tags pour device ${deviceId}`);
      this.addHistoryEvent('error', 'Erreur découverte tags', error.message);
    }
  }

  async manageSignals(deviceId) {
    try {
      // Récupérer les informations du device
      const device = await this.apiClient.request(`/api/diris/devices/${deviceId}`);
      if (!device) {
        this.showError(`Device ${deviceId} introuvable`);
        return;
      }

      // Récupérer les tagmaps avec les fréquences
      const tagMappings = await this.apiClient.getDirisTagMappings(deviceId);
      
      // Récupérer les fréquences depuis l'API
      const frequencies = await this.apiClient.request(`/api/diris/signals/frequency/device/${deviceId}`);
      
      // Fusionner les données
      const enrichedTagMappings = (tagMappings || []).map(tag => {
        const frequencyData = frequencies?.frequencies?.find(f => f.signal === tag.signal);
        const finalFrequency = frequencyData?.recordingFrequencyMs || this.getDefaultFrequencyForSignal(tag.signal);
        
        
        return {
          ...tag,
          recordingFrequencyMs: finalFrequency
        };
      });
      
      this.showSignalManagementModal(device, enrichedTagMappings);
    } catch (error) {
      console.error('Erreur gestion signaux:', error);
      this.showError(`Erreur lors de la récupération des signaux pour device ${deviceId}`);
    }
  }

  showSignalManagementModal(device, tagMappings) {
    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
    
    // Group signals by unit for better display
    const groupedSignals = (tagMappings || []).reduce((acc, tag) => {
      const unit = tag.unit || 'Autres';
      if (!acc[unit]) {
        acc[unit] = [];
      }
      acc[unit].push(tag);
      return acc;
    }, {});

    const unitOrder = ['V', 'A', 'Hz', 'kW', 'kVAR', 'kVA', '%', 'kWh'];
    const sortedUnits = Object.keys(groupedSignals).sort((a, b) => {
        const indexA = unitOrder.indexOf(a);
        const indexB = unitOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        if (a === 'Autres') return 1;
        if (b === 'Autres') return -1;
        return a.localeCompare(b);
    });

    let signalsHtml = '';
    for (const unit of sortedUnits) {
      const signalsInGroup = groupedSignals[unit];
      const activeSignalsInGroup = signalsInGroup.filter(s => s.enabled).length;

      signalsHtml += `
        <tbody class="collapsible-group border-b-8 border-slate-800">
          <tr class="collapsible-header bg-white/10 cursor-pointer hover:bg-white/20 transition-colors">
            <td colspan="6" class="px-3 py-3 text-sm font-semibold text-white">
              <div class="flex justify-between items-center">
                <span>${this.getUnitDescription(unit)}</span>
                <span class="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
                  ${activeSignalsInGroup} / ${signalsInGroup.length} activés
                </span>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody class="collapsible-content hidden">
      `;
      signalsHtml += signalsInGroup.map(tag => `
        <tr class="border-b border-white/5 hover:bg-white/5">
          <td class="px-3 py-2 font-mono text-xs">${this.escapeHtml(tag.signal)}</td>
          <td class="px-3 py-2">${this.escapeHtml(tag.description || 'N/A')}</td>
          <td class="px-3 py-2">${this.escapeHtml(tag.unit || '')}</td>
          <td class="px-3 py-2">${tag.scale}</td>
          <td class="px-3 py-2 text-center">
            <select class="signal-frequency w-full px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white" data-signal="${this.escapeHtml(tag.signal)}">
              <option value="1000" ${tag.recordingFrequencyMs === 1000 ? 'selected' : ''}>1 seconde</option>
              <option value="2000" ${tag.recordingFrequencyMs === 2000 ? 'selected' : ''}>2 secondes</option>
              <option value="5000" ${tag.recordingFrequencyMs === 5000 ? 'selected' : ''}>5 secondes</option>
              <option value="10000" ${tag.recordingFrequencyMs === 10000 ? 'selected' : ''}>10 secondes</option>
              <option value="30000" ${tag.recordingFrequencyMs === 30000 ? 'selected' : ''}>30 secondes</option>
              <option value="60000" ${tag.recordingFrequencyMs === 60000 ? 'selected' : ''}>1 minute</option>
              <option value="300000" ${tag.recordingFrequencyMs === 300000 ? 'selected' : ''}>5 minutes</option>
              <option value="600000" ${tag.recordingFrequencyMs === 600000 ? 'selected' : ''}>10 minutes</option>
            </select>
          </td>
          <td class="px-3 py-2 text-center">
            <input type="checkbox" class="signal-enabled" data-signal="${this.escapeHtml(tag.signal)}" ${tag.enabled ? 'checked' : ''}>
          </td>
        </tr>
      `).join('');
      signalsHtml += `</tbody>`;
    }

    modal.innerHTML = `
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] border border-white/10 overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">Gestion des signaux - ${this.escapeHtml(device.name)}</h3>
            <p class="text-sm text-slate-400">${this.escapeHtml(device.ipAddress)} • ${tagMappings.length} signaux configurés</p>
          </div>
          <button class="close-modal text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        
        <div class="flex gap-4 mb-4">
          <button id="btnSelectAll" class="px-3 py-2 text-sm rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors">
            ✅ Tout sélectionner
          </button>
          <button id="btnDeselectAll" class="px-3 py-2 text-sm rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 transition-colors">
            ❌ Tout désélectionner
          </button>
          <button id="btnApplyPresets" class="px-3 py-2 text-sm rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 transition-colors">
            🎯 Appliquer presets
          </button>
        </div>
        
        <div class="overflow-y-auto max-h-[60vh] border border-white/10 rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-white/5 sticky top-0 z-10">
              <tr>
                <th class="px-3 py-2 text-left">Signal</th>
                <th class="px-3 py-2 text-left">Description</th>
                <th class="px-3 py-2 text-left">Unité</th>
                <th class="px-3 py-2 text-left">Échelle</th>
                <th class="px-3 py-2 text-center">Fréquence</th>
                <th class="px-3 py-2 text-center">Activé</th>
              </tr>
            </thead>
            <tbody id="signalsTableBody">
              ${signalsHtml}
            </tbody>
          </table>
        </div>
        
        <div class="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
          <div class="text-sm text-slate-400">
            <span id="enabledCount">${tagMappings.filter(t => t.enabled).length}</span> / ${tagMappings.length} signaux activés
          </div>
          <div class="flex gap-2">
            <button id="btnSaveSignals" class="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm transition-colors">
              💾 Sauvegarder
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Collapsible sections
    modal.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.closest('.collapsible-group').nextElementSibling;
        content.classList.toggle('hidden');
      });
    });
    
    // Gestion des boutons
    modal.querySelector('#btnSelectAll').addEventListener('click', () => {
      modal.querySelectorAll('.signal-enabled').forEach(cb => cb.checked = true);
      this.updateEnabledCount(modal);
    });
    
    modal.querySelector('#btnDeselectAll').addEventListener('click', () => {
      modal.querySelectorAll('.signal-enabled').forEach(cb => cb.checked = false);
      this.updateEnabledCount(modal);
    });
    
    modal.querySelector('#btnSaveSignals').addEventListener('click', () => {
      this.saveSignalSettings(device.deviceId, modal);
    });
    
    modal.querySelector('#btnApplyPresets').addEventListener('click', () => {
      this.applyFrequencyPresets(device.deviceId, modal);
    });
    
    // Mise à jour du compteur
    modal.querySelectorAll('.signal-enabled').forEach(cb => {
      cb.addEventListener('change', () => this.updateEnabledCount(modal));
    });
    
    this.updateEnabledCount(modal);
  }

  updateEnabledCount(modal) {
    const enabledCount = modal.querySelectorAll('.signal-enabled:checked').length;
    const totalCount = modal.querySelectorAll('.signal-enabled').length;
    modal.querySelector('#enabledCount').textContent = enabledCount;
  }

  async saveSignalSettings(deviceId, modal) {
    try {
      const enabledSignals = Array.from(modal.querySelectorAll('.signal-enabled:checked'))
        .map(cb => cb.dataset.signal);
      
      // Récupérer aussi les fréquences pour les sauvegarder
      const frequencies = Array.from(modal.querySelectorAll('.signal-frequency'))
        .map(select => ({
          signal: select.dataset.signal,
          recordingFrequencyMs: parseInt(select.value)
        }));
      
      this.showInfo('💾 Sauvegarde des paramètres des signaux et fréquences...');
      
      // Sauvegarder les signaux activés/désactivés
      const response1 = await this.apiClient.updateDirisTagMappingsEnabled(deviceId, enabledSignals);
      
      // Sauvegarder les fréquences
      const response2 = await this.apiClient.request(`/api/diris/signals/frequency/device/${deviceId}/bulk`, {
        method: 'PUT',
        body: JSON.stringify({ frequencies })
      });
      
      if (response1.success && response2.success) {
        this.showSuccess(`✅ Paramètres sauvegardés: ${enabledSignals.length} signaux activés, ${frequencies.length} fréquences mises à jour`);
        this.addHistoryEvent('success', 'Signaux mis à jour', `${enabledSignals.length} signaux activés, ${frequencies.length} fréquences pour device ${deviceId}`);
        modal.remove();
      } else {
        this.showError(`❌ Erreur: ${response1.message || response2.message || 'Impossible de sauvegarder les paramètres'}`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde signaux:', error);
      this.showError('Erreur lors de la sauvegarde des paramètres des signaux');
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
        this.showSuccess(`✅ Device ajouté avec succès (ID: ${response.deviceId}). 81 signaux DIRIS créés automatiquement !`);
        this.addHistoryEvent('success', 'Device ajouté', `Device ${deviceData.name} ajouté avec auto-création de 81 signaux complets (courants, tensions, puissances, THD, énergies)`);
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
      console.log('📊 Initialisation des graphiques DIRIS...');
      
      // Détruire les anciens graphiques s'ils existent
      Object.values(this.charts).forEach(chart => {
        if (chart) {
          chart.destroy();
        }
      });
      this.charts = {};
      
      // Throughput Chart
      const throughputCtx = document.getElementById('dirisThroughputChart');
      if (throughputCtx) {
        console.log('✅ Canvas dirisThroughputChart trouvé');
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
      } else {
        console.warn('❌ Canvas dirisThroughputChart non trouvé');
      }

      // Latency Chart
      const latencyCtx = document.getElementById('dirisLatencyChart');
      if (latencyCtx) {
        console.log('✅ Canvas dirisLatencyChart trouvé');
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
      } else {
        console.warn('❌ Canvas dirisLatencyChart non trouvé');
      }

      // Devices Chart
      const devicesCtx = document.getElementById('dirisDevicesChart');
      if (devicesCtx) {
        console.log('✅ Canvas dirisDevicesChart trouvé');
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
      } else {
        console.warn('❌ Canvas dirisDevicesChart non trouvé');
      }
      
      console.log('📊 Graphiques initialisés:', Object.keys(this.charts));
    } catch (error) {
      console.error('❌ Erreur initialisation graphiques:', error);
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
          <span class="text-xs text-slate-400">${new Date(alert.timestamp).toLocaleTimeString('fr-FR')}</span>
        </div>
        <p class="text-xs text-slate-300">${alert.message}</p>
      </div>
    `).join('');
  }

  showAlertNotification(alert) {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 left-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 max-w-sm backdrop-blur-sm ${
      alert.type === 'error' ? 'bg-red-500/90 border-red-500/50 text-red-100' :
      alert.type === 'warning' ? 'bg-orange-500/90 border-orange-500/50 text-orange-100' :
      'bg-blue-500/90 border-blue-500/50 text-blue-100'
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
          <span class="text-xs text-slate-400">${new Date(event.timestamp).toLocaleString('fr-FR')}</span>
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
      csv += `${new Date(event.timestamp).toLocaleString('fr-FR')},${event.type},${event.action},"${event.details}"\n`;
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

  getDefaultFrequencyForSignal(signal) {
    if (signal.startsWith('I_') || signal.startsWith('PV') || signal.startsWith('LV_') || signal === 'F_255') {
      return 1000; // 1s - Critiques
    } else if (signal.includes('RP') || signal.includes('IP') || signal.includes('AP')) {
      return 2000; // 2s - Puissances
    } else if (signal.startsWith('THD_')) {
      return 5000; // 5s - THD
    } else if (signal.startsWith('E') && signal.endsWith('_255')) {
      return 30000; // 30s - Énergies
    } else if (signal.startsWith('AVG_') || signal.startsWith('MAXAVG')) {
      return 10000; // 10s - Moyennes/Max
    } else {
      return 5000; // 5s - Par défaut
    }
  }


  async applyFrequencyPresets(deviceId, modal) {
    try {
      this.showInfo('🎯 Application des presets de fréquence...');
      
      const response = await this.apiClient.request(`/api/diris/signals/frequency/device/${deviceId}/apply-presets`, {
        method: 'POST'
      });
      
      if (response.success) {
        this.showSuccess(`✅ Presets appliqués à ${response.updatedCount} signaux`);
        this.addHistoryEvent('success', 'Presets appliqués', `${response.updatedCount} presets appliqués pour device ${deviceId}`);
        
        // Recharger la modal pour voir les nouvelles fréquences
        modal.remove();
        setTimeout(() => {
          this.manageSignals(deviceId);
        }, 100);
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible d\'appliquer les presets'}`);
      }
    } catch (error) {
      console.error('Erreur application presets:', error);
      this.showError('Erreur lors de l\'application des presets');
    }
  }

  showPresetConfigurationModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4';
    
    modal.innerHTML = `
      <div class="bg-slate-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">⚙️ Configuration du Preset Universel</h3>
            <button id="btnClosePresetConfig" class="text-slate-400 hover:text-white">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div class="mb-4 flex justify-between items-center">
            <div class="text-sm text-slate-400">
              Configuration des fréquences pour tous les signaux du preset universel
            </div>
            <div class="text-sm text-slate-400">
              <span id="totalSignals">0</span> signaux au total
            </div>
          </div>
          
          <div class="bg-slate-700 rounded-lg overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-600">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Signal</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Description</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Unité</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Fréquence</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">Activé par défaut</th>
                </tr>
              </thead>
              <tbody id="presetSignalsTableBody" class="divide-y divide-slate-600">
                <!-- Les signaux seront chargés ici -->
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="bg-slate-700 px-6 py-4 border-t border-slate-600 flex justify-end">
          <div class="flex space-x-3">
            <button id="btnCancelPresetConfig" class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors">
              Annuler
            </button>
            <button id="btnSavePresetConfig" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
              💾 Sauvegarder Configuration
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#btnClosePresetConfig').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnCancelPresetConfig').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnSavePresetConfig').addEventListener('click', () => {
      this.savePresetConfiguration(modal);
    });

    // Charger les signaux d'un device de référence (le premier device disponible)
    this.loadCurrentSignalsForPresets(modal);
  }

  loadCurrentSignalsForPresets(modal) {
    // Charger les signaux du premier device disponible comme modèle de preset universel
    this.apiClient.request('/api/diris/devices')
      .then(devicesResponse => {
        // Vérifier la structure de la réponse
        let devices = [];
        if (Array.isArray(devicesResponse)) {
          devices = devicesResponse;
        } else if (devicesResponse.value && Array.isArray(devicesResponse.value)) {
          devices = devicesResponse.value;
        }
        
        if (devices.length > 0) {
          // Utiliser le premier device comme modèle
          const firstDevice = devices[0];
          const deviceId = firstDevice.deviceId;
          
          return this.apiClient.request(`/api/diris/signals/frequency/device/${deviceId}`);
        } else {
          throw new Error('Aucun device trouvé');
        }
      })
      .then(response => {
        if (response.success && response.frequencies) {
          const signals = response.frequencies.map(freq => ({
            ...freq,
            deviceId: 'preset' // Marquer comme preset universel
          }));
          this.renderPresetSignalsTable(modal, signals);
        } else {
          this.renderPresetSignalsTable(modal, []);
        }
      })
      .catch(error => {
        console.error('Erreur chargement signaux:', error);
        this.showError('Erreur lors du chargement des signaux');
      });
  }

  renderPresetSignalsTable(modal, signals) {
    const tbody = modal.querySelector('#presetSignalsTableBody');
    const totalCount = modal.querySelector('#totalSignals');
    
    totalCount.textContent = signals.length;

    // Group signals by unit
    const groupedSignals = (signals || []).reduce((acc, tag) => {
      const unit = tag.unit || 'Autres';
      if (!acc[unit]) {
        acc[unit] = [];
      }
      acc[unit].push(tag);
      return acc;
    }, {});

    const unitOrder = ['V', 'A', 'Hz', 'kW', 'kVAR', 'kVA', '%', 'kWh'];
    const sortedUnits = Object.keys(groupedSignals).sort((a, b) => {
        const indexA = unitOrder.indexOf(a);
        const indexB = unitOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        if (a === 'Autres') return 1;
        if (b === 'Autres') return -1;
        return a.localeCompare(b);
    });

    let signalsHtml = '';
    for (const unit of sortedUnits) {
      signalsHtml += `
        <tr class="bg-slate-600/50 sticky top-0">
          <td colspan="5" class="px-3 py-2 text-sm font-semibold text-white">${this.getUnitDescription(unit)}</td>
        </tr>
      `;
      signalsHtml += groupedSignals[unit].map(signal => `
        <tr class="hover:bg-slate-600/50">
          <td class="px-4 py-3 text-sm text-white font-mono">${signal.signal}</td>
          <td class="px-4 py-3 text-sm text-slate-300">${signal.description || '-'}</td>
          <td class="px-4 py-3 text-sm text-slate-400">${signal.unit || '-'}</td>
          <td class="px-4 py-3">
            <select class="signal-frequency-select px-2 py-1 bg-slate-700 border border-slate-500 rounded text-white text-sm" data-signal="${signal.signal}">
              <option value="1000" ${signal.recordingFrequencyMs === 1000 ? 'selected' : ''}>1 seconde</option>
              <option value="2000" ${signal.recordingFrequencyMs === 2000 ? 'selected' : ''}>2 secondes</option>
              <option value="5000" ${signal.recordingFrequencyMs === 5000 ? 'selected' : ''}>5 secondes</option>
              <option value="10000" ${signal.recordingFrequencyMs === 10000 ? 'selected' : ''}>10 secondes</option>
              <option value="30000" ${signal.recordingFrequencyMs === 30000 ? 'selected' : ''}>30 secondes</option>
              <option value="60000" ${signal.recordingFrequencyMs === 60000 ? 'selected' : ''}>1 minute</option>
              <option value="300000" ${signal.recordingFrequencyMs === 300000 ? 'selected' : ''}>5 minutes</option>
              <option value="600000" ${signal.recordingFrequencyMs === 600000 ? 'selected' : ''}>10 minutes</option>
            </select>
          </td>
          <td class="px-4 py-3 text-center">
            <input type="checkbox" class="signal-enabled-preset" data-signal="${signal.signal}" ${signal.enabled ? 'checked' : ''}>
          </td>
        </tr>
      `).join('');
    }
    
    tbody.innerHTML = signalsHtml;
  }

  loadCurrentPresets(modal) {
    // Charger les presets actuels depuis l'API
    this.apiClient.request('/api/diris/signals/frequency/presets')
      .then(response => {
        if (response.success && response.currentPresets) {
          const presets = response.currentPresets;
          modal.querySelector('#presetCurrents').value = presets.currents || 1000;
          modal.querySelector('#presetVoltages').value = presets.voltages || 1000;
          modal.querySelector('#presetPowers').value = presets.powers || 2000;
          modal.querySelector('#presetThd').value = presets.thd || 5000;
          modal.querySelector('#presetEnergies').value = presets.energies || 30000;
          modal.querySelector('#presetAverages').value = presets.averages || 10000;
        }
      })
      .catch(error => {
        console.error('Erreur chargement presets:', error);
      });
  }

  async savePresetConfiguration(modal) {
    try {
      // Collecter tous les signaux avec leurs nouvelles fréquences et leur statut
      const allSignals = [];
      modal.querySelectorAll('.signal-frequency-select').forEach(select => {
        const signal = select.dataset.signal;
        const enabledCheckbox = modal.querySelector(`.signal-enabled-preset[data-signal="${signal}"]`);
        allSignals.push({
          signal: signal,
          recordingFrequencyMs: parseInt(select.value),
          enabled: enabledCheckbox ? enabledCheckbox.checked : true
        });
      });

      if (allSignals.length === 0) {
        this.showWarning('⚠️ Aucun signal trouvé à configurer');
        return;
      }

      this.showInfo(`💾 Configuration des presets basée sur ${allSignals.length} signaux...`);
      
      // Sauvegarder les presets basés sur tous les signaux
      const presets = this.generatePresetsFromSignals(allSignals);
      
      const response = await this.apiClient.request('/api/diris/signals/frequency/presets', {
        method: 'POST',
        body: JSON.stringify(presets)
      });
      
      if (response.success) {
        this.showSuccess(`✅ Preset universel sauvegardé (${allSignals.length} signaux configurés)`);
        this.addHistoryEvent('success', 'Preset universel configuré', `${allSignals.length} signaux configurés pour tous les devices`);
        modal.remove();
      } else {
        this.showError(`❌ Erreur lors de la sauvegarde du preset: ${response.message}`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde presets:', error);
      this.showError('Erreur lors de la sauvegarde de la configuration');
    }
  }

  generatePresetsFromSignals(selectedSignals) {
    // This function will now need to return both frequency and enabled status presets
    const presets = {};

    selectedSignals.forEach(signalData => {
      presets[signalData.signal] = {
        recordingFrequencyMs: signalData.recordingFrequencyMs,
        enabled: signalData.enabled
      };
    });

    return { signals: presets };
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showWarning(message) {
    this.showNotification(message, 'warning');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 backdrop-blur-sm ${
      type === 'success' ? 'bg-green-500/90 border-green-500/50 text-green-100' :
      type === 'error' ? 'bg-red-500/90 border-red-500/50 text-red-100' :
      'bg-blue-500/90 border-blue-500/50 text-blue-100'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  /**
   * Met à jour les descriptions de tous les signaux DIRIS
   */
  async updateDescriptions() {
    try {
      this.showInfo('📝 Mise à jour des descriptions des signaux...');
      
      const response = await this.apiClient.updateDirisTagMapDescriptions();
      
      if (response.success) {
        this.showSuccess(`✅ ${response.message}`);
        this.addHistoryEvent('success', 'Descriptions mises à jour', 
          `${response.totalUpdated} signaux mis à jour sur ${response.deviceCount} devices`);
        
        // Recharger la liste des devices pour voir les nouvelles descriptions
        await this.loadDevices();
      } else {
        this.showError(`❌ Erreur: ${response.message || 'Impossible de mettre à jour les descriptions'}`);
      }
    } catch (error) {
      console.error('Erreur mise à jour descriptions:', error);
      this.showError('Erreur lors de la mise à jour des descriptions');
    }
  }

  // ========================================
  // Statistiques de Cohérence
  // ========================================
  async loadCoherenceStats() {
    try {
      // Récupérer le point de départ stocké
      this.coherenceStartTime = localStorage.getItem('dirisCoherenceStartTime');
      
      const url = this.coherenceStartTime 
        ? `/api/diris/coherence?since=${encodeURIComponent(this.coherenceStartTime)}`
        : '/api/diris/coherence';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiClient.token}`
        }
      });
      
      if (!response.ok) throw new Error('Erreur réseau');
      
      const data = await response.json();
      this.displayCoherenceStats(data);
      
    } catch (error) {
      console.error('Erreur chargement statistiques cohérence:', error);
      this.showError('Erreur lors du chargement des statistiques de cohérence');
    }
  }

  displayCoherenceStats(data) {
    // Qualité des données
    if (data.quality && data.quality.perfectQuality) {
      document.getElementById('coherenceQuality').textContent = '100%';
      document.getElementById('coherenceQuality').className = 'text-2xl font-bold value-excellent';
    }

    // Fréquence d'acquisition
    if (data.frequency && data.frequency.length > 0) {
      const avgInterval = data.frequency.reduce((sum, d) => sum + d.avgMs, 0) / data.frequency.length;
      document.getElementById('coherenceFrequency').textContent = `${Math.round(avgInterval)}ms`;
      document.getElementById('coherenceFrequency').className = avgInterval >= 1400 && avgInterval <= 2000 ? 
        'text-2xl font-bold value-excellent' : 
        'text-2xl font-bold value-good';
    }

    // Régularité
    if (data.frequency && data.frequency.length > 0) {
      const avgStdDev = data.frequency.reduce((sum, d) => sum + (d.stdDevMs || 0), 0) / data.frequency.length;
      document.getElementById('coherenceRegularity').textContent = `±${Math.round(avgStdDev)}ms`;
      document.getElementById('coherenceRegularity').className = avgStdDev < 100 ? 
        'text-2xl font-bold value-excellent' : 
        avgStdDev < 200 ? 'text-2xl font-bold value-good' : 'text-2xl font-bold value-warning';
    }

    // Score de cohérence
    this.calculateAndDisplayCoherenceScore(data);

    // Statistiques par device
    this.displayDeviceStats(data.deviceStats);

    // Trous détectés
    this.displayGaps(data.gaps);
  }

  async calculateAndDisplayCoherenceScore(data) {
    try {
      const url = this.coherenceStartTime 
        ? `/api/diris/coherence/score?since=${encodeURIComponent(this.coherenceStartTime)}`
        : '/api/diris/coherence/score';
        
      console.log('🎯 [DEBUG] Calcul score cohérence:', {
        coherenceStartTime: this.coherenceStartTime,
        url: url,
        coherenceStartTimeDetails: this.coherenceStartTime ? new Date(this.coherenceStartTime).toLocaleString() : 'null'
      });
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiClient.token}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ [DEBUG] Erreur score cohérence:', response.status, response.statusText);
        throw new Error(`Erreur réseau: ${response.status}`);
      }
      
      const scoreData = await response.json();
      console.log('✅ [DEBUG] Score reçu:', {
        score: scoreData.score,
        details: scoreData.details,
        breakdown: scoreData.breakdown, // Ancien format
        fullData: scoreData
      });
      
      // Log détaillé du breakdown
      if (scoreData.details) {
        console.log('📊 [DEBUG] Breakdown détaillé:', {
          qualityScore: scoreData.details.qualityScore,
          regularityScore: scoreData.details.regularityScore,
          gapsScore: scoreData.details.gapsScore,
          total: scoreData.details.qualityScore + scoreData.details.regularityScore + scoreData.details.gapsScore
        });
      }
      
      document.getElementById('coherenceScore').textContent = `${scoreData.score}/100`;
      document.getElementById('coherenceScore').className = scoreData.score >= 90 ? 
        'text-2xl font-bold value-excellent' : 
        scoreData.score >= 75 ? 'text-2xl font-bold value-good' : 
        scoreData.score >= 50 ? 'text-2xl font-bold value-warning' : 'text-2xl font-bold value-danger';
      
    } catch (error) {
      console.error('Erreur calcul score:', error);
    }
  }

  displayDeviceStats(deviceStats) {
    const container = document.getElementById('coherenceDeviceStats');
    if (!container || !deviceStats) return;

    if (deviceStats.length === 0) {
      container.innerHTML = '<p class="text-center text-slate-400 py-4">Aucune donnée disponible</p>';
      return;
    }

    container.innerHTML = deviceStats.map(device => `
      <div class="p-3 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-center justify-between">
          <div class="flex-1 grid grid-cols-5 gap-4">
            <div>
              <p class="text-xs text-slate-400">Device</p>
              <p class="font-bold text-brand-400">${device.deviceId}</p>
              <p class="text-xs text-slate-500">${device.deviceName || 'Device ' + device.deviceId}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">Mesures</p>
              <p class="font-mono text-sm">${this.formatNumber(device.nbMeasures)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">Signaux</p>
              <p class="font-mono text-sm">${device.nbSignals}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">Débit</p>
              <p class="font-mono text-sm">${device.measuresPerSecond?.toFixed(2) || '0'} pts/s</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">Durée</p>
              <p class="font-mono text-sm">${Math.round(device.durationSeconds / 60)}min</p>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  displayGaps(gaps) {
    const container = document.getElementById('coherenceGaps');
    if (!container || !gaps) return;

    if (gaps.length === 0) {
      container.innerHTML = '<p class="text-center text-green-400 py-4">✅ Aucune interruption détectée</p>';
      return;
    }

    container.innerHTML = gaps.map(gap => {
      const severity = gap.gapSeconds > 60 ? 'danger' : gap.gapSeconds > 30 ? 'warning' : 'good';
      
      // Convertir UTC vers heure locale
      const prevDate = new Date(gap.prevTs + 'Z'); // Ajouter 'Z' pour forcer UTC
      const currentDate = new Date(gap.utcTs + 'Z'); // Ajouter 'Z' pour forcer UTC
      
      return `
      <div class="p-3 bg-white/5 rounded-lg border ${
        severity === 'danger' ? 'border-red-500/30' : 
        severity === 'warning' ? 'border-orange-500/30' : 'border-yellow-500/30'
      }">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Device ${gap.deviceId} - ${gap.deviceName || 'Device ' + gap.deviceId}</p>
            <p class="text-xs text-slate-400 font-mono">
              ${prevDate.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} → 
              ${currentDate.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <span class="px-3 py-1 rounded-lg text-sm font-bold ${
            severity === 'danger' ? 'bg-red-500/20 text-red-400' : 
            severity === 'warning' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
          }">
            ${gap.gapSeconds}s
          </span>
        </div>
      </div>
    `}).join('');
  }

  startCoherenceAutoRefresh() {
    // Refresh toutes les 10 secondes
    if (this.coherenceRefreshInterval) {
      clearInterval(this.coherenceRefreshInterval);
    }
    
    this.coherenceRefreshInterval = setInterval(() => {
      this.loadCoherenceStats();
    }, 10000);
  }

  stopCoherenceAutoRefresh() {
    if (this.coherenceRefreshInterval) {
      clearInterval(this.coherenceRefreshInterval);
      this.coherenceRefreshInterval = null;
    }
  }

  resetCoherence() {
    if (confirm('Réinitialiser le calcul de cohérence ?\n\n• Les statistiques seront recalculées depuis maintenant\n• L\'historique précédent sera ignoré\n• Nouveau point de départ pour le score')) {
      // Marquer le nouveau point de départ
      this.coherenceStartTime = new Date().toISOString();
      localStorage.setItem('dirisCoherenceStartTime', this.coherenceStartTime);
      
      // Réinitialiser les KPIs
      document.getElementById('coherenceQuality').textContent = '-%';
      document.getElementById('coherenceQuality').className = 'text-2xl font-bold text-slate-400';
      
      document.getElementById('coherenceFrequency').textContent = '-';
      document.getElementById('coherenceFrequency').className = 'text-2xl font-bold text-slate-400';
      
      document.getElementById('coherenceRegularity').textContent = '-';
      document.getElementById('coherenceRegularity').className = 'text-2xl font-bold text-slate-400';
      
      document.getElementById('coherenceScore').textContent = '-/100';
      document.getElementById('coherenceScore').className = 'text-2xl font-bold text-slate-400';
      
      // Vider les stats par device
      const deviceStatsContainer = document.getElementById('coherenceDeviceStats');
      if (deviceStatsContainer) {
        deviceStatsContainer.innerHTML = '<p class="text-center text-slate-400 py-4">Nouveau calcul depuis ' + new Date(this.coherenceStartTime).toLocaleTimeString() + '</p>';
      }
      
      // Vider les interruptions
      this.clearGaps();
      
      this.showSuccess('✅ Nouveau point de départ défini pour le calcul de cohérence');
      this.addHistoryEvent('info', 'Cohérence réinitialisée', 'Nouveau calcul depuis ' + new Date(this.coherenceStartTime).toLocaleString());
      
      // Recharger immédiatement avec le nouveau point de départ
      this.loadCoherenceStats();
    }
  }

  async clearCoherenceData() {
    if (confirm('⚠️ ATTENTION : Supprimer les données de cohérence de la base ?\n\n' +
                '• Cela va supprimer les mesures anciennes\n' +
                '• Seules les 5 dernières minutes seront conservées\n' +
                '• Le score de cohérence sera recalculé\n\n' +
                'Continuer ?')) {
      
      try {
        const response = await this.apiClient.request('/api/diris/coherence/clear-data?minutesToKeep=5', { method: 'POST' });
        
        if (response.success) {
          this.showSuccess(`✅ Données nettoyées : ${response.deletedRows} mesures supprimées`);
          this.addHistoryEvent('info', 'Données cohérence', `Nettoyage : ${response.deletedRows} mesures supprimées`);
          
          // Recharger les statistiques après nettoyage
          setTimeout(() => {
            this.loadCoherenceStats();
          }, 1000);
        } else {
          throw new Error('Réponse inattendue du serveur');
        }
      } catch (error) {
        console.error('Erreur nettoyage données:', error);
        this.showError('❌ Erreur lors du nettoyage des données');
      }
    }
  }

  clearGaps() {
    const container = document.getElementById('coherenceGaps');
    if (container) {
      container.innerHTML = '<p class="text-center text-green-400 py-4">✅ Affichage vidé (actualiser pour recharger)</p>';
    }
  }

  clearAlerts() {
    const container = document.getElementById('dirisAlertsList');
    if (container) {
      this.alerts = [];
      container.innerHTML = '<p class="text-center text-slate-400 py-4">Aucune alerte récente</p>';
      document.getElementById('dirisAlertsCount').textContent = '0';
      this.showSuccess('Alertes vidées');
    }
  }

  getUnitDescription(unit) {
    const descriptions = {
      'V': 'Tensions (V)',
      'A': 'Courants (A)',
      'Hz': 'Fréquence (Hz)',
      'kW': 'Puissances Actives (kW)',
      'kVAR': 'Puissances Réactives (kVAR)',
      'kVA': 'Puissances Apparentes (kVA)',
      '%': 'Facteurs de Puissance & THD (%)',
      'kWh': 'Énergies (kWh)',
      '': 'Autres'
    };
    return descriptions[unit] || `Autres (${unit})`;
  }
}

// Make it globally accessible for inline onclick handlers
window.dirisManager = null;

