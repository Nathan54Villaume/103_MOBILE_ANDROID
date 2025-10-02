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
     * Ajouter une entrée au log des requêtes
     */
    logRequest(method, endpoint, status, duration, error = null) {
        const logEntry = {
            timestamp: new Date(),
            method: method || 'GET',
            endpoint,
            status,
            duration,
            error,
            success: status >= 200 && status < 300
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
     * Effectuer une requête HTTP avec gestion du token JWT
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

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const duration = Math.round(performance.now() - startTime);

            // Si 401, le token est invalide
            if (response.status === 401) {
                this.logRequest(method, endpoint, 401, duration, 'Session expirée');
                this.logout();
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
                const errorMsg = error.message || error.error || `HTTP ${response.status}`;
                this.logRequest(method, endpoint, response.status, duration, errorMsg);
                throw new Error(errorMsg);
            }

            // Log success
            this.logRequest(method, endpoint, response.status, duration);

            return await response.json();
        } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            
            // Si erreur réseau (pas de status)
            if (!error.status) {
                this.logRequest(method, endpoint, 0, duration, error.message);
            }
            
            throw error;
        }
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

