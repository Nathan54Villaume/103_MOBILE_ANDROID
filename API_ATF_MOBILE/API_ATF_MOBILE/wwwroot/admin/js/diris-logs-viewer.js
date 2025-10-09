/**
 * Module de visualisation des logs DIRIS détaillés
 * Affiche les logs d'acquisition, erreurs, et logs généraux depuis C:\API_ATF_MOBILE\DATA\logs
 */

import apiClient from './api-client.js';

class DirisLogsViewer {
    constructor() {
        this.logs = [];
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.currentFilter = 'all'; // 'all', 'acquisition', 'errors'
        this.maxLines = 200;
    }

    /**
     * Initialiser le viewer de logs DIRIS
     */
    init() {
        console.log('📝 Initialisation du module DIRIS Logs Viewer');
        
        this.attachEventListeners();
        this.loadLogs();
    }

    /**
     * Attacher les event listeners
     */
    attachEventListeners() {
        // Bouton Play/Pause
        const playBtn = document.getElementById('dirisLogsPlayBtn');
        const stopBtn = document.getElementById('dirisLogsStopBtn');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.startAutoRefresh());
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopAutoRefresh());
        }

        // Bouton Refresh manuel
        const refreshBtn = document.getElementById('dirisLogsRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadLogs());
        }

        // Bouton Clear
        const clearBtn = document.getElementById('dirisLogsClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearDisplay());
        }

        // Filtres
        const filterBtns = document.querySelectorAll('[data-diris-log-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.dirisLogFilter;
                this.setFilter(filter);
            });
        });

        // Nombre de lignes
        const linesSelect = document.getElementById('dirisLogsMaxLines');
        if (linesSelect) {
            linesSelect.addEventListener('change', (e) => {
                this.maxLines = parseInt(e.target.value);
                this.loadLogs();
            });
        }
    }

    /**
     * Charger les logs depuis l'API
     */
    async loadLogs() {
        try {
            let endpoint = '';
            
            switch (this.currentFilter) {
                case 'acquisition':
                    endpoint = `/api/diris/logs/acquisition?lines=${this.maxLines}`;
                    break;
                case 'errors':
                    endpoint = `/api/diris/logs/errors?lines=${this.maxLines}`;
                    break;
                case 'all':
                default:
                    endpoint = `/api/diris/logs/recent?lines=${this.maxLines}`;
                    break;
            }

            const response = await apiClient.get(endpoint);
            
            if (response.success) {
                this.logs = response.logs || [];
                this.renderLogs();
                this.updateCounters(response);
            } else {
                console.error('❌ Erreur chargement logs:', response.message);
                this.showError(response.message);
            }
        } catch (error) {
            console.error('❌ Erreur chargement logs DIRIS:', error);
            this.showError('Impossible de charger les logs');
        }
    }

    /**
     * Afficher les logs dans le DOM
     */
    renderLogs() {
        const container = document.getElementById('dirisLogsContainer');
        if (!container) return;

        if (this.logs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <p class="text-lg">📭 Aucun log disponible</p>
                    <p class="text-sm mt-2">Les logs apparaîtront ici en temps réel</p>
                </div>
            `;
            return;
        }

        const html = this.logs.map((log, index) => {
            const level = this.extractLogLevel(log);
            const timestamp = this.extractTimestamp(log);
            const message = this.extractMessage(log);
            const levelClass = this.getLevelClass(level);
            const levelIcon = this.getLevelIcon(level);

            return `
                <div class="log-entry ${levelClass} border-l-4 p-3 mb-2 bg-slate-800/50 rounded hover:bg-slate-700/50 transition-colors">
                    <div class="flex items-start gap-3">
                        <span class="text-xl flex-shrink-0">${levelIcon}</span>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-xs text-slate-400 font-mono">${timestamp}</span>
                                <span class="text-xs px-2 py-0.5 rounded ${this.getLevelBadgeClass(level)}">${level}</span>
                            </div>
                            <pre class="text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">${this.escapeHtml(message)}</pre>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        
        // Auto-scroll vers le bas si auto-refresh est activé
        if (this.autoRefresh) {
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * Extraire le niveau de log
     */
    extractLogLevel(log) {
        const match = log.match(/\[(INF|WRN|ERR|DBG|TRC|CRT)\]/);
        if (match) {
            const level = match[1];
            switch (level) {
                case 'INF': return 'INFO';
                case 'WRN': return 'WARNING';
                case 'ERR': return 'ERROR';
                case 'DBG': return 'DEBUG';
                case 'TRC': return 'TRACE';
                case 'CRT': return 'CRITICAL';
                default: return 'INFO';
            }
        }
        return 'INFO';
    }

    /**
     * Extraire le timestamp
     */
    extractTimestamp(log) {
        const match = log.match(/\[([^\]]+)\s+[A-Z]{3}\]/);
        return match ? match[1] : '';
    }

    /**
     * Extraire le message
     */
    extractMessage(log) {
        // Enlever le timestamp et le niveau
        return log.replace(/^\[[^\]]+\s+[A-Z]{3}\]\s*/, '');
    }

    /**
     * Obtenir la classe CSS pour le niveau
     */
    getLevelClass(level) {
        switch (level) {
            case 'ERROR':
            case 'CRITICAL':
                return 'border-red-500';
            case 'WARNING':
                return 'border-yellow-500';
            case 'DEBUG':
            case 'TRACE':
                return 'border-blue-500';
            default:
                return 'border-slate-600';
        }
    }

    /**
     * Obtenir l'icône pour le niveau
     */
    getLevelIcon(level) {
        switch (level) {
            case 'ERROR':
            case 'CRITICAL':
                return '🔴';
            case 'WARNING':
                return '⚠️';
            case 'DEBUG':
                return '🔍';
            case 'TRACE':
                return '🔬';
            default:
                return 'ℹ️';
        }
    }

    /**
     * Obtenir la classe du badge pour le niveau
     */
    getLevelBadgeClass(level) {
        switch (level) {
            case 'ERROR':
            case 'CRITICAL':
                return 'bg-red-500/20 text-red-400';
            case 'WARNING':
                return 'bg-yellow-500/20 text-yellow-400';
            case 'DEBUG':
            case 'TRACE':
                return 'bg-blue-500/20 text-blue-400';
            default:
                return 'bg-slate-500/20 text-slate-400';
        }
    }

    /**
     * Échapper le HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Mettre à jour les compteurs
     */
    updateCounters(response) {
        const totalElement = document.getElementById('dirisLogsTotalCount');
        const displayedElement = document.getElementById('dirisLogsDisplayedCount');
        const fileElement = document.getElementById('dirisLogsCurrentFile');

        if (totalElement) {
            totalElement.textContent = response.linesReturned || this.logs.length;
        }
        
        if (displayedElement) {
            displayedElement.textContent = this.logs.length;
        }

        if (fileElement && response.logFile) {
            fileElement.textContent = response.logFile;
        }
    }

    /**
     * Définir le filtre
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Mettre à jour l'UI des boutons
        document.querySelectorAll('[data-diris-log-filter]').forEach(btn => {
            if (btn.dataset.dirisLogFilter === filter) {
                btn.classList.add('bg-blue-600', 'text-white');
                btn.classList.remove('bg-slate-700', 'text-slate-300');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-slate-700', 'text-slate-300');
            }
        });

        this.loadLogs();
    }

    /**
     * Démarrer le rafraîchissement automatique
     */
    startAutoRefresh() {
        if (this.autoRefresh) return;
        
        this.autoRefresh = true;
        this.refreshInterval = setInterval(() => {
            this.loadLogs();
        }, 5000); // Rafraîchir toutes les 5 secondes

        // Mettre à jour l'UI
        const playBtn = document.getElementById('dirisLogsPlayBtn');
        const stopBtn = document.getElementById('dirisLogsStopBtn');
        
        if (playBtn) playBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        console.log('▶️ Auto-refresh DIRIS logs activé');
    }

    /**
     * Arrêter le rafraîchissement automatique
     */
    stopAutoRefresh() {
        if (!this.autoRefresh) return;
        
        this.autoRefresh = false;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Mettre à jour l'UI
        const playBtn = document.getElementById('dirisLogsPlayBtn');
        const stopBtn = document.getElementById('dirisLogsStopBtn');
        
        if (playBtn) playBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');

        console.log('⏸️ Auto-refresh DIRIS logs arrêté');
    }

    /**
     * Vider l'affichage
     */
    clearDisplay() {
        this.logs = [];
        this.renderLogs();
        console.log('🗑️ Affichage vidé');
    }

    /**
     * Afficher une erreur
     */
    showError(message) {
        const container = document.getElementById('dirisLogsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <p class="text-lg">❌ ${message}</p>
                <button onclick="window.dirisLogsViewer.loadLogs()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Réessayer
                </button>
            </div>
        `;
    }

    /**
     * Nettoyer (appelé lors de la destruction)
     */
    destroy() {
        this.stopAutoRefresh();
    }
}

// Créer une instance globale
const dirisLogsViewer = new DirisLogsViewer();
window.dirisLogsViewer = dirisLogsViewer; // Pour accès depuis le HTML

export default dirisLogsViewer;

