/**
 * Application principale pour la version 2 - Interface simplifiée
 * Gère uniquement les KPI et la courbe universelle
 */

class AppV2 {
    constructor() {
        this.kpiManager = null;
        this.universalChartManager = null;
        this.isInitialized = false;
        
        console.log('[AppV2] Initialisation...');
        this.init();
    }

    /**
     * Initialise l'application
     */
    async init() {
        try {
            await this.initializeComponents();
            this.setupEventListeners();
            this.startAutoRefresh();
            this.isInitialized = true;
            this.hideLoader();
            console.log('[AppV2] Initialisation terminée');
        } catch (error) {
            console.error('[AppV2] Erreur lors de l\'initialisation:', error);
            this.showError('Erreur lors de l\'initialisation de l\'application');
            this.hideLoader();
        }
    }

    /**
     * Initialise les composants
     */
    async initializeComponents() {
        try {
            this.updateLoaderText('Initialisation des KPI...');
            
            // Initialiser le gestionnaire de KPI
            this.kpiManager = new KPIManager();
            
            this.updateLoaderText('Connexion à la courbe universelle...');
            
            // La courbe universelle sera initialisée par son propre script
            // On attend qu'elle soit disponible
            this.waitForUniversalChart();
            
            console.log('[AppV2] Composants initialisés');
        } catch (error) {
            console.error('[AppV2] Erreur initialisation composants:', error);
            this.showError('Erreur lors de l\'initialisation des composants.');
        }
    }

    /**
     * Attend que la courbe universelle soit disponible
     */
    waitForUniversalChart() {
        if (window.universalChartManager) {
            this.universalChartManager = window.universalChartManager;
            this.updateLoaderText('Finalisation...');
            console.log('[AppV2] Courbe universelle connectée');
        } else {
            // Réessayer dans 100ms
            setTimeout(() => this.waitForUniversalChart(), 100);
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Écouteur pour les paramètres API
        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Écouteur pour les dialogues
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-dialog-close]')) {
                this.closeDialog(e.target.closest('dialog'));
            }
        });

        // Écouteur pour les sections collapsibles
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-collapsible-trigger]')) {
                this.toggleCollapsible(e.target);
            }
        });

        console.log('[AppV2] Écouteurs d\'événements configurés');
    }

    /**
     * Démarre le rafraîchissement automatique
     */
    startAutoRefresh() {
        // Rafraîchir les KPI toutes les 30 secondes
        setInterval(() => {
            if (this.kpiManager) {
                this.kpiManager.refreshAllKPIs();
            }
        }, 30000);

        console.log('[AppV2] Rafraîchissement automatique démarré');
    }

    /**
     * Ouvre les paramètres API
     */
    openSettings() {
        const dialog = document.getElementById('settings-dialog');
        if (dialog) {
            // Charger la configuration actuelle
            const apiBaseInput = document.getElementById('settings-api-base');
            if (apiBaseInput) {
                apiBaseInput.value = window.API_CONFIG?.baseUrl || '';
            }
            
            dialog.showModal();
        }
    }

    /**
     * Ferme un dialogue
     */
    closeDialog(dialog) {
        if (dialog) {
            dialog.close();
        }
    }

    /**
     * Bascule l'état d'une section collapsible
     */
    toggleCollapsible(trigger) {
        const section = trigger.closest('[data-collapsible-id]');
        if (!section) return;

        const content = section.querySelector('[data-collapsible-content]');
        if (!content) return;

        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
        
        // Animation simple
        content.style.transition = 'opacity 0.3s ease';
        content.style.opacity = isCollapsed ? '1' : '0';
        
        setTimeout(() => {
            if (isCollapsed) {
                content.style.opacity = '1';
            }
        }, 10);
    }

    /**
     * Met à jour le texte du loader
     */
    updateLoaderText(text) {
        const loaderText = document.getElementById('loader-text');
        if (loaderText) {
            loaderText.textContent = text;
        }
    }

    /**
     * Masque le loader
     */
    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.remove('active');
            // Optionnel: supprimer complètement le loader après l'animation
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }

    /**
     * Affiche une erreur
     */
    showError(message) {
        console.error('[AppV2]', message);
        // TODO: Implémenter l'affichage d'erreur dans l'UI
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.kpiManager) {
            this.kpiManager.destroy();
        }
        if (this.universalChartManager && typeof this.universalChartManager.destroy === 'function') {
            this.universalChartManager.destroy();
        }
        console.log('[AppV2] Ressources nettoyées');
    }
}

/**
 * Gestionnaire de KPI pour la version 2
 */
