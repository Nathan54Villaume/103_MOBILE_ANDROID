/**
 * Module de visualisation des requêtes API
 */

import apiClient from './api-client.js';

export function initRequestsViewer() {
    console.log('📡 Initialisation du module Requests Viewer');
    
    // Boutons
    const btnClear = document.getElementById('btnClearRequests');
    const btnExport = document.getElementById('btnExportRequests');
    
    if (btnClear) {
        btnClear.addEventListener('click', clearRequests);
    }
    
    if (btnExport) {
        btnExport.addEventListener('click', exportRequests);
    }
    
    // Écouter les nouvelles requêtes
    window.addEventListener('api-request', handleNewRequest);
    
    // Rafraîchir l'affichage initial
    updateRequestsDisplay();
}

export function updateRequestsDisplay() {
    const requests = apiClient.getRequestLog();
    displayRequests(requests);
    updateStats(requests);
}

function handleNewRequest(event) {
    // Mettre à jour l'affichage quand une nouvelle requête arrive
    updateRequestsDisplay();
}

function displayRequests(requests) {
    const container = document.getElementById('requestsList');
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucune requête enregistrée</p>';
        return;
    }
    
    container.innerHTML = requests.map(req => {
        const statusColors = {
            success: 'bg-green-500/10 border-green-500/20 text-green-400',
            error: 'bg-red-500/10 border-red-500/20 text-red-400'
        };
        
        const colorClass = req.success ? statusColors.success : statusColors.error;
        
        const methodColors = {
            'GET': 'bg-blue-500/20 text-blue-400',
            'POST': 'bg-green-500/20 text-green-400',
            'PUT': 'bg-yellow-500/20 text-yellow-400',
            'DELETE': 'bg-red-500/20 text-red-400'
        };
        
        const methodColor = methodColors[req.method] || 'bg-slate-500/20 text-slate-400';
        
        const time = new Date(req.timestamp).toLocaleTimeString('fr-FR');
        const date = new Date(req.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        
        return `
            <div class="p-3 border ${colorClass.split(' ').slice(1).join(' ')} rounded-lg">
                <div class="flex items-start gap-3">
                    <span class="px-2 py-0.5 rounded text-xs font-mono ${methodColor}">
                        ${req.method}
                    </span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <p class="text-sm font-mono text-slate-200 truncate">${escapeHtml(req.endpoint)}</p>
                            <span class="px-1.5 py-0.5 rounded text-xs ${req.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                                ${req.status || 'ERR'}
                            </span>
                        </div>
                        ${req.error ? `
                            <p class="text-xs text-red-400 mt-1">❌ ${escapeHtml(req.error)}</p>
                        ` : ''}
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-xs font-medium ${req.duration < 100 ? 'text-green-400' : req.duration < 500 ? 'text-yellow-400' : 'text-red-400'}">
                            ${req.duration}ms
                        </p>
                        <p class="text-xs text-slate-500 whitespace-nowrap">${date} ${time}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats(requests) {
    const total = requests.length;
    const success = requests.filter(r => r.success).length;
    const errors = total - success;
    const avgTime = total > 0 
        ? Math.round(requests.reduce((sum, r) => sum + r.duration, 0) / total)
        : 0;
    
    // Mettre à jour les stats
    const statsTotal = document.getElementById('reqStatsTotal');
    const statsSuccess = document.getElementById('reqStatsSuccess');
    const statsError = document.getElementById('reqStatsError');
    const statsAvgTime = document.getElementById('reqStatsAvgTime');
    
    if (statsTotal) statsTotal.textContent = total;
    if (statsSuccess) statsSuccess.textContent = success;
    if (statsError) statsError.textContent = errors;
    if (statsAvgTime) statsAvgTime.textContent = `${avgTime}ms`;
}

function clearRequests() {
    if (confirm('Voulez-vous vraiment vider l\'historique des requêtes ?')) {
        apiClient.clearRequestLog();
        updateRequestsDisplay();
        console.log('🗑️ Historique des requêtes vidé');
    }
}

function exportRequests() {
    const requests = apiClient.getRequestLog();
    
    if (requests.length === 0) {
        alert('Aucune requête à exporter');
        return;
    }
    
    // Créer le CSV
    const headers = ['Date', 'Heure', 'Méthode', 'Endpoint', 'Status', 'Durée (ms)', 'Succès', 'Erreur'];
    const rows = requests.map(req => {
        const date = new Date(req.timestamp);
        return [
            date.toLocaleDateString('fr-FR'),
            date.toLocaleTimeString('fr-FR'),
            req.method,
            req.endpoint,
            req.status,
            req.duration,
            req.success ? 'Oui' : 'Non',
            req.error || ''
        ];
    });
    
    const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
    
    // Télécharger le fichier
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.href = URL.createObjectURL(blob);
    link.download = `requetes-api-${timestamp}.csv`;
    link.click();
    
    console.log('📥 Export CSV réussi:', requests.length, 'requêtes');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

