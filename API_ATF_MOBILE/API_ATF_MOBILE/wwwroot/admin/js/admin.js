/**
 * Application principale d'administration
 */

import apiClient from './api-client.js';
import { initServerMonitor, updateServerMetrics } from './server-monitor.js';
import { initDatabaseManager, updateDatabaseStatus } from './database-manager.js';
import { initS7Manager, updateS7Status } from './s7-manager.js';
import { initLogsViewer, updateLogs } from './logs-viewer.js';
import { initConfigViewer } from './config-viewer.js';
import { initApiViewer } from './api-viewer.js';
import { initRequestsViewer, updateRequestsDisplay } from './requests-viewer.js';

// État global
const state = {
    currentSection: 'dashboard',
    pollingInterval: null,
    refreshRate: 1000, // Actualisation toutes les secondes
    charts: {},
    isRefreshing: false // Empêcher les rafraîchissements simultanés
};

// =========== INITIALISATION ===========

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Démarrage de l\'interface d\'administration');
    
    // SÉCURITÉ : Nettoyer toute ancienne session au chargement
    // Forcer la reconnexion à chaque visite
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    
    // Vérifier si l'utilisateur est déjà authentifié (toujours false après le nettoyage)
    if (apiClient.isAuthenticated()) {
        await showApp();
    } else {
        showLoginScreen();
    }
});

// =========== AUTHENTIFICATION ===========

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        errorDiv.classList.add('hidden');
        console.log('🔐 Tentative de connexion:', username);
        
        await apiClient.login(username, password);
        console.log('✅ Connexion réussie');
        
        await showApp();
    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
    }
}

async function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // Afficher l'utilisateur
    const user = apiClient.getCurrentUser();
    if (user) {
        document.getElementById('userDisplay').textContent = user.username;
    }
    
    // Initialiser l'application
    await initApp();
}

// =========== INITIALISATION APP ===========

async function initApp() {
    console.log('🎯 Initialisation de l\'application');
    
    // Event listeners
    initNavigation();
    initButtons();
    
    // Initialiser les modules
    initServerMonitor();
    initDatabaseManager();
    initS7Manager();
    initLogsViewer();
    initConfigViewer();
    initApiViewer();
    initRequestsViewer();
    
    // Charger le dashboard
    await loadDashboard();
    
    // Démarrer le polling
    startPolling();
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('href').replace('#', '');
            navigateToSection(section);
        });
    });
}

function initButtons() {
    // Bouton déconnexion
    document.getElementById('btnLogout').addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            stopPolling();
            apiClient.logout();
        }
    });
    
    // Bouton refresh
    document.getElementById('btnRefresh').addEventListener('click', async () => {
        await refreshCurrentSection();
    });
}

function navigateToSection(section) {
    console.log('📍 Navigation vers:', section);
    
    // Mettre à jour la navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active', 'bg-brand-500/20', 'text-brand-400');
        if (item.getAttribute('href') === `#${section}`) {
            item.classList.add('active', 'bg-brand-500/20', 'text-brand-400');
        }
    });
    
    // Cacher toutes les sections
    document.querySelectorAll('[id^="section-"]').forEach(s => {
        s.classList.add('hidden');
    });
    
    // Afficher la section sélectionnée
    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) {
        sectionEl.classList.remove('hidden');
    }
    
    // Mettre à jour le titre
    updatePageTitle(section);
    
    // Charger les données de la section
    state.currentSection = section;
    refreshCurrentSection();
}

function updatePageTitle(section) {
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Vue d\'ensemble du système' },
        server: { title: 'Serveur', subtitle: 'Informations et métriques' },
        database: { title: 'Bases de données', subtitle: 'État et statistiques' },
        s7: { title: 'PLC S7', subtitle: 'Connexion et variables' },
        logs: { title: 'Logs', subtitle: 'Journaux système' },
        config: { title: 'Configuration', subtitle: 'Paramètres actuels' },
        api: { title: 'API', subtitle: 'Contrôleurs et endpoints' },
        requests: { title: 'Requêtes API', subtitle: 'Historique et monitoring' }
    };
    
    const info = titles[section] || { title: section, subtitle: '' };
    document.getElementById('pageTitle').textContent = info.title;
    document.getElementById('pageSubtitle').textContent = info.subtitle;
}

async function refreshCurrentSection() {
    console.log('🔄 Rafraîchissement de la section:', state.currentSection);
    
    try {
        switch (state.currentSection) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'server':
                await updateServerMetrics();
                break;
            case 'database':
                await updateDatabaseStatus();
                break;
            case 's7':
                await updateS7Status();
                break;
            case 'logs':
                await updateLogs();
                break;
            case 'config':
                // Config est statique, pas besoin de rafraîchir
                break;
            case 'api':
                // API est statique, pas besoin de rafraîchir
                break;
            case 'requests':
                updateRequestsDisplay();
                break;
        }
    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
        showError(error.message);
    }
}

