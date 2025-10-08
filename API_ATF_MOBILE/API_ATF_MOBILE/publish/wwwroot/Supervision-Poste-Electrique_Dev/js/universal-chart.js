/**
 * Gestionnaire de la courbe universelle
 * Permet de sélectionner et afficher n'importe quel signal disponible
 */
class UniversalChartManager {
    constructor() {
        console.log('[UniversalChart] 🏗️ Construction du UniversalChartManager...');
        this.chart = null;
        this.currentSignal = null;
        this.availableSignals = [];
        this.isRefreshing = false;
        this.refreshInterval = null;
        
        // Attendre que Chart.js soit disponible
        this.waitForChart();
    }

    /**
     * Attend que Chart.js soit chargé
     */
    waitForChart() {
        if (typeof Chart !== 'undefined') {
            console.log('[UniversalChart] ✅ Chart.js trouvé, initialisation...');
            this.initializeChart();
            this.loadAvailableSignals();
            this.setupEventListeners();
        } else {
            console.log('[UniversalChart] ⏳ Attente de Chart.js...');
            // Réessayer dans 100ms
            setTimeout(() => this.waitForChart(), 100);
        }
    }

    /**
     * Initialise le graphique Chart.js
     */
    initializeChart() {
        console.log('[UniversalChart] 🎨 Initialisation du graphique...');
        const ctx = document.getElementById('universal-chart');
        if (!ctx) {
            console.error('[UniversalChart] ❌ Canvas universal-chart non trouvé');
            return;
        }
        console.log('[UniversalChart] ✅ Canvas universal-chart trouvé');

        // Détruire le graphique existant s'il y en a un
        if (this.chart) {
            console.log('[UniversalChart] 🗑️ Destruction du graphique existant');
            this.chart.destroy();
            this.chart = null;
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(23, 23, 23, 0.98)',
                        titleColor: '#ffffff',
                        bodyColor: '#d1d5db',
                        borderColor: 'rgba(82, 82, 91, 0.5)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'dd/MM'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a8a',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a8a',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 11
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 4
                    },
                    line: {
                        borderWidth: 2,
                        tension: 0.1
                    }
                }
            }
        });
        
        console.log('[UniversalChart] ✅ Graphique Chart.js créé avec succès');
    }

    /**
     * Charge la liste des signaux disponibles
     */
    async loadAvailableSignals() {
        console.log('[UniversalChart] 🔄 Chargement des signaux disponibles...');
        try {
            const response = await fetch('/api/energy/signals');
            console.log('[UniversalChart] 📡 Réponse API signals:', response.status, response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.availableSignals = await response.json();
            console.log('[UniversalChart] 📈 Signaux reçus:', this.availableSignals);
            this.populateSignalSelector();
        } catch (error) {
            console.error('[UniversalChart] ❌ Erreur chargement signaux:', error);
            console.log('[UniversalChart] 🔧 Utilisation des signaux par défaut...');
            this.loadDefaultSignals();
        }
    }

    /**
     * Charge une liste de signaux par défaut
     */
    loadDefaultSignals() {
        console.log('[UniversalChart] 🎯 Création des signaux par défaut...');
        this.availableSignals = [
            { id: 'P_TR1', label: 'Puissance Active TR1', unit: 'kW' },
            { id: 'Q_TR1', label: 'Puissance Réactive TR1', unit: 'kvar' },
            { id: 'U12_TR1', label: 'Tension U12 TR1', unit: 'V' },
            { id: 'U23_TR1', label: 'Tension U23 TR1', unit: 'V' },
            { id: 'U31_TR1', label: 'Tension U31 TR1', unit: 'V' },
            { id: 'I1_TR1', label: 'Courant I1 TR1', unit: 'A' },
            { id: 'I2_TR1', label: 'Courant I2 TR1', unit: 'A' },
            { id: 'I3_TR1', label: 'Courant I3 TR1', unit: 'A' },
            { id: 'PF_TR1', label: 'Facteur de Puissance TR1', unit: '' },
            { id: 'E_TR1', label: 'Énergie TR1', unit: 'MWh' },
            { id: 'P_TR2', label: 'Puissance Active TR2', unit: 'kW' },
            { id: 'Q_TR2', label: 'Puissance Réactive TR2', unit: 'kvar' },
            { id: 'U12_TR2', label: 'Tension U12 TR2', unit: 'V' },
            { id: 'U23_TR2', label: 'Tension U23 TR2', unit: 'V' },
            { id: 'U31_TR2', label: 'Tension U31 TR2', unit: 'V' },
            { id: 'I1_TR2', label: 'Courant I1 TR2', unit: 'A' },
            { id: 'I2_TR2', label: 'Courant I2 TR2', unit: 'A' },
            { id: 'I3_TR2', label: 'Courant I3 TR2', unit: 'A' },
            { id: 'PF_TR2', label: 'Facteur de Puissance TR2', unit: '' },
            { id: 'E_TR2', label: 'Énergie TR2', unit: 'MWh' }
        ];
        console.log('[UniversalChart] ✅ Signaux par défaut créés:', this.availableSignals.length);
        this.populateSignalSelector();
    }

    /**
     * Remplit le sélecteur de signaux
     */
    populateSignalSelector() {
        console.log('[UniversalChart] 🎨 Remplissage du sélecteur de signaux...');
        const selector = document.getElementById('universal-signal-selector');
        if (!selector) {
            console.error('[UniversalChart] ❌ Sélecteur universal-signal-selector non trouvé');
            return;
        }
        console.log('[UniversalChart] ✅ Sélecteur trouvé');

        // Vider le sélecteur (garder l'option par défaut)
        selector.innerHTML = '<option value="">Sélectionner un signal...</option>';

        // Ajouter les signaux disponibles
        console.log('[UniversalChart] 📝 Ajout de', this.availableSignals.length, 'signaux...');
        this.availableSignals.forEach((signal, index) => {
            const option = document.createElement('option');
            option.value = signal.id;
            option.textContent = signal.label;
            selector.appendChild(option);
            console.log(`[UniversalChart] ✅ Signal ${index + 1}: ${signal.id} - ${signal.label}`);
        });
        
        console.log('[UniversalChart] ✅ Sélecteur rempli avec', this.availableSignals.length, 'signaux');
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Sélecteur de signal
        const signalSelector = document.getElementById('universal-signal-selector');
        if (signalSelector) {
            signalSelector.addEventListener('change', (e) => {
                this.onSignalChange(e.target.value);
            });
        }

        // Sélecteur de période
        const timeSelector = document.getElementById('universal-time-selector');
        if (timeSelector) {
            timeSelector.addEventListener('change', (e) => {
                this.onTimeRangeChange(e.target.value);
            });
        }

        // Bouton reset
        const resetBtn = document.getElementById('universal-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetChart();
            });
        }

        // Bouton settings
        const settingsBtn = document.getElementById('universal-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }
    }

    /**
     * Gère le changement de signal
     */
    async onSignalChange(signalId) {
        console.log('[UniversalChart] 🔄 Changement de signal:', signalId);
        
        if (!signalId) {
            console.log('[UniversalChart] 🛑 Aucun signal sélectionné, arrêt du polling');
            this.stopPolling();
            this.clearChart();
            return;
        }

        this.currentSignal = this.availableSignals.find(s => s.id === signalId);
        if (!this.currentSignal) {
            console.error('[UniversalChart] ❌ Signal non trouvé:', signalId);
            return;
        }

        console.log('[UniversalChart] ✅ Signal sélectionné:', this.currentSignal.label);
        await this.loadSignalData();
        
        // Démarrer le polling automatique
        this.startPolling();
    }

    /**
     * Gère le changement de période
     */
    async onTimeRangeChange(minutes) {
        if (this.currentSignal) {
            await this.loadSignalData();
        }
    }

    /**
     * Charge les données du signal sélectionné
     */
    async loadSignalData() {
        if (!this.currentSignal || this.isRefreshing) return;

        console.log('[UniversalChart] 🔄 Chargement des données pour:', this.currentSignal.id);
        this.isRefreshing = true;
        this.updateStatus('Chargement...');

        try {
            // Déterminer le transformateur et récupérer ses données
            const trId = this.currentSignal.id.includes('TR1') ? 'tr1' : 'tr2';
            console.log('[UniversalChart] 📡 Récupération des données', trId);
            
            const response = await fetch(`/api/energy/${trId}/snapshot`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[UniversalChart] 📈 Données reçues:', data);
            this.updateChartWithData(data);
            this.updateStatus('Connecté');
        } catch (error) {
            console.error('[UniversalChart] ❌ Erreur chargement données:', error);
            this.showError('Erreur lors du chargement des données');
            this.updateStatus('Erreur');
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Met à jour le graphique avec les nouvelles données
     */
    updateChartWithData(data) {
        if (!this.chart || !this.currentSignal) {
            console.warn('[UniversalChart] Graphique ou signal manquant');
            return;
        }

        console.log('[UniversalChart] 🎨 Mise à jour du graphique avec:', this.currentSignal.id);

        // Mapper les clés de données selon le type de signal
        const signalMapping = {
            'P_TR1': 'p_Kw',
            'P_TR2': 'p_Kw',
            'Q_TR1': 'q_Kvar',
            'Q_TR2': 'q_Kvar',
            'U12_TR1': 'u12_V',
            'U12_TR2': 'u12_V',
            'U23_TR1': 'u23_V',
            'U23_TR2': 'u23_V',
            'U31_TR1': 'u31_V',
            'U31_TR2': 'u31_V',
            'I1_TR1': 'i1_A',
            'I1_TR2': 'i1_A',
            'I2_TR1': 'i2_A',
            'I2_TR2': 'i2_A',
            'I3_TR1': 'i3_A',
            'I3_TR2': 'i3_A',
            'PF_TR1': 'pf',
            'PF_TR2': 'pf',
            'E_TR1': 'e_Kwh',
            'E_TR2': 'e_Kwh'
        };

        const signalKey = signalMapping[this.currentSignal.id];
        console.log('[UniversalChart] 🔍 Clé de données:', signalKey);
        
        if (!signalKey || data[signalKey] === undefined) {
            console.warn('[UniversalChart] ❌ Données non trouvées pour:', this.currentSignal.id, 'clé:', signalKey);
            return;
        }

        const signalValue = data[signalKey];
        console.log('[UniversalChart] 📊 Valeur trouvée:', signalValue);

        // Créer un point de données avec l'horodatage actuel
        const now = new Date();
        const colors = this.getSignalColor(this.currentSignal.id);

        // Mettre à jour le graphique avec un seul point
        this.chart.data.labels = [now];
        this.chart.data.datasets = [{
            label: this.currentSignal.label,
            data: [{ x: now, y: signalValue }],
            borderColor: colors.primary,
            backgroundColor: colors.background,
            borderWidth: 2,
            pointRadius: 4,
            fill: false,
            tension: 0.1
        }];

        this.chart.options.scales.y.title.text = `${this.currentSignal.label} ${this.currentSignal.unit ? `(${this.currentSignal.unit})` : ''}`;
        this.chart.update();
        
        console.log('[UniversalChart] ✅ Graphique mis à jour');
    }

    /**
     * Retourne la couleur appropriée pour un signal
     */
    getSignalColor(signalId) {
        const colorMap = {
            'P_TR1': { primary: '#eab308', background: 'rgba(234, 179, 8, 0.1)' },
            'P_TR2': { primary: '#eab308', background: 'rgba(234, 179, 8, 0.1)' },
            'Q_TR1': { primary: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' },
            'Q_TR2': { primary: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' },
            'U12_TR1': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'U23_TR1': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'U31_TR1': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'U12_TR2': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'U23_TR2': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'U31_TR2': { primary: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
            'PF_TR1': { primary: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' },
            'PF_TR2': { primary: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' }
        };

        return colorMap[signalId] || { primary: '#8a8a8a', background: 'rgba(138, 138, 138, 0.1)' };
    }

    /**
     * Vide le graphique
     */
    clearChart() {
        if (!this.chart) return;

        this.chart.data.labels = [];
        this.chart.data.datasets = [];
        this.chart.update('none');
    }

    /**
     * Réinitialise le graphique
     */
    resetChart() {
        this.clearChart();
        this.currentSignal = null;
        
        // Réinitialiser le sélecteur
        const selector = document.getElementById('universal-signal-selector');
        if (selector) {
            selector.value = '';
        }
    }

    /**
     * Ouvre les paramètres du graphique
     */
    openSettings() {
        // TODO: Implémenter l'ouverture des paramètres
        console.log('[UniversalChart] Ouverture des paramètres');
    }

    /**
     * Met à jour le statut de connexion
     */
    updateStatus(status) {
        console.log('[UniversalChart] 📊 Statut:', status);
        // TODO: Implémenter l'affichage du statut dans l'UI
    }

    /**
     * Affiche une erreur
     */
    showError(message) {
        console.error('[UniversalChart] ❌ Erreur:', message);
        // TODO: Implémenter l'affichage d'erreur dans l'UI
    }

    /**
     * Démarre le polling automatique pour le signal sélectionné
     */
    startPolling() {
        console.log('[UniversalChart] 🚀 Démarrage du polling automatique...');
        this.stopPolling(); // Arrêter le polling existant
        
        if (this.currentSignal) {
            // Polling toutes les 1 seconde
            this.refreshInterval = setInterval(() => {
                console.log('[UniversalChart] ⏰ Polling automatique...');
                this.loadSignalData();
            }, 1000);
            console.log('[UniversalChart] ✅ Polling configuré (1s)');
        }
    }

    /**
     * Arrête le polling automatique
     */
    stopPolling() {
        if (this.refreshInterval) {
            console.log('[UniversalChart] 🛑 Arrêt du polling...');
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.stopPolling();
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        console.log('[UniversalChart] 🗑️ Ressources nettoyées');
    }
}

// Initialiser le gestionnaire de courbe universelle
document.addEventListener('DOMContentLoaded', () => {
    // Attendre un peu pour s'assurer que tous les scripts sont chargés
    setTimeout(() => {
        if (!window.universalChartManager) {
            window.universalChartManager = new UniversalChartManager();
        }
    }, 500);
});