class KPIManager {
    constructor() {
        console.log('[KPIManager] 🏗️ Construction du KPIManager...');
        this.kpiData = {
            tr1: {},
            tr2: {}
        };
        this.refreshInterval = null;
        this.initKpiCards();
        this.startAutoRefresh();
        console.log('[KPIManager] ✅ KPIManager construit');
    }

    /**
     * Initialise les cartes KPI
     */
    initKpiCards() {
        console.log('[KPIManager] 🎨 Initialisation des cartes KPI...');
        
        // Initialiser TR1 - TOUS les KPI comme dans l'original
        console.log('[KPIManager] 🔧 Création des cartes TR1...');
        this.createKpiCards('tr1', [
            { id: 'p_kw', label: 'Puissance', unit: 'kW', icon: 'i-bolt', color: '#eab308' },
            { id: 'u1', label: 'U12', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'u2', label: 'U23', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'u3', label: 'U31', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'pf', label: 'Cos φ', unit: '', icon: 'i-pf', color: '#06b6d4' },
            { id: 'q_kvar', label: 'Réactive', unit: 'kvar', icon: 'i-bolt', color: '#3b82f6' },
            { id: 'i1', label: 'I1', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'i2', label: 'I2', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'i3', label: 'I3', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'e_kwh', label: 'Énergie', unit: 'MWh', icon: 'i-battery', color: '#6b7280' }
        ]);

        // Initialiser TR2 - TOUS les KPI comme dans l'original
        console.log('[KPIManager] 🔧 Création des cartes TR2...');
        this.createKpiCards('tr2', [
            { id: 'p_kw', label: 'Puissance', unit: 'kW', icon: 'i-bolt', color: '#eab308' },
            { id: 'u1', label: 'U12', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'u2', label: 'U23', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'u3', label: 'U31', unit: 'V', icon: 'i-wave', color: '#10b981' },
            { id: 'pf', label: 'Cos φ', unit: '', icon: 'i-pf', color: '#06b6d4' },
            { id: 'q_kvar', label: 'Réactive', unit: 'kvar', icon: 'i-bolt', color: '#3b82f6' },
            { id: 'i1', label: 'I1', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'i2', label: 'I2', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'i3', label: 'I3', unit: 'A', icon: 'i-gauge', color: '#f97316' },
            { id: 'e_kwh', label: 'Énergie', unit: 'MWh', icon: 'i-battery', color: '#6b7280' }
        ]);
        
        console.log('[KPIManager] ✅ Cartes KPI initialisées');
    }

    /**
     * Crée les cartes KPI pour un transformateur
     */
    createKpiCards(trId, kpiDefinitions) {
        console.log(`[KPIManager] 🎨 Création des cartes KPI pour ${trId}...`);
        
        const container = document.getElementById(`${trId}-kpis`);
        if (!container) {
            console.error(`[KPIManager] ❌ Container ${trId}-kpis non trouvé !`);
            return;
        }
        
        console.log(`[KPIManager] ✅ Container ${trId}-kpis trouvé`);
        container.innerHTML = '';

        kpiDefinitions.forEach((kpi, index) => {
            console.log(`[KPIManager] 🔧 Création carte ${index + 1}/${kpiDefinitions.length}: ${kpi.id}`);
            
            const card = document.createElement('div');
            card.className = 'tesla-card';
            card.style.cssText = `
                background: var(--tesla-glass);
                border: 1px solid var(--tesla-border);
                border-radius: var(--tesla-radius-md);
                padding: var(--tesla-space-md);
                text-align: center;
                transition: var(--tesla-transition);
            `;

            card.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: var(--tesla-space-sm);">
                    <svg class="icon stroke" style="width: 20px; height: 20px; color: ${kpi.color};" aria-hidden="true">
                        <use href="#${kpi.icon}" />
                    </svg>
                </div>
                <div style="font-size: 11px; color: var(--tesla-gray-300); margin-bottom: var(--tesla-space-xs);">${kpi.label}</div>
                <div id="${trId}-${kpi.id}-value" style="font-size: 18px; font-weight: 600; color: var(--tesla-white); margin-bottom: 2px;">--</div>
                <div style="font-size: 10px; color: var(--tesla-gray-400);">${kpi.unit}</div>
            `;

            container.appendChild(card);
            console.log(`[KPIManager] ✅ Carte ${kpi.id} créée avec ID: ${trId}-${kpi.id}-value`);
        });
        
        console.log(`[KPIManager] ✅ ${kpiDefinitions.length} cartes créées pour ${trId}`);
    }

    /**
     * Rafraîchit tous les KPI
     */
    async refreshAllKPIs() {
        console.log('[KPIManager] 🔄 Début rafraîchissement de tous les KPI...');
        try {
            await Promise.all([
                this.fetchKpiData('tr1'),
                this.fetchKpiData('tr2')
            ]);
            console.log('[KPIManager] ✅ Rafraîchissement terminé');
        } catch (error) {
            console.error('[KPIManager] ❌ Erreur rafraîchissement KPI:', error);
        }
    }

    /**
     * Récupère les données KPI pour un transformateur
     */
    async fetchKpiData(trId) {
        console.log(`[KPIManager] 🔄 Récupération données ${trId}...`);
        try {
            const url = `/api/energy/${trId}/snapshot`;
            console.log(`[KPIManager] 📡 Requête vers: ${url}`);
            
            const response = await fetch(url);
            console.log(`[KPIManager] 📊 Réponse ${trId}:`, {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[KPIManager] 📈 Données ${trId} reçues:`, data);
            
            this.updateKpiCards(trId, data);
            console.log(`[KPIManager] ✅ KPI ${trId} mis à jour`);
        } catch (error) {
            console.error(`[KPIManager] ❌ Erreur récupération données ${trId}:`, error);
        }
    }

