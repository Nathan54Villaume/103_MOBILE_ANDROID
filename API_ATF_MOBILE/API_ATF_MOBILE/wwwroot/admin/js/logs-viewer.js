/**
 * Module de visualisation des logs - Event Viewer
 * EXTENSION: Ajout Play/Stop, virtualisation, filtres dynamiques, détails extensibles
 */

import apiClient from './api-client.js';
import logService from './log-service.js';

let searchTimeout = null;
let expandedLogId = null;
let virtualScroller = null;

// EXTENSION: Initialisation du viewer Event Viewer
export function initLogsViewer() {
    console.log('📝 Initialisation du module Event Viewer');
    
    // S'abonner aux changements du service AVANT de charger
    logService.subscribe(handleLogServiceEvent);
    
    // Initialiser les contrôles
    initControls();
    
    // Initialiser les filtres dynamiques
    initFilters();
    
    // Afficher l'état initial avec message de chargement
    renderLogs();
    updateCounters();
    updatePlayStopButtons();
    
    // Charger les logs initiaux (après avoir configuré l'UI)
    setTimeout(() => {
        console.log('🔄 Chargement des logs initiaux...');
        logService.loadInitialLogs();
    }, 100);
}

// EXTENSION: Gérer les événements du service de logs
function handleLogServiceEvent(event) {
    console.log('📡 Event:', event.type, event);
    
    switch (event.type) {
        case 'stateChanged':
            updatePlayStopButtons();
            break;
        case 'logsLoaded':
        case 'logsUpdated':
        case 'filtersApplied':
            renderLogs();
            updateCounters();
            updateFacetsUI();
            break;
        case 'logsCleared':
            renderLogs();
            updateCounters();
            updateFacetsUI();
            break;
        case 'filtersReset':
            updateFiltersUI();
            break;
    }
}

// EXTENSION: Initialiser les contrôles (Play, Stop, Clear, Export)
function initControls() {
    console.log('🎮 Initialisation des contrôles...');
    
    // Bouton Play
    const btnPlay = document.getElementById('btnLogPlay');
    if (btnPlay) {
        console.log('✅ Bouton Play trouvé');
        btnPlay.addEventListener('click', () => {
            console.log('▶️ Clic sur Play');
            logService.start();
        });
    } else {
        console.error('❌ Bouton Play non trouvé');
    }
    
    // Bouton Stop
    const btnStop = document.getElementById('btnLogStop');
    if (btnStop) {
        console.log('✅ Bouton Stop trouvé');
        btnStop.addEventListener('click', () => {
            console.log('⏸️ Clic sur Stop');
            logService.stop();
        });
    } else {
        console.error('❌ Bouton Stop non trouvé');
    }
    
            // Bouton Effacer
            const btnClear = document.getElementById('btnLogClear');
            if (btnClear) {
                console.log('✅ Bouton Clear trouvé');
                btnClear.addEventListener('click', () => {
                    console.log('🗑️ Clic sur Clear');
                    if (confirm('Effacer tous les logs de la vue locale ?')) {
                        logService.clearLocal();
                    }
                });
            } else {
                console.error('❌ Bouton Clear non trouvé');
            }
            
            // Bouton Rafraîchir (si présent)
            const btnRefresh = document.getElementById('btnLogRefresh');
            if (btnRefresh) {
                console.log('✅ Bouton Refresh trouvé');
                btnRefresh.addEventListener('click', () => {
                    console.log('🔄 Clic sur Refresh');
                    logService.forceRefresh();
                });
            }
            
    
    // Bouton Exporter CSV
    const btnExportCsv = document.getElementById('btnLogExportCsv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            console.log('📊 Export CSV');
            logService.exportCsv();
        });
    }
    
    // Bouton Exporter JSON
    const btnExportJson = document.getElementById('btnLogExportJson');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            console.log('📄 Export JSON');
            logService.exportJson();
        });
    }
    
    // Bouton Réinitialiser filtres
    const btnResetFilters = document.getElementById('btnResetFilters');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            console.log('🔄 Reset filtres');
            logService.resetFilters();
        });
    }
    
    // État initial: Stop actif
    updatePlayStopButtons();
}

