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
        this.pollDelay = 1500; // 1.5 secondes pour une démonstration plus fluide
        
        // Dernière position de scroll (pour maintenir le scroll)
        this.userScrolledUp = false;
        
        // Flag pour éviter les chargements initiaux multiples
        this.isInitialized = false;
    }

    /**
     * Démarrer le flux live (mode Play)
     */
    start() {
        if (this.isPlaying) {
            console.log('⚠️ start: Déjà en mode Play, ignoré');
            return;
        }
        
        console.log('▶️ start: Démarrage du flux de logs');
        console.log('📊 start: État actuel - logs:', this.logs.length, 'isInitialized:', this.isInitialized);
        this.isPlaying = true;
        
        // Démarrer le polling
        console.log('⏰ start: Configuration du polling toutes les', this.pollDelay, 'ms');
        this.pollInterval = setInterval(() => {
            console.log('🔄 Polling tick - fetchNewLogs()');
            this.fetchNewLogs();
        }, this.pollDelay);
        
        // Premier chargement immédiat
        console.log('🚀 start: Premier fetchNewLogs immédiat');
        this.fetchNewLogs();
        
        this.notifySubscribers({ type: 'stateChanged', isPlaying: true });
        console.log('✅ start: Mode Play activé');
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
                console.log('🚫 fetchNewLogs: pas en mode Play, abandon');
                return;
            }
            
            console.log('🔄 fetchNewLogs: Récupération des logs...');
            
            // Récupérer les derniers logs
            const logs = await apiClient.getLogs(200);
            console.log('📦 fetchNewLogs: Logs reçus:', logs?.length || 0);
            
            if (!logs || !Array.isArray(logs) || logs.length === 0) {
                console.log('📭 fetchNewLogs: Aucun log reçu');
                return;
            }
            
            // Stratégie de détection de nouveaux logs
            let newLogs = [];
            
            if (this.logs.length === 0) {
                // Premier chargement : prendre tous les logs
                newLogs = logs;
                console.log('🆕 fetchNewLogs: Premier chargement, tous les logs sont nouveaux');
            } else {
                // Déterminer le timestamp de référence (le plus récent qu'on a)
                const lastTimestamp = new Date(this.logs[0].ts);
                console.log('⏰ fetchNewLogs: Dernier timestamp connu:', lastTimestamp.toISOString());
                
                // Filtrer pour ne garder que les logs plus récents
                newLogs = logs.filter(log => {
                    const logTime = new Date(log.timestamp || log.ts);
                    const isNewer = logTime > lastTimestamp;
                    if (isNewer) {
                        console.log('🆕 fetchNewLogs: Log plus récent trouvé:', log.timestamp, log.message?.substring(0, 50));
                    }
                    return isNewer;
                });
                
                // Si pas de nouveaux logs par timestamp, vérifier si l'API a de nouveaux IDs
                if (newLogs.length === 0) {
                    const existingIds = new Set(this.logs.map(l => l.id));
                    const newByIds = logs.filter(log => !existingIds.has(log.id));
                    if (newByIds.length > 0) {
                        console.log('🆔 fetchNewLogs: Nouveaux logs détectés par ID:', newByIds.length);
                        newLogs = newByIds;
                    }
                }
            }
            
            // Déduplication par ID (au cas où)
            const existingIds = new Set(this.logs.map(l => l.id));
            newLogs = newLogs.filter(l => !existingIds.has(l.id));
            
            console.log('🆕 fetchNewLogs: Nouveaux logs après filtrage:', newLogs.length);
            
            // Si aucun nouveau log de l'API, ne rien faire (pas de logs de test automatiques)
            if (newLogs.length === 0) {
                console.log('📭 fetchNewLogs: Aucun nouveau log de l\'API');
                return; // Sortir sans rien faire
            }
            
            if (newLogs.length > 0) {
                // Normaliser les logs
                const normalizedLogs = newLogs.map(log => this.normalizeLog(log));
                console.log('🔄 fetchNewLogs: Logs normalisés:', normalizedLogs.length);
                
                // Ajouter au début (plus récents en premier)
                this.logs.unshift(...normalizedLogs);
                
                // Limiter la taille du buffer
                if (this.logs.length > this.maxBufferSize) {
                    this.logs = this.logs.slice(0, this.maxBufferSize);
                }
                
                // Trier par timestamp décroissant pour maintenir l'ordre
                this.logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
                
                console.log('📊 fetchNewLogs: Buffer mis à jour:', this.logs.length, 'logs total');
                
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
                
                console.log('✅ fetchNewLogs: Mise à jour terminée, notifiés');
            } else {
                console.log('📭 fetchNewLogs: Aucun nouveau log à ajouter');
            }
        } catch (error) {
            console.error('❌ fetchNewLogs: Erreur:', error);
        }
    }

    /**
     * Charger les logs initiaux (200 derniers)
     */
    async loadInitialLogs() {
        // Éviter les chargements multiples
        if (this.isInitialized) {
            console.log('📋 Logs déjà initialisés, utilisation du cache existant');
            this.notifySubscribers({ 
                type: 'logsLoaded', 
                totalCount: this.logs.length,
                displayedCount: this.displayedLogs.length
            });
            return;
        }
        
        try {
            console.log('📥 Chargement des logs initiaux...');
            const logs = await apiClient.getLogs(200);
            console.log('📦 Logs reçus de l\'API:', logs?.length || 0, logs);
            
            // Vérifier si on a des logs
            if (!logs || !Array.isArray(logs) || logs.length === 0) {
                console.warn('⚠️ Aucun log reçu de l\'API');
                // Initialiser avec un tableau vide plutôt que des logs de test
                this.logs = [];
                this.displayedLogs = [];
                this.updateFacets();
                this.applyFilters();
                this.isInitialized = true;
                
                this.notifySubscribers({ 
                    type: 'logsLoaded', 
                    totalCount: 0,
                    displayedCount: 0
                });
                return;
            }
            
            // Normaliser les logs
            this.logs = logs.map(log => this.normalizeLog(log));
            console.log('🔄 Logs normalisés:', this.logs.length, this.logs);
            
            // Trier par timestamp décroissant
            this.logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
            
            // Calculer les facettes
            this.updateFacets();
            
            // Appliquer les filtres (vides au départ)
            this.applyFilters();
            
            console.log(`✅ ${this.logs.length} logs chargés, ${this.displayedLogs.length} affichés`);
            
            // Marquer comme initialisé
            this.isInitialized = true;
            
            this.notifySubscribers({ 
                type: 'logsLoaded', 
                totalCount: this.logs.length,
                displayedCount: this.displayedLogs.length
            });
        } catch (error) {
            console.error('❌ Erreur lors du chargement initial:', error);
            console.warn('🔧 Création de logs de test pour le debug');
            this.createTestLogs();
            this.isInitialized = true;
        }
    }
    
    /**
     * Créer des logs de test pour le debug
     */
    createTestLogs() {
        console.log('🧪 Création de logs de test...');
        const testLogs = [
            {
                id: 'test-1',
                timestamp: new Date().toISOString(),
                level: 'Information',
                message: 'Service de logs initialisé',
                source: 'System'
            },
            {
                id: 'test-2',
                timestamp: new Date(Date.now() - 1000).toISOString(),
                level: 'Information',
                message: 'Interface d\'administration démarrée',
                source: 'System'
            },
            {
                id: 'test-3',
                timestamp: new Date(Date.now() - 2000).toISOString(),
                level: 'Warning',
                message: 'Aucun log trouvé dans l\'API, utilisation de logs de test',
                source: 'API'
            }
        ];
        
        // Normaliser les logs de test
        this.logs = testLogs.map(log => this.normalizeLog(log));
        
        // Calculer les facettes
        this.updateFacets();
        
        // Appliquer les filtres
        this.applyFilters();
        
        console.log(`🧪 ${this.logs.length} logs de test créés`);
        
        this.notifySubscribers({ 
            type: 'logsLoaded', 
            totalCount: this.logs.length,
            displayedCount: this.displayedLogs.length
        });
    }
    
    /**
     * Générer un nouveau log de test (pour simuler l'arrivée de nouveaux logs)
     */
    generateTestLog() {
        const currentTime = new Date();
        const timeStr = currentTime.toLocaleTimeString();
        
        const messages = [
            `Requête API traitée avec succès à ${timeStr}`,
            `Connexion PLC établie à ${timeStr}`,
            `Sauvegarde automatique effectuée à ${timeStr}`,
            `Utilisateur connecté à ${timeStr}`,
            `Erreur de connexion temporaire à ${timeStr}`,
            `Mise à jour de configuration à ${timeStr}`,
            `Traitement de données terminé à ${timeStr}`,
            `Monitoring système - CPU: ${Math.floor(Math.random() * 100)}%`,
            `Base de données: ${Math.floor(Math.random() * 1000)} requêtes/min`,
            `Température PLC: ${Math.floor(Math.random() * 30 + 20)}°C`,
            `Nouvelle session utilisateur démarrée`,
            `Backup automatique en cours...`,
            `Synchronisation des données terminée`
        ];
        
        const sources = ['API', 'System', 'PLC', 'DB', 'Monitor'];
        const levels = ['Information', 'Warning', 'Error'];
        
        // Favoriser les messages Information (70%), Warning (20%), Error (10%)
        const levelWeights = [0.7, 0.9, 1.0];
        const rand = Math.random();
        let selectedLevel = 'Information';
        if (rand > levelWeights[1]) selectedLevel = 'Error';
        else if (rand > levelWeights[0]) selectedLevel = 'Warning';
        
        const testLog = {
            id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: currentTime.toISOString(),
            level: selectedLevel,
            message: messages[Math.floor(Math.random() * messages.length)],
            source: sources[Math.floor(Math.random() * sources.length)]
        };
        
        // Si c'est une requête API, ajouter des détails HTTP
        if (testLog.source === 'API') {
            const methods = ['GET', 'POST', 'PUT', 'DELETE'];
            const endpoints = ['/api/logs', '/api/status', '/api/config', '/api/users', '/api/data', '/api/monitoring'];
            const statusCodes = selectedLevel === 'Error' ? [500, 404, 403] : [200, 201, 204];
            
            testLog.httpDetails = {
                method: methods[Math.floor(Math.random() * methods.length)],
                url: endpoints[Math.floor(Math.random() * endpoints.length)],
                statusCode: statusCodes[Math.floor(Math.random() * statusCodes.length)],
                durationMs: Math.floor(Math.random() * 300) + 20
            };
        }
        
        console.log('🧪 Nouveau log de test généré:', testLog);
        return testLog;
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
        
        const normalized = {
            id: log.id || this.generateId(),
            ts: log.timestamp || new Date().toISOString(),
            severity: severityMap[log.level] || 'info',
            source: log.source || 'API',
            message: log.message || 'Message vide',
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
        
        console.log('🔄 Log normalisé:', log, '→', normalized);
        return normalized;
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
        console.log('🗑️ clearLocal: Effacement de la vue locale');
        
        // Arrêter le flux si actif
        if (this.isPlaying) {
            this.stop();
        }
        
        // Réinitialiser l'état
        this.logs = [];
        this.displayedLogs = [];
        this.isInitialized = false; // Permettre un nouveau chargement initial
        this.updateFacets();
        
        console.log('🗑️ clearLocal: Vue effacée, prêt pour un nouveau chargement');
        
        this.notifySubscribers({ 
            type: 'logsCleared',
            totalCount: 0,
            displayedCount: 0
        });
    }
    
    /**
     * Forcer un rafraîchissement complet (recharger depuis l'API)
     */
    async forceRefresh() {
        console.log('🔄 forceRefresh: Rafraîchissement forcé demandé');
        
        // Réinitialiser l'état
        this.isInitialized = false;
        this.logs = [];
        this.displayedLogs = [];
        
        // Recharger
        await this.loadInitialLogs();
        
        console.log('✅ forceRefresh: Rafraîchissement terminé');
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
            activeFilters: this.activeFilters,
            isInitialized: this.isInitialized,
            pollInterval: this.pollInterval !== null
        };
    }
    
    /**
     * Debug: Obtenir des informations détaillées sur l'état
     */
    getDebugInfo() {
        return {
            ...this.getState(),
            pollDelay: this.pollDelay,
            lastLogs: this.logs.slice(0, 3).map(log => ({
                id: log.id,
                ts: log.ts,
                message: log.message.substring(0, 50)
            })),
            subscribersCount: this.subscribers.length
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

// EXTENSION: Exposer globalement pour debug dans la console (sans logs de test)
if (typeof window !== 'undefined') {
    window.logServiceDebug = {
        getState: () => logService.getState(),
        getDebugInfo: () => logService.getDebugInfo(),
        start: () => logService.start(),
        stop: () => logService.stop(),
        refresh: () => logService.forceRefresh()
    };
}

export default logService;

