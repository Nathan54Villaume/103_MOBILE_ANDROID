/**
 * Module de monitoring serveur
 */

import apiClient from './api-client.js';

export function initServerMonitor() {
    console.log('💻 Initialisation du module Server Monitor');
}

export async function updateServerMetrics() {
    try {
        const [status, metrics] = await Promise.all([
            apiClient.getServerStatus(),
            apiClient.getServerMetrics()
        ]);
        
        displayServerInfo(status, metrics);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des métriques serveur:', error);
        throw error;
    }
}

function displayServerInfo(status, metrics) {
    const container = document.getElementById('serverInfo');
    if (!container) return;
    
    const info = [
        { label: 'Machine', value: status.machineName },
        { label: 'Système', value: status.osVersion },
        { label: 'Framework', value: status.frameworkVersion },
        { label: 'Environnement', value: status.environment },
        { label: 'Processeurs', value: status.processorCount },
        { label: 'Démarré le', value: new Date(status.startTime).toLocaleString('fr-FR') },
        { label: 'Uptime', value: formatDuration(metrics.uptime) },
        { label: 'CPU', value: `${metrics.cpuUsagePercent.toFixed(2)}%` },
        { label: 'Mémoire utilisée', value: `${metrics.memoryUsageMB.toFixed(0)} MB` },
        { label: 'Mémoire totale', value: `${metrics.totalMemoryMB.toFixed(0)} MB` },
        { label: 'Threads', value: metrics.threadCount },
        { label: 'Handles', value: metrics.handleCount }
    ];
    
    container.innerHTML = info.map(item => `
        <div class="flex justify-between items-center py-2 border-b border-white/5">
            <span class="text-slate-400 text-sm">${item.label}</span>
            <span class="font-medium">${item.value}</span>
        </div>
    `).join('');
}

export function formatDuration(duration) {
    let totalSeconds = 0;
    
    // Gérer les différents formats d'uptime
    if (typeof duration === 'string') {
        // Format TimeSpan .NET: "00:00:25.0335953" ou "1.02:03:04.123"
        const parts = duration.split('.');
        let timeStr = parts[0];
        
        // Si format avec jours: "1.02:03:04"
        if (parts.length > 1 && parts[0].includes(':') === false) {
            const days = parseInt(parts[0]);
            timeStr = parts[1];
            totalSeconds += days * 86400;
        }
        
        // Parser HH:MM:SS
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 3) {
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            const seconds = parseInt(timeParts[2]) || 0;
            totalSeconds += hours * 3600 + minutes * 60 + seconds;
        }
    } else if (duration && typeof duration === 'object' && duration.totalSeconds) {
        // Format objet avec totalSeconds
        totalSeconds = duration.totalSeconds;
    }
    
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    
    // Format dd:HH:mm:ss
    const dd = String(days).padStart(2, '0');
    const HH = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    
    return `${dd}:${HH}:${mm}:${ss}`;
}

