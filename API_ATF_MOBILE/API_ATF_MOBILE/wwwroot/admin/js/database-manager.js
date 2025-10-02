/**
 * Module de gestion des bases de données
 */

import apiClient from './api-client.js';

export function initDatabaseManager() {
    console.log('💾 Initialisation du module Database Manager');
}

export async function updateDatabaseStatus() {
    try {
        const databases = await apiClient.getDatabaseHealth();
        
        // Pour chaque base, récupérer aussi les statistiques
        const dbWithStats = await Promise.all(
            databases.map(async (db) => {
                try {
                    const stats = await apiClient.getDatabaseStats(db.connectionName);
                    return { ...db, stats };
                } catch (error) {
                    console.warn(`Impossible de récupérer les stats pour ${db.connectionName}`);
                    return { ...db, stats: null };
                }
            })
        );
        
        displayDatabases(dbWithStats);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des BDD:', error);
        throw error;
    }
}

function displayDatabases(databases) {
    const container = document.getElementById('databaseList');
    if (!container) return;
    
    container.innerHTML = databases.map(db => {
        const statusClass = db.isConnected ? 'online' : 'offline';
        const statusText = db.isConnected ? 'Connectée' : 'Déconnectée';
        
        return `
            <div class="card rounded-xl p-5 shadow-glass">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="status-dot ${statusClass}"></div>
                        <div>
                            <h3 class="font-semibold">${db.connectionName}</h3>
                            <p class="text-xs text-slate-400">${db.databaseName || 'N/A'}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${db.isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        ${statusText}
                    </span>
                </div>
                
                ${db.isConnected ? `
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                            <p class="text-xs text-slate-400">Serveur</p>
                            <p class="font-medium text-sm">${db.serverName}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-400">Temps de réponse</p>
                            <p class="font-medium text-sm">${db.responseTimeMs}ms</p>
                        </div>
                        ${db.stats ? `
                            <div>
                                <p class="text-xs text-slate-400">Tables</p>
                                <p class="font-medium text-sm">${db.stats.tableCount}</p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400">Taille</p>
                                <p class="font-medium text-sm">${db.stats.databaseSizeMB.toFixed(0)} MB</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${db.stats && db.stats.recordCounts && Object.keys(db.stats.recordCounts).length > 0 ? `
                        <div class="mt-3 pt-3 border-t border-white/10">
                            <p class="text-xs text-slate-400 mb-2">Enregistrements</p>
                            <div class="grid grid-cols-2 gap-2">
                                ${Object.entries(db.stats.recordCounts).map(([table, count]) => `
                                    <div class="flex justify-between text-sm">
                                        <span class="text-slate-400">${table}</span>
                                        <span class="font-medium">${count >= 0 ? count : 'N/A'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mt-3 pt-3 border-t border-white/10">
                        <p class="text-xs text-slate-500 truncate">${db.connectionString}</p>
                    </div>
                ` : `
                    <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p class="text-sm text-red-400">❌ ${db.errorMessage}</p>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