// =========== DASHBOARD ===========

async function loadDashboard() {
    console.log('📊 Chargement du dashboard');
    
    try {
        const data = await apiClient.getDashboard();
        
        // Récupérer les vraies connexions PLC avec test
        const plcConnections = await apiClient.getPlcConnections();
        
        // Mettre à jour les KPIs avec les vraies données PLC
        updateKPIs(data, plcConnections);
        
        // Mettre à jour les graphiques
        updateCharts(data);
        
        // Mettre à jour l'état des services avec les vraies données PLC
        updateServicesStatus(data, plcConnections);
        
        // Mettre à jour le statut global avec les vraies données PLC
        updateGlobalStatus(data, plcConnections);
        
    } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
        showError(error.message);
    }
}

function updateKPIs(data, plcConnections = []) {
    const metrics = data.serverMetrics;
    
    // CPU
    document.getElementById('kpiCpu').textContent = `${metrics.cpuUsagePercent.toFixed(1)}%`;
    
    // Mémoire
    document.getElementById('kpiMemory').textContent = `${metrics.memoryUsageMB.toFixed(0)} MB`;
    const memPercent = (metrics.memoryUsageMB / metrics.totalMemoryMB * 100).toFixed(1);
    document.getElementById('kpiMemoryPercent').textContent = memPercent;
    
    // Uptime
    const uptime = formatUptime(metrics.uptime);
    document.getElementById('kpiUptime').textContent = uptime;
    
    // Connexions - utiliser les vraies données PLC
    const dbConnected = data.databaseHealth.filter(db => db.isConnected).length;
    const dbTotal = data.databaseHealth.length;
    const plcConnected = plcConnections.filter(plc => plc.status === 'Connecté').length;
    const plcTotal = plcConnections.length;
    
    const totalConnected = dbConnected + plcConnected;
    const totalConnections = dbTotal + plcTotal;
    
    document.getElementById('kpiConnections').textContent = `${totalConnected}/${totalConnections}`;
    
    console.log('🔍 [KPI Connexions] BDD:', `${dbConnected}/${dbTotal}`, 'PLC:', `${plcConnected}/${plcTotal}`, 'Total:', `${totalConnected}/${totalConnections}`);
}

function updateCharts(data) {
    // Chart CPU & Mémoire
    updateCpuMemoryChart(data.serverMetrics);
    
    // Chart Logs
    updateLogsChart(data.logStats);
}

