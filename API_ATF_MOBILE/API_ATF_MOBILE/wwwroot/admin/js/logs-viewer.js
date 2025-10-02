/**
 * Module de visualisation des logs
 */

import apiClient from './api-client.js';

let searchTimeout = null;

export function initLogsViewer() {
    console.log('📝 Initialisation du module Logs Viewer');
    
    // Filtre par niveau
    const levelSelect = document.getElementById('logLevel');
    if (levelSelect) {
        levelSelect.addEventListener('change', updateLogs);
    }
    
    // Recherche
    const searchInput = document.getElementById('logSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchLogs(e.target.value);
            }, 500);
        });
    }
}

export async function updateLogs() {
    const levelSelect = document.getElementById('logLevel');
    const level = levelSelect?.value || null;
    
    try {
        const logs = await apiClient.getLogs(200, level);
        displayLogs(logs);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des logs:', error);
        throw error;
    }
}

async function searchLogs(searchTerm) {
    if (!searchTerm) {
        await updateLogs();
        return;
    }
    
    try {
        const logs = await apiClient.searchLogs(searchTerm, 100);
        displayLogs(logs);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
    }
}

function displayLogs(logs) {
    const container = document.getElementById('logsList');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucun log trouvé</p>';
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const levelColors = {
            'Information': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            'Warning': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
            'Error': 'text-red-400 bg-red-500/10 border-red-500/20',
            'Critical': 'text-red-600 bg-red-500/20 border-red-500/30'
        };
        
        const colorClass = levelColors[log.level] || 'text-slate-400 bg-white/5 border-white/10';
        const time = new Date(log.timestamp).toLocaleTimeString('fr-FR');
        
        return `
            <div class="p-3 border ${colorClass.split(' ').slice(1).join(' ')} rounded-lg">
                <div class="flex items-start gap-3">
                    <span class="px-2 py-1 rounded text-xs font-mono ${colorClass.split(' ')[0]} bg-black/20">
                        ${log.level}
                    </span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-200">${escapeHtml(log.message)}</p>
                        ${log.exception ? `
                            <details class="mt-2">
                                <summary class="text-xs text-slate-400 cursor-pointer">Exception</summary>
                                <pre class="mt-2 text-xs text-slate-300 overflow-x-auto">${escapeHtml(log.exception)}</pre>
                            </details>
                        ` : ''}
                    </div>
                    <span class="text-xs text-slate-500 whitespace-nowrap">${time}</span>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

