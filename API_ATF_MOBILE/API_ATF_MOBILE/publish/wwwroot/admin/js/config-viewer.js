/**
 * Module de visualisation de la configuration
 */

import apiClient from './api-client.js';

export function initConfigViewer() {
    console.log('⚙️ Initialisation du module Config Viewer');
    loadConfiguration();
}

async function loadConfiguration() {
    try {
        const config = await apiClient.getConfiguration();
        displayConfiguration(config);
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
    }
}

function displayConfiguration(config) {
    const container = document.getElementById('configInfo');
    if (!container) return;
    
    container.innerHTML = `
        <div class="space-y-4">
            <div>
                <h4 class="font-semibold mb-2">Environnement</h4>
                <div class="flex justify-between py-2 border-b border-white/5">
                    <span class="text-slate-400">Mode</span>
                    <span class="font-medium">${config.environment}</span>
                </div>
                <div class="flex justify-between py-2 border-b border-white/5">
                    <span class="text-slate-400">URLs</span>
                    <span class="font-medium font-mono text-sm">${config.urls}</span>
                </div>
                <div class="flex justify-between py-2 border-b border-white/5">
                    <span class="text-slate-400">Niveau de log</span>
                    <span class="font-medium">${config.logLevel}</span>
                </div>
                <div class="flex justify-between py-2">
                    <span class="text-slate-400">Hosts autorisés</span>
                    <span class="font-medium">${config.allowedHosts}</span>
                </div>
            </div>
            
            <div>
                <h4 class="font-semibold mb-2">Chaînes de connexion</h4>
                ${config.connectionStrings.map(cs => `
                    <div class="mb-2 p-3 bg-white/5 rounded-lg">
                        <p class="font-medium text-sm mb-1">${cs.name}</p>
                        <p class="font-mono text-xs text-slate-400 break-all">${cs.value}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