function updateCpuMemoryChart(metrics) {
    const ctx = document.getElementById('chartCpuMemory');
    if (!ctx) return;
    
    // Si le graphique existe déjà, mettre à jour les données
    if (state.charts.cpuMemory) {
        state.charts.cpuMemory.data.datasets[0].data = [
            metrics.cpuUsagePercent,
            (metrics.memoryUsageMB / metrics.totalMemoryMB * 100)
        ];
        state.charts.cpuMemory.update('none'); // 'none' = pas d'animation pour meilleures performances
        return;
    }
    
    // Créer le graphique la première fois seulement
    state.charts.cpuMemory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['CPU', 'Mémoire'],
            datasets: [{
                label: 'Utilisation (%)',
                data: [
                    metrics.cpuUsagePercent,
                    (metrics.memoryUsageMB / metrics.totalMemoryMB * 100)
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(59, 130, 246, 0.6)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(59, 130, 246, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Désactiver les animations pour de meilleures performances
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    min: 0, // Forcer le minimum aussi
                    ticks: { 
                        color: '#94a3b8',
                        stepSize: 20 // Fixer les paliers
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            }
        }
    });
}

function updateLogsChart(logStats) {
    const ctx = document.getElementById('chartLogs');
    if (!ctx) return;
    
    // Si le graphique existe déjà, mettre à jour les données
    if (state.charts.logs) {
        state.charts.logs.data.labels = [
            `Info (${logStats.infoCount})`,
            `Warning (${logStats.warningCount})`,
            `Error (${logStats.errorCount})`,
            `Critical (${logStats.criticalCount})`
        ];
        state.charts.logs.data.datasets[0].data = [
            logStats.infoCount,
            logStats.warningCount,
            logStats.errorCount,
            logStats.criticalCount
        ];
        state.charts.logs.update('none'); // 'none' = pas d'animation pour meilleures performances
        return;
    }
    
    // Créer le graphique la première fois seulement
    state.charts.logs = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `Info (${logStats.infoCount})`,
                `Warning (${logStats.warningCount})`,
                `Error (${logStats.errorCount})`,
                `Critical (${logStats.criticalCount})`
            ],
            datasets: [{
                data: [
                    logStats.infoCount,
                    logStats.warningCount,
                    logStats.errorCount,
                    logStats.criticalCount
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(251, 191, 36, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(127, 29, 29, 0.6)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(251, 191, 36, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(127, 29, 29, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Désactiver les animations pour de meilleures performances
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
}

function updateServicesStatus(data, plcConnections = []) {
    const container = document.getElementById('servicesStatus');
    if (!container) return;
    
    const services = [
        {
            name: 'Serveur',
            status: data.serverStatus.isRunning ? 'online' : 'offline',
            details: `${data.serverStatus.environment} - ${data.serverStatus.machineName}`
        },
        ...data.databaseHealth.map(db => ({
            name: `BDD ${db.connectionName}`,
            status: db.isConnected ? 'online' : 'offline',
            details: db.isConnected ? `${db.databaseName} (${db.responseTimeMs}ms)` : db.errorMessage
        }))
    ];
    
    // Ajouter les connexions PLC réelles avec test de connexion
    plcConnections.forEach(plc => {
        services.push({
            name: plc.name, // Utiliser le vrai nom (ex: "Concentrateur ATF")
            status: plc.status === 'Connecté' ? 'online' : 'offline',
            details: `${plc.ipAddress}:${plc.port} - ${plc.cpuType}`
        });
    });
    
    container.innerHTML = services.map(service => `
        <div class="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <div class="status-dot ${service.status}"></div>
            <div class="flex-1 min-w-0">
                <p class="font-medium">${service.name}</p>
                <p class="text-xs text-slate-400 truncate">${service.details}</p>
            </div>
        </div>
    `).join('');
}

function updateGlobalStatus(data, plcConnections = []) {
    const serverOk = data.serverStatus.isRunning;
    const databasesOk = data.databaseHealth.every(db => db.isConnected);
    const plcOk = plcConnections.length === 0 || plcConnections.every(plc => plc.status === 'Connecté');
    
    const allOk = serverOk && databasesOk && plcOk;
    
    const statusDot = document.getElementById('globalStatusDot');
    const statusText = document.getElementById('globalStatus');
    
    if (allOk) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'En ligne';
    } else {
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'Dégradé';
    }
    
    console.log('🔍 [Global Status] Serveur:', serverOk, 'BDD:', databasesOk, 'PLC:', plcOk, 'Résultat:', allOk ? 'En ligne' : 'Dégradé');
}

// =========== POLLING ===========

function startPolling() {
    console.log('▶️ Démarrage du polling automatique (intervalle: ' + state.refreshRate + 'ms)');
    stopPolling(); // Stop any existing interval
    
    state.pollingInterval = setInterval(async () => {
        // OPTIMISATION : Éviter les rafraîchissements simultanés
        if (state.isRefreshing) {
            console.log('⏭️ Rafraîchissement déjà en cours, skip');
            return;
        }
        
        state.isRefreshing = true;
        
        try {
            if (state.currentSection === 'dashboard') {
                await loadDashboard();
            } else if (state.currentSection === 'server') {
                await updateServerMetrics();
            } else if (state.currentSection === 'database') {
                await updateDatabaseStatus();
            } else if (state.currentSection === 's7') {
                await updateS7Status();
            } else if (state.currentSection === 'logs') {
                await updateLogs();
            } else if (state.currentSection === 'requests') {
                updateRequestsDisplay();
            }
        } catch (error) {
            console.error('Erreur lors du polling:', error);
        } finally {
            state.isRefreshing = false;
        }
    }, state.refreshRate);
}

function stopPolling() {
    if (state.pollingInterval) {
        console.log('⏸️ Arrêt du polling');
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }
}

// =========== UTILITAIRES ===========

function formatUptime(uptimeString) {
    // uptimeString format: "HH:MM:SS" ou objet TimeSpan
    if (typeof uptimeString === 'string') {
        return uptimeString;
    }
    
    const totalSeconds = uptimeString.totalSeconds || 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    const parts = [];
    if (days > 0) {
        parts.push(days === 1 ? '1 jour' : `${days} jours`);
    }
    if (hours > 0) {
        parts.push(hours === 1 ? '1 heure' : `${hours} heures`);
    }
    if (minutes > 0 && days === 0) { // Afficher les minutes seulement si moins d'un jour
        parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`);
    }
    if (seconds > 0 && days === 0 && hours === 0) { // Afficher les secondes seulement si moins d'une heure
        parts.push(seconds === 1 ? '1 seconde' : `${seconds} secondes`);
    }
    
    return parts.length > 0 ? parts.join(', ') : '0 seconde';
}

function showError(message) {
    // TODO: Implémenter un système de notification toast
    console.error('❌', message);
    alert(`Erreur: ${message}`);
}

// Export pour debug
window.adminState = state;
window.apiClient = apiClient;

