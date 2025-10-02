/**
 * Service centralisé de gestion des logs - Event Viewer
 * Gestion du flux Play/Stop, ring buffer, filtrage, facettes
 */

import apiClient from './api-client.js';

class LogService {
    constructor() {
        // État du service
        this.isPlaying = false; // Par défaut: Stop actif
        this.logs = []; // Ring buffer en mémoire
        this.maxBufferSize = 10000; // Taille du buffer (configurable min 5000)
        this.displayedLogs = []; // Logs filtrés pour l'affichage
        
        // Filtres actifs
        this.activeFilters = {
            severity: [], // ['Information', 'Warning', 'Error']
            source: [], // ['API', 'System', 'PLC', ...]
            method: [], // ['GET', 'POST', ...]
            statusRange: null, // { min: 400, max: 599 }
            endpoint: [],
            hasError: null, // true/false/null
            searchText: '', // Recherche plein texte
            useRegex: false
        };
        
        // Facettes dynamiques (compteurs)
        this.facets = {
            severity: {},
            source: {},
            method: {},
            status: {},
            endpoint: {},
            hasError: { true: 0, false: 0 }
        };
        
        // Abonnés aux changements
        this.subscribers = [];
        
        // Polling interval (quand en mode Play)
        this.pollInterval = null;
        this.pollDelay = 2000; // 2 secondes
        
        // Dernière position de scroll (pour maintenir le scroll)
        this.userScrolledUp = false;
    }

    /**
     * Démarrer le flux live (mode Play)
     */
    start() {
        if (this.isPlaying) return;
        
        console.log('▶️ Démarrage du flux de logs');
        this.isPlaying = true;
        
        // Démarrer le polling
        this.pollInterval = setInterval(() => this.fetchNewLogs(), this.pollDelay);
        
        // Premier chargement immédiat
        this.fetchNewLogs();
        
        this.notifySubscribers({ type: 'stateChanged', isPlaying: true });
    }

    /**
     * Arrêter le flux live (mode Stop)
     */
    stop() {
        if (!this.isPlaying) return;
        
        console.log('⏸️ Arrêt du flux de logs');
        this.isPlaying = false;
        
        // Arrêter le polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        this.notifySubscribers({ type: 'stateChanged', isPlaying: false });
    }