// EXTENSION: Mettre à jour l'état des boutons Play/Stop
function updatePlayStopButtons() {
    const btnPlay = document.getElementById('btnLogPlay');
    const btnStop = document.getElementById('btnLogStop');
    const state = logService.getState();
    
    if (btnPlay && btnStop) {
        if (state.isPlaying) {
            btnPlay.classList.add('opacity-50', 'cursor-not-allowed');
            btnPlay.disabled = true;
            btnStop.classList.remove('opacity-50', 'cursor-not-allowed');
            btnStop.disabled = false;
        } else {
            btnPlay.classList.remove('opacity-50', 'cursor-not-allowed');
            btnPlay.disabled = false;
            btnStop.classList.add('opacity-50', 'cursor-not-allowed');
            btnStop.disabled = true;
        }
    }
}

// EXTENSION: Initialiser les filtres dynamiques
function initFilters() {
    // Recherche plein texte avec debounce
    const searchInput = document.getElementById('logSearchText');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                logService.setFilter('searchText', e.target.value);
            }, 300);
        });
    }
    
    // Option regex
}

// EXTENSION: Mettre à jour l'UI des filtres
function updateFiltersUI() {
    // Réinitialiser tous les checkboxes
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    // Réinitialiser la recherche
    const searchInput = document.getElementById('logSearchText');
    if (searchInput) searchInput.value = '';
}

// EXTENSION: Mettre à jour les compteurs
function updateCounters() {
    const state = logService.getState();
    
    const counterEl = document.getElementById('logCounter');
    if (counterEl) {
        const statusIcon = state.isPlaying ? '🟢' : '🔴';
        const statusText = state.isPlaying ? 'LIVE' : 'STOP';
        counterEl.textContent = `${statusIcon} ${state.displayedCount} / ${state.totalCount} (${statusText})`;
    }
}

// EXTENSION: Mettre à jour l'UI des facettes
function updateFacetsUI() {
    const state = logService.getState();
    const facets = state.facets;
    
    // Mettre à jour les compteurs des facettes dans l'UI
    // (Sera implémenté dans index.html)
    console.log('Facettes:', facets);
}

// EXTENSION: Rendre les logs avec virtualisation simple
function renderLogs() {
    console.log('🖼️ Rendu des logs...');
    const container = document.getElementById('logsList');
    if (!container) {
        console.error('❌ Container logsList non trouvé');
        return;
    }
    
    const logs = logService.getDisplayedLogs();
    console.log('📊 Logs à afficher:', logs.length, logs);
    
            if (logs.length === 0) {
                console.log('📭 Aucun log à afficher');
                const state = logService.getState();
                const message = state.isPlaying 
                    ? 'En attente de nouveaux logs de l\'API... (Mode Play actif - Vérifiez que l\'application génère des logs)'
                    : 'Aucun log disponible. Cliquez sur "Actualiser" pour recharger ou "Play" pour surveiller les nouveaux logs de l\'API.';
                container.innerHTML = `<p class="text-center text-slate-400 py-8">${message}</p>`;
                return;
            }
    
    // Virtualisation simple: afficher seulement les premiers 500 (optimisation basique)
    const visibleLogs = logs.slice(0, 500);
    console.log('👁️ Logs visibles:', visibleLogs.length);
    
    // Générer le HTML avec les logs
    const logsHtml = visibleLogs.map(log => renderLogRow(log)).join('');
    console.log('📝 HTML généré, longueur:', logsHtml.length);
    
    container.innerHTML = logsHtml;
    console.log('✅ HTML injecté dans le container');
    
    // Ajouter les écouteurs pour les détails extensibles
    const logRows = container.querySelectorAll('.log-row');
    console.log('🎯 Lignes de logs trouvées:', logRows.length);
    
    logRows.forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.copy-btn')) return; // Ignorer le clic sur bouton Copier
            
            const logId = row.dataset.logId;
            console.log('🖱️ Clic sur log:', logId);
            toggleLogDetails(logId);
        });
    });
}

