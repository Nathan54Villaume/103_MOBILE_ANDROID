/**
 * API Client avec gestion de l'authentification JWT
 */

const API_BASE_URL = window.location.origin;

class ApiClient {
    constructor() {
        // SÉCURITÉ : Ne jamais récupérer le token du localStorage
        // Forcer la reconnexion à chaque visite
        this.token = null;
        this.user = null;
        this.requestLog = [];
        this.maxLogSize = 100; // Garder les 100 dernières requêtes
    }

    /**
     * EXTENSION: Ajouter une entrée au log des requêtes avec détails enrichis
     */
    logRequest(method, endpoint, status, duration, error = null, details = {}) {
        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date(),
            method: method || 'GET',
            endpoint,
            status,
            duration,
            error,
            success: status >= 200 && status < 300,
            // EXTENSION: Détails enrichis
            requestSize: details.requestSize || null,
            responseSize: details.responseSize || null,
            requestBody: details.requestBody || null,
            responseBody: details.responseBody || null,
            headers: details.headers || null
        };

        this.requestLog.unshift(logEntry); // Ajouter au début
        
        // Limiter la taille du log
        if (this.requestLog.length > this.maxLogSize) {
            this.requestLog = this.requestLog.slice(0, this.maxLogSize);
        }

        // Logger dans la console avec style
        const emoji = logEntry.success ? '✅' : '❌';
        const color = logEntry.success ? 'color: #10b981' : 'color: #ef4444';
        console.log(
            `%c${emoji} ${method} ${endpoint} → ${status} (${duration}ms)`,
            color
        );

        if (error) {
            console.error('   Error:', error);
        }

