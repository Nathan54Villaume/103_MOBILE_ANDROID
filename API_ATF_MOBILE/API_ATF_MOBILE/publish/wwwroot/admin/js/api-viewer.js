/**
 * Module de visualisation de l'API
 */

import apiClient from './api-client.js';

export function initApiViewer() {
    console.log('🌐 Initialisation du module API Viewer');
    loadControllers();
}

async function loadControllers() {
    try {
        const controllers = await apiClient.getControllers();
        displayControllers(controllers);
    } catch (error) {
        console.error('Erreur lors du chargement des contrôleurs:', error);
    }
}

function displayControllers(controllers) {
    const container = document.getElementById('controllersList');
    if (!container) return;
    
    container.innerHTML = controllers.map(ctrl => `
        <div class="p-4 bg-white/5 rounded-lg">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-semibold">${ctrl.name}</h4>
                <span class="px-2 py-1 rounded text-xs bg-brand-500/20 text-brand-400">
                    ${ctrl.routes.length} routes
                </span>
            </div>
            <p class="text-xs text-slate-500 mb-3 font-mono">${ctrl.fullName}</p>
            <div class="space-y-1">
                ${ctrl.routes.map(route => {
                    const [method, path] = route.split(' ');
                    const methodColors = {
                        'GET': 'bg-blue-500/20 text-blue-400',
                        'POST': 'bg-green-500/20 text-green-400',
                        'PUT': 'bg-yellow-500/20 text-yellow-400',
                        'DELETE': 'bg-red-500/20 text-red-400'
                    };
                    const colorClass = methodColors[method] || 'bg-slate-500/20 text-slate-400';
                    
                    return `
                        <div class="flex items-center gap-2 text-sm">
                            <span class="px-2 py-0.5 rounded text-xs font-mono ${colorClass}">
                                ${method}
                            </span>
                            <span class="font-mono text-slate-300">${path}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