// EXTENSION: Rendre une ligne de log (format Event Viewer - COMPACT)
function renderLogRow(log) {
    const severityIcons = {
        'info': '🟢',
        'warn': '🟡',
        'error': '🔴'
    };
    
    const severityColors = {
        'info': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        'warn': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        'error': 'text-red-400 bg-red-500/10 border-red-500/20'
    };
    
    const icon = severityIcons[log.severity] || '⚪';
    const colorClass = severityColors[log.severity] || 'text-slate-400 bg-white/5 border-white/10';
    
    const timestamp = new Date(log.ts);
    const timeStr = timestamp.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
    });
    
    const httpInfo = log.http 
        ? `<span class="text-xs text-slate-400">${log.http.method} → ${log.http.status}</span>`
        : '';
    
    const durationInfo = log.http?.durationMs 
        ? `<span class="text-xs text-slate-500">${log.http.durationMs}ms</span>`
        : '';
    
    const isExpanded = expandedLogId === log.id;
    
    return `
        <div class="log-row px-2 py-1 border ${colorClass.split(' ').slice(1).join(' ')} rounded cursor-pointer hover:bg-white/5 transition-colors" 
             data-log-id="${log.id}">
            <div class="flex items-center gap-2">
                <span class="text-sm">${icon}</span>
                <div class="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center text-xs">
                    <div class="col-span-1 font-mono text-slate-300">${timeStr}</div>
                    <div class="col-span-1 text-slate-400">${log.source}</div>
                    <div class="col-span-2">${httpInfo}</div>
                    <div class="col-span-6 text-slate-200 truncate">${escapeHtml(log.message)}</div>
                    <div class="col-span-2 text-right">${durationInfo}</div>
                </div>
            </div>
            ${isExpanded ? renderLogDetails(log) : ''}
        </div>
    `;
}

// EXTENSION: Rendre les détails extensibles d'un log
function renderLogDetails(log) {
    const details = [];
    
    if (log.details.exception) {
        details.push(`<div class="mt-2"><strong>Exception:</strong><pre class="text-xs bg-black/30 p-2 rounded mt-1 overflow-x-auto">${escapeHtml(log.details.exception)}</pre></div>`);
    }
    
    if (log.http) {
        details.push(`<div class="mt-2"><strong>HTTP:</strong> ${log.http.method} ${log.http.url} → ${log.http.status} (${log.http.durationMs}ms)</div>`);
    }
    
    if (log.details.req) {
        details.push(`<div class="mt-2"><strong>Request:</strong><pre class="text-xs bg-black/30 p-2 rounded mt-1 overflow-x-auto">${escapeHtml(JSON.stringify(log.details.req, null, 2))}</pre></div>`);
    }
    
    if (log.details.resp) {
        details.push(`<div class="mt-2"><strong>Response:</strong><pre class="text-xs bg-black/30 p-2 rounded mt-1 overflow-x-auto">${escapeHtml(JSON.stringify(log.details.resp, null, 2))}</pre></div>`);
    }
    
    const detailsJson = JSON.stringify(log, null, 2);
    
    return `
        <div class="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300">
            ${details.join('')}
            <div class="mt-3 flex gap-2">
                <button class="copy-btn px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors" 
                        onclick="navigator.clipboard.writeText(\`${escapeHtml(detailsJson).replace(/`/g, '\\`')}\`)">
                    📋 Copier JSON
                </button>
            </div>
        </div>
    `;
}

// EXTENSION: Basculer l'affichage des détails
function toggleLogDetails(logId) {
    if (expandedLogId === logId) {
        expandedLogId = null;
    } else {
        expandedLogId = logId;
    }
    renderLogs();
}

// COMPATIBILITÉ: Maintenir l'ancienne fonction pour les imports existants
export async function updateLogs() {
    await logService.loadInitialLogs();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