        // Dispatch un événement custom pour que l'UI puisse réagir
        window.dispatchEvent(new CustomEvent('api-request', { detail: logEntry }));
    }
    
    /**
     * EXTENSION: Générer un ID unique pour un log
     */
    generateLogId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * EXTENSION: Sanitize sensitive data
     */
    sanitizeData(data) {
        if (!data) return data;
        
        const sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'secret'];
        const sanitized = JSON.parse(JSON.stringify(data));
        
        const sanitizeObject = (obj) => {
            for (const key in obj) {
                if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                    obj[key] = '****';
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        };
        
        if (typeof sanitized === 'object') {
            sanitizeObject(sanitized);
        }
        
        return sanitized;
    }

    /**
     * Obtenir l'historique des requêtes
     */
    getRequestLog() {
        return this.requestLog;
    }

    /**
     * Vider le log des requêtes
     */
    clearRequestLog() {
        this.requestLog = [];
    }

    /**
     * EXTENSION: Effectuer une requête HTTP avec gestion du token JWT et capture détaillée
     */
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const method = options.method || 'GET';
        const startTime = performance.now();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Ajouter le token si disponible
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // EXTENSION: Capturer le corps de la requête (sanitized)
        let requestBody = null;
        let requestSize = 0;
        if (options.body) {
            requestSize = new Blob([options.body]).size;
            try {
                const parsedBody = JSON.parse(options.body);
                requestBody = this.sanitizeData(parsedBody);
            } catch (e) {
                // Pas JSON, ignorer
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const duration = Math.round(performance.now() - startTime);

            // EXTENSION: Capturer le corps de la réponse (sanitized)
            let responseBody = null;
            let responseSize = 0;
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                responseSize = parseInt(contentLength, 10);
            }

            // Si 401, le token est invalide
            if (response.status === 401) {
                this.logRequest(method, endpoint, 401, duration, 'Session expirée', {
                    requestSize,
                    responseSize,
                    requestBody,
                    headers: this.sanitizeHeaders(headers)
                });
                this.logout();
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
                const errorMsg = error.message || error.error || `HTTP ${response.status}`;
                
                // EXTENSION: Log avec détails d'erreur
                this.logRequest(method, endpoint, response.status, duration, errorMsg, {
                    requestSize,
                    responseSize,
                    requestBody,
                    responseBody: this.sanitizeData(error),
                    headers: this.sanitizeHeaders(headers)
                });
                
                throw new Error(errorMsg);
            }

            // Lire la réponse
            const data = await response.json();
            responseBody = this.sanitizeData(data);
            
            // EXTENSION: Log success avec détails
            this.logRequest(method, endpoint, response.status, duration, null, {
                requestSize,
                responseSize,
                requestBody,
                responseBody,
                headers: this.sanitizeHeaders(headers)
            });

            return data;
        } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            
            // Si erreur réseau (pas de status)
            if (!error.status) {
                this.logRequest(method, endpoint, 0, duration, error.message, {
                    requestSize,
                    requestBody,
                    headers: this.sanitizeHeaders(headers)
                });
            }
            
            throw error;
        }
    }
    
    /**
     * EXTENSION: Sanitize headers (masquer Authorization)
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        if (sanitized['Authorization']) {
            sanitized['Authorization'] = 'Bearer ****';
        }
        return sanitized;
    }

    /**
     * Authentification
     */
    async login(username, password) {
        console.log('🔐 [API] Envoi requête login pour:', username);
        
        const data = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        console.log('🔐 [API] Réponse login:', data);

        if (data.success && data.token) {
            this.token = data.token;
            this.user = data.user;
            console.log('✅ [API] Token reçu et stocké');
            // SÉCURITÉ : Ne PAS stocker le token dans localStorage
            // La session expire dès que la page est fermée/rechargée
            return data;
        } else {
            console.error('❌ [API] Login failed:', data);
            throw new Error(data.message || 'Échec de connexion');
        }
    }

    /**
     * Déconnexion
     */
    logout() {
        this.token = null;
        this.user = null;
        // Nettoyer le localStorage (au cas où d'anciennes données existeraient)
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.reload();
    }

    /**
     * Vérifier si l'utilisateur est authentifié
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Obtenir l'utilisateur courant
     */
    getCurrentUser() {
        // Ne jamais récupérer depuis localStorage pour forcer la reconnexion
        return this.user;
    }

    // =========== ENDPOINTS API ===========

    /**
     * Dashboard complet
     */
    async getDashboard() {
        return await this.request('/api/admin/dashboard');
    }

    /**
     * Statut serveur
     */
    async getServerStatus() {
        return await this.request('/api/admin/status');
    }

    /**
     * Métriques serveur
     */
    async getServerMetrics() {
        return await this.request('/api/admin/metrics');
    }

    /**
     * Health check global
     */
    async getHealthCheck() {
        return await this.request('/api/admin/health');
    }

    /**
     * Santé des bases de données
     */
    async getDatabaseHealth() {
        return await this.request('/api/admin/database/health');
    }

    /**
     * Statistiques d'une base de données
     */
    async getDatabaseStats(connectionName) {
        return await this.request(`/api/admin/database/stats/${connectionName}`);
    }

    /**
     * Obtenir toutes les connexions PLC
     */
    async getPlcConnections() {
        return await this.request('/api/admin/plc/connections');
    }

    /**
     * Ajouter une connexion PLC
     */
    async addPlcConnection(data) {
        return await this.request('/api/admin/plc/connections', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Supprimer une connexion PLC
     */
    async deletePlcConnection(id) {
        return await this.request(`/api/admin/plc/connections/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Mettre à jour une connexion PLC
     */
    async updatePlcConnection(id, data) {
        return await this.request(`/api/admin/plc/connections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Obtenir les logs
     */
    async getLogs(count = 100, level = null) {
        const params = new URLSearchParams({ count });
        if (level) params.append('level', level);
        return await this.request(`/api/admin/logs?${params}`);
    }

    /**
     * Rechercher dans les logs
     */
    async searchLogs(searchTerm, maxResults = 100) {
        const params = new URLSearchParams({ searchTerm, maxResults });
        return await this.request(`/api/admin/logs/search?${params}`);
    }

    /**
     * Statistiques des logs
     */
    async getLogStats() {
        return await this.request('/api/admin/logs/stats');
    }

    /**
     * Métriques système détaillées (machine + processus)
     */
    async getSystemMetrics() {
        return await this.request('/api/admin/system-metrics');
    }

    /**
     * Configuration
     */
    async getConfiguration() {
        return await this.request('/api/admin/config');
    }

    /**
     * Liste des contrôleurs
     */
    async getControllers() {
        return await this.request('/api/admin/controllers');
    }
}

// Export singleton
export const apiClient = new ApiClient();
export default apiClient;

