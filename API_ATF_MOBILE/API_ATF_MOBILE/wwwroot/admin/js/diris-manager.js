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
    
    // Configuration validation
    document.getElementById('configParallelism')?.addEventListener('input', (e) => this.validateConfigField('parallelism', e.target.value));
    document.getElementById('configPollInterval')?.addEventListener('input', (e) => this.validateConfigField('pollInterval', e.target.value));
    document.getElementById('configMaxBatch')?.addEventListener('input', (e) => this.validateConfigField('maxBatch', e.target.value));
    document.getElementById('configRetentionDays')?.addEventListener('input', (e) => this.validateConfigField('retentionDays', e.target.value));
    document.getElementById('configCleanupHour')?.addEventListener('input', (e) => this.validateConfigField('cleanupHour', e.target.value));
    
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
      this.showInfo(`${enable ? 'Activation' : 'Désactivation'} du device ${deviceId}...`);
      
      // This would need a backend endpoint like PUT /api/diris/devices/{id}/toggle
      // For now, simulate the action
      const action = enable ? 'activer' : 'désactiver';
      this.showSuccess(`⚠️ Fonctionnalité en cours de développement. Utilisez l'API pour ${action} le device ${deviceId}.`);
      
      // Reload devices after toggle
      setTimeout(() => this.loadDevices(), 1000);
    } catch (error) {
      console.error('Erreur toggle device:', error);
      this.showError(`Erreur lors de la ${enable ? 'activation' : 'désactivation'} du device ${deviceId}`);
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
      
      // This would need a backend endpoint
      // For now, just show success message
      this.showSuccess('⚠️ Fonctionnalité en cours de développement. Ajoutez le device via l\'API ou la base de données.');
      
      // Reload devices list
      setTimeout(() => this.loadDevices(), 1000);
      
    } catch (error) {
      console.error('Erreur ajout device:', error);
      this.showError('Erreur lors de l\'ajout du device');
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
        // Rafraîchir les métriques pour voir le changement
        await this.loadMetrics();
      } else {
        this.showError(`❌ Erreur: ${result.message || 'Impossible de démarrer l\'acquisition'}`);
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
        // Rafraîchir les métriques pour voir le changement
        await this.loadMetrics();
      } else {
        this.showError(`❌ Erreur: ${result.message || 'Impossible d\'arrêter l\'acquisition'}`);
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