    /**
     * Met à jour les cartes KPI
     */
    updateKpiCards(trId, data) {
        console.log(`[KPIManager] 🔄 Mise à jour cartes KPI ${trId}...`);
        console.log(`[KPIManager] 📊 Données reçues:`, data);
        
        const kpiMappings = {
            'p_kw': 'p_Kw',
            'u1': 'u12_V',
            'u2': 'u23_V', 
            'u3': 'u31_V',
            'pf': 'pf',
            'q_kvar': 'q_Kvar',
            'i1': 'i1_A',
            'i2': 'i2_A',
            'i3': 'i3_A',
            'e_kwh': 'e_Kwh'
        };

        Object.entries(kpiMappings).forEach(([kpiId, dataKey]) => {
            const element = document.getElementById(`${trId}-${kpiId}-value`);
            const rawValue = data[dataKey];
            
            console.log(`[KPIManager] 🔍 KPI ${kpiId}:`, {
                element: element ? 'trouvé' : 'non trouvé',
                dataKey: dataKey,
                rawValue: rawValue,
                elementId: `${trId}-${kpiId}-value`
            });
            
            if (element && rawValue !== undefined) {
                const value = this.formatKpiValue(rawValue, kpiId);
                element.textContent = value;
                console.log(`[KPIManager] ✅ ${kpiId} mis à jour: ${rawValue} → ${value}`);
            } else {
                console.log(`[KPIManager] ⚠️ ${kpiId} non mis à jour:`, {
                    elementExists: !!element,
                    valueExists: rawValue !== undefined
                });
            }
        });
    }

    /**
     * Formate une valeur KPI
     */
    formatKpiValue(value, kpiId) {
        if (value === null || value === undefined) return '--';
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '--';

        switch (kpiId) {
            case 'p_kw':
            case 'q_kvar':
                return numValue.toFixed(1);
            case 'u1':
            case 'u2':
            case 'u3':
                return numValue.toFixed(0);
            case 'pf':
                return numValue.toFixed(3);
            case 'i1':
            case 'i2':
            case 'i3':
                return numValue.toFixed(0);
            case 'e_kwh':
                return numValue.toFixed(1);
            default:
                return numValue.toFixed(1);
        }
    }

    /**
     * Démarre le rafraîchissement automatique
     */
    startAutoRefresh() {
        console.log('[KPIManager] 🚀 Démarrage du rafraîchissement automatique...');
        
        // Rafraîchir immédiatement
        console.log('[KPIManager] 🔄 Premier rafraîchissement immédiat...');
        this.refreshAllKPIs();
        
        // Puis toutes les 1 seconde
        this.refreshInterval = setInterval(() => {
            console.log('[KPIManager] ⏰ Rafraîchissement automatique (1s)...');
            this.refreshAllKPIs();
        }, 1000);
        
        console.log('[KPIManager] ✅ Rafraîchissement automatique configuré (1s)');
    }

    /**
     * Arrête le rafraîchissement automatique
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.stopAutoRefresh();
        console.log('[KPIManager] Ressources nettoyées');
    }
}

// Initialiser l'application quand le script est chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.appV2 = new AppV2();
    });
} else {
    // DOM déjà chargé
    window.appV2 = new AppV2();
}

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.appV2) {
        window.appV2.destroy();
    }
});
