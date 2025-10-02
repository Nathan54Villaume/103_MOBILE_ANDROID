/**
 * Module de gestion PLC S7
 */

import apiClient from './api-client.js';

export function initS7Manager() {
    console.log('🔌 Initialisation du module S7 Manager');
    
    // Formulaire d'ajout
    const form = document.getElementById('addPlcForm');
    if (form) {
        form.addEventListener('submit', handleAddPlc);
    }
}

export async function updateS7Status() {
    try {
        const connections = await apiClient.getPlcConnections();
        displayPlcConnections(connections);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des connexions PLC:', error);
        throw error;
    }
}

function displayPlcConnections(connections) {
    const container = document.getElementById('plcConnectionsList');
    if (!container) return;
    
    if (connections.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8">Aucune connexion PLC configurée</p>';
        return;
    }
    
    container.innerHTML = connections.map(plc => {
        const statusClass = plc.status === 'Connecté' ? 'online' : 'offline';
        const statusText = plc.status || 'Déconnecté';
        
        return `
        <div class="p-4 bg-white/5 rounded-lg border border-white/10">
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="status-dot ${statusClass}"></div>
                    <div>
                        <h4 class="font-semibold">${escapeHtml(plc.name)}</h4>
                        <p class="text-xs text-slate-400">${plc.cpuType}</p>
                    </div>
                </div>`
                <div class="flex gap-2">
                    <button 
                        onclick="window.editPlc('${plc.id}')" 
                        class="px-3 py-1 text-sm rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        title="Modifier"
                    >
                        ✏️
                    </button>
                    <button 
                        onclick="window.deletePlc('${plc.id}')" 
                        class="px-3 py-1 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                        title="Supprimer"
                    >
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                    <p class="text-xs text-slate-400">IP</p>
                    <p class="font-mono">${plc.ipAddress}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-400">Port</p>
                    <p class="font-mono">${plc.port}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-400">Rack</p>
                    <p class="font-mono">${plc.rack}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-400">Slot</p>
                    <p class="font-mono">${plc.slot}</p>
                </div>
            </div>
            
            <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span class="text-xs text-slate-500">
                    Ajouté le ${new Date(plc.createdAt).toLocaleDateString('fr-FR')}
                </span>
                <div class="flex items-center gap-2">
                    <button 
                        onclick="testPlcConnection('${plc.id}')" 
                        class="px-2 py-1 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        title="Tester la connexion"
                    >
                        🔍 Test
                    </button>
                    <span class="px-2 py-1 rounded text-xs font-medium ${statusClass === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        ${statusText}
                    </span>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function handleAddPlc(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        ipAddress: formData.get('ipAddress'),
        rack: parseInt(formData.get('rack')),
        slot: parseInt(formData.get('slot')),
        port: parseInt(formData.get('port')),
        cpuType: formData.get('cpuType')
    };
    
    try {
        await apiClient.addPlcConnection(data);
        
        // Réinitialiser le formulaire
        form.reset();
        
        // Rafraîchir la liste
        await updateS7Status();
        
        console.log('✅ Connexion PLC ajoutée:', data.name);
    } catch (error) {
        alert(`❌ Erreur: ${error.message}`);
    }
}

// Fonctions globales pour les boutons
window.deletePlc = async function(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette connexion PLC ?')) {
        return;
    }
    
    try {
        await apiClient.deletePlcConnection(id);
        await updateS7Status();
        console.log('✅ Connexion PLC supprimée');
    } catch (error) {
        alert(`❌ Erreur: ${error.message}`);
    }
};

window.editPlc = function(id) {
    alert('Fonctionnalité de modification à venir');
    // TODO: Implémenter la modification
};

// Fonction pour tester une connexion PLC individuelle
window.testPlcConnection = async function(id) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        // Feedback visuel
        button.innerHTML = '⏳ Test...';
        button.disabled = true;
        
        const response = await apiClient.request(`/api/admin/plc/connections/${id}/test`);
        
        // Afficher le résultat
        const statusText = response.isOnline ? 
            `✅ Connecté (${response.responseTime}ms)` : 
            '❌ Déconnecté';
            
        button.innerHTML = statusText;
        
        // Mettre à jour l'affichage après 2 secondes
        setTimeout(async () => {
            button.innerHTML = originalText;
            button.disabled = false;
            await updateS7Status(); // Rafraîchir la liste
        }, 2000);
        
    } catch (error) {
        console.error('Erreur lors du test PLC:', error);
        button.innerHTML = '❌ Erreur';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

