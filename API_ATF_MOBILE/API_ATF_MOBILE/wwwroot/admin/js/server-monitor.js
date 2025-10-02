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
    if (typeof duration === 'string') return duration;
    
    const totalSeconds = duration.totalSeconds || 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ') || '0s';
}