    /**
     * Récupérer les nouveaux logs depuis l'API
     */
    async fetchNewLogs() {
        try {
            // Ne rien faire si pas en mode Play
            if (!this.isPlaying) {
                return;
            }
            
            // Récupérer les derniers logs
            const logs = await apiClient.getLogs(200);
            
            // Ajouter au buffer (avec déduplication par ID)
            const existingIds = new Set(this.logs.map(l => l.id));
            const newLogs = logs.filter(l => !existingIds.has(l.id));
            
            if (newLogs.length > 0) {
                // Normaliser les logs
                const normalizedLogs = newLogs.map(log => this.normalizeLog(log));
                
                // Ajouter au début (plus récents en premier)
                this.logs.unshift(...normalizedLogs);
                
                // Limiter la taille du buffer
                if (this.logs.length > this.maxBufferSize) {
                    this.logs = this.logs.slice(0, this.maxBufferSize);
                }
                
                // Recalculer les facettes
                this.updateFacets();
                
                // Appliquer les filtres
                this.applyFilters();
                
                // Notifier les abonnés
                this.notifySubscribers({ 
                    type: 'logsUpdated', 
                    newCount: newLogs.length,
                    totalCount: this.logs.length,
                    displayedCount: this.displayedLogs.length
                });
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des logs:', error);
        }
    }

    /**
     * Charger les logs initiaux (200 derniers)
     */
    async loadInitialLogs() {
        try {
            console.log('📥 Chargement des logs initiaux...');
            const logs = await apiClient.getLogs(200);
            
            // Normaliser les logs
            this.logs = logs.map(log => this.normalizeLog(log));
            
            // Trier par timestamp décroissant
            this.logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
            
            // Calculer les facettes
            this.updateFacets();
            
            // Appliquer les filtres (vides au départ)
            this.applyFilters();
            
            console.log(`✅ ${this.logs.length} logs chargés`);
            
            this.notifySubscribers({ 
                type: 'logsLoaded', 
                totalCount: this.logs.length,
                displayedCount: this.displayedLogs.length
            });
        } catch (error) {
            console.error('Erreur lors du chargement initial:', error);
        }
    }

    /**
     * Normaliser un log au format Event Viewer
     */
    normalizeLog(log) {
        // Mapper les niveaux C# vers format Event Viewer
        const severityMap = {
            'Information': 'info',
            'Warning': 'warn',
            'Error': 'error',
            'Critical': 'error'
        };
        
        return {
            id: log.id || this.generateId(),
            ts: log.timestamp,
            severity: severityMap[log.level] || 'info',
            source: log.source || 'API',
            message: log.message,
            http: log.httpDetails ? {
                method: log.httpDetails.method,
                url: log.httpDetails.url,
                status: log.httpDetails.statusCode,
                durationMs: log.httpDetails.durationMs
            } : null,
            meta: {
                endpoint: log.httpDetails?.endpoint || null,
                hasError: log.exception != null || (log.httpDetails?.statusCode >= 400)
            },
            details: {
                exception: log.exception,
                req: log.httpDetails?.requestBody,
                resp: log.httpDetails?.responseBody,
                headers: log.httpDetails?.headers,
                reqSize: log.httpDetails?.requestSize,
                respSize: log.httpDetails?.responseSize
            }
        };
    }

    /**
     * Générer un ID unique
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Appliquer les filtres actifs
     */
    applyFilters() {
        let filtered = [...this.logs];
        
        // Filtre par severity
        if (this.activeFilters.severity.length > 0) {
            filtered = filtered.filter(log => 
                this.activeFilters.severity.includes(log.severity)
            );
        }
        
        // Filtre par source
        if (this.activeFilters.source.length > 0) {
            filtered = filtered.filter(log => 
                this.activeFilters.source.includes(log.source)
            );
        }
        
        // Filtre par method
        if (this.activeFilters.method.length > 0) {
            filtered = filtered.filter(log => 
                log.http && this.activeFilters.method.includes(log.http.method)
            );
        }
        
        // Filtre par status range
        if (this.activeFilters.statusRange) {
            const { min, max } = this.activeFilters.statusRange;
            filtered = filtered.filter(log => 
                log.http && log.http.status >= min && log.http.status <= max
            );
        }
        
        // Filtre par endpoint
        if (this.activeFilters.endpoint.length > 0) {
            filtered = filtered.filter(log => 
                log.meta.endpoint && this.activeFilters.endpoint.includes(log.meta.endpoint)
            );
        }
        
        // Filtre par hasError
        if (this.activeFilters.hasError !== null) {
            filtered = filtered.filter(log => 
                log.meta.hasError === this.activeFilters.hasError
            );
        }
        
        // Recherche plein texte
        if (this.activeFilters.searchText) {
            const searchTerm = this.activeFilters.searchText.toLowerCase();
            
            if (this.activeFilters.useRegex) {
                try {
                    const regex = new RegExp(searchTerm, 'i');
                    filtered = filtered.filter(log => 
                        regex.test(log.message) ||
                        regex.test(JSON.stringify(log.details))
                    );
                } catch (e) {
                    // Regex invalide, utiliser recherche simple
                    filtered = filtered.filter(log => 
                        log.message.toLowerCase().includes(searchTerm) ||
                        JSON.stringify(log.details).toLowerCase().includes(searchTerm)
                    );
                }
            } else {
                filtered = filtered.filter(log => 
                    log.message.toLowerCase().includes(searchTerm) ||
                    JSON.stringify(log.details).toLowerCase().includes(searchTerm)
                );
            }
        }
        
        this.displayedLogs = filtered;
        
        this.notifySubscribers({ 
            type: 'filtersApplied',
            displayedCount: this.displayedLogs.length,
            totalCount: this.logs.length
        });
    }

    /**
     * Mettre à jour les facettes (compteurs dynamiques)
     */
    updateFacets() {
        // Réinitialiser
        this.facets = {
            severity: {},
            source: {},
            method: {},
            status: {},
            endpoint: {},
            hasError: { true: 0, false: 0 }
        };
        
        // Compter les occurrences
        this.logs.forEach(log => {
            // Severity
            this.facets.severity[log.severity] = (this.facets.severity[log.severity] || 0) + 1;
            
            // Source
            this.facets.source[log.source] = (this.facets.source[log.source] || 0) + 1;
            
            // Method
            if (log.http?.method) {
                this.facets.method[log.http.method] = (this.facets.method[log.http.method] || 0) + 1;
            }
            
            // Status (par plage)
            if (log.http?.status) {
                const statusRange = this.getStatusRange(log.http.status);
                this.facets.status[statusRange] = (this.facets.status[statusRange] || 0) + 1;
            }
            
            // Endpoint
            if (log.meta.endpoint) {
                this.facets.endpoint[log.meta.endpoint] = (this.facets.endpoint[log.meta.endpoint] || 0) + 1;
            }
            
            // HasError
            this.facets.hasError[log.meta.hasError] = (this.facets.hasError[log.meta.hasError] || 0) + 1;
        });
    }

    /**
     * Obtenir la plage de status HTTP
     */
    getStatusRange(status) {
        if (status >= 200 && status < 300) return '2xx';
        if (status >= 300 && status < 400) return '3xx';
        if (status >= 400 && status < 500) return '4xx';
        if (status >= 500) return '5xx';
        return 'other';
    }

    /**
     * Définir un filtre
     */
    setFilter(filterType, value) {
        this.activeFilters[filterType] = value;
        this.applyFilters();
    }

    /**
     * Réinitialiser tous les filtres
     */
    resetFilters() {
        this.activeFilters = {
            severity: [],
            source: [],
            method: [],
            statusRange: null,
            endpoint: [],
            hasError: null,
            searchText: '',
            useRegex: false
        };
        this.applyFilters();
        
        this.notifySubscribers({ type: 'filtersReset' });
    }

    /**
     * Effacer la vue locale (pas le buffer serveur)
     */
    clearLocal() {
        // Arrêter le flux si actif
        if (this.isPlaying) {
            this.stop();
        }
        
        this.logs = [];
        this.displayedLogs = [];
        this.updateFacets();
        
        this.notifySubscribers({ 
            type: 'logsCleared',
            totalCount: 0,
            displayedCount: 0
        });
    }

    /**
     * Exporter les logs affichés (filtrés) au format CSV
     */
    exportCsv() {
        const csv = ['Timestamp,Severity,Source,Message,Method,URL,Status,Duration(ms)'];
        
        this.displayedLogs.forEach(log => {
            const timestamp = new Date(log.ts).toISOString();
            const message = this.escapeCsv(log.message);
            const method = log.http?.method || '';
            const url = log.http?.url || '';
            const status = log.http?.status || '';
            const duration = log.http?.durationMs || '';
            
            csv.push(`${timestamp},${log.severity},${log.source},${message},${method},${url},${status},${duration}`);
        });
        
        this.downloadFile(csv.join('\n'), `logs_${Date.now()}.csv`, 'text/csv');
    }

    /**
     * Exporter les logs affichés (filtrés) au format JSON
     */
    exportJson() {
        const json = JSON.stringify(this.displayedLogs, null, 2);
        this.downloadFile(json, `logs_${Date.now()}.json`, 'application/json');
    }

    /**
     * Échapper les valeurs CSV
     */
    escapeCsv(value) {
        if (!value) return '';
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value}"`;
        }
        return value;
    }

    /**
     * Télécharger un fichier
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Configurer la taille du buffer
     */
    setBufferSize(size) {
        if (size < 5000) size = 5000;
        this.maxBufferSize = size;
        
        // Tronquer si nécessaire
        if (this.logs.length > this.maxBufferSize) {
            this.logs = this.logs.slice(0, this.maxBufferSize);
            this.applyFilters();
        }
    }

    /**
     * S'abonner aux changements
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifier les abonnés
     */
    notifySubscribers(event) {
        this.subscribers.forEach(callback => callback(event));
    }

    /**
     * Obtenir l'état actuel
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            totalCount: this.logs.length,
            displayedCount: this.displayedLogs.length,
            bufferSize: this.maxBufferSize,
            facets: this.facets,
            activeFilters: this.activeFilters
        };
    }

    /**
     * Obtenir les logs affichés
     */
    getDisplayedLogs() {
        return this.displayedLogs;
    }
}

// Export singleton
export const logService = new LogService();
export default logService;

