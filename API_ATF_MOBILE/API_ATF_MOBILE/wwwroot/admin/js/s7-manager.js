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
                </div>
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

window.editPlc = async function(id) {
    try {
        // Récupérer les données de la connexion
        const connections = await apiClient.getPlcConnections();
        const connection = connections.find(c => c.id === id);
        
        if (!connection) {
            alert('❌ Connexion PLC non trouvée');
            return;
        }
        
        // Afficher la modal de modification
        showEditPlcModal(connection);
    } catch (error) {
        console.error('Erreur lors de la récupération de la connexion PLC:', error);
        alert(`❌ Erreur: ${error.message}`);
    }
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

// =========== MODAL DE MODIFICATION ===========

function showEditPlcModal(connection) {
    // Créer la modal si elle n'existe pas
    let modal = document.getElementById('editPlcModal');
    if (!modal) {
        modal = createEditPlcModal();
        document.body.appendChild(modal);
    }
    
    // Remplir les champs avec les données actuelles
    document.getElementById('editPlcId').value = connection.id;
    document.getElementById('editPlcName').value = connection.name;
    document.getElementById('editPlcIpAddress').value = connection.ipAddress;
    document.getElementById('editPlcRack').value = connection.rack;
    document.getElementById('editPlcSlot').value = connection.slot;
    document.getElementById('editPlcPort').value = connection.port;
    document.getElementById('editPlcCpuType').value = connection.cpuType;
    
    // Afficher la modal
    modal.classList.remove('hidden');
}

function createEditPlcModal() {
    const modal = document.createElement('div');
    modal.id = 'editPlcModal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden';
    
    modal.innerHTML = `
        <div class="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-white/10">
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-semibold text-white">Modifier la connexion PLC</h3>
                    <button onclick="closeEditPlcModal()" class="text-slate-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <form id="editPlcForm" class="space-y-4">
                    <input type="hidden" id="editPlcId">
                    
                    <div>
                        <label for="editPlcName" class="block text-sm text-slate-300 mb-2">Nom *</label>
                        <input 
                            type="text" 
                            id="editPlcName" 
                            name="name"
                            placeholder="Nom du PLC"
                            class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            required
                        />
                    </div>
                    
                    <div>
                        <label for="editPlcIpAddress" class="block text-sm text-slate-300 mb-2">Adresse IP *</label>
                        <input 
                            type="text" 
                            id="editPlcIpAddress" 
                            name="ipAddress"
                            placeholder="192.168.1.100"
                            class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            required
                        />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="editPlcRack" class="block text-sm text-slate-300 mb-2">Rack</label>
                            <input 
                                type="number" 
                                id="editPlcRack" 
                                name="rack"
                                min="0"
                                max="7"
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label for="editPlcSlot" class="block text-sm text-slate-300 mb-2">Slot</label>
                            <input 
                                type="number" 
                                id="editPlcSlot" 
                                name="slot"
                                min="0"
                                max="31"
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="editPlcPort" class="block text-sm text-slate-300 mb-2">Port</label>
                            <input 
                                type="number" 
                                id="editPlcPort" 
                                name="port"
                                min="1"
                                max="65535"
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label for="editPlcCpuType" class="block text-sm text-slate-300 mb-2">Type CPU</label>
                            <select 
                                id="editPlcCpuType" 
                                name="cpuType"
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="S7-200">S7-200</option>
                                <option value="S7-300">S7-300</option>
                                <option value="S7-400">S7-400</option>
                                <option value="S7-1200">S7-1200</option>
                                <option value="S7-1500" selected>S7-1500</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button 
                            type="button" 
                            onclick="closeEditPlcModal()"
                            class="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            class="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-colors"
                        >
                            Modifier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Ajouter l'event listener pour le formulaire
    const form = modal.querySelector('#editPlcForm');
    form.addEventListener('submit', handleEditPlc);
    
    return modal;
}

async function handleEditPlc(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const id = document.getElementById('editPlcId').value;
    
    const data = {
        name: formData.get('name'),
        ipAddress: formData.get('ipAddress'),
        rack: parseInt(formData.get('rack')),
        slot: parseInt(formData.get('slot')),
        port: parseInt(formData.get('port')),
        cpuType: formData.get('cpuType')
    };
    
    try {
        // Désactiver le bouton pendant la requête
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Modification...';
        submitButton.disabled = true;
        
        await apiClient.updatePlcConnection(id, data);
        
        // Fermer la modal
        closeEditPlcModal();
        
        // Rafraîchir la liste
        await updateS7Status();
        
        console.log('✅ Connexion PLC modifiée:', data.name);
    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        alert(`❌ Erreur: ${error.message}`);
        
        // Réactiver le bouton
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

function closeEditPlcModal() {
    const modal = document.getElementById('editPlcModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Fermer la modal en cliquant à l'extérieur
document.addEventListener('click', function(e) {
    const modal = document.getElementById('editPlcModal');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) {
        closeEditPlcModal();
    }
});

// Fermer la modal avec la touche Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEditPlcModal();
    }
});

