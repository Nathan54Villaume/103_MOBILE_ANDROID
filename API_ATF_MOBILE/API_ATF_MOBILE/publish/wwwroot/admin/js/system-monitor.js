/**
 * Gestionnaire des métriques système
 */

import apiClient from './api-client.js';

let systemCharts = {};

export function initSystemMonitor() {
    console.log('🖥️ Initialisation du moniteur système');
}

export async function updateSystemMetrics() {
    try {
        const data = await apiClient.getSystemMetrics();
        displaySystemMetrics(data.system);
        displayProcessMetrics(data.process);
        updateSystemCharts(data.system, data.process);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des métriques système:', error);
        throw error;
    }
}

function displaySystemMetrics(system) {
    const container = document.getElementById('systemMetrics');
    if (!container) return;
    
    const memoryUsagePercent = ((system.memoryUsageMB / system.totalMemoryMB) * 100).toFixed(1);
    
    const metrics = [
        {
            icon: '💻',
            label: 'CPU Machine',
            value: `${system.cpuUsagePercent}%`,
            color: system.cpuUsagePercent > 80 ? 'text-red-400' : system.cpuUsagePercent > 60 ? 'text-yellow-400' : 'text-green-400'
        },
        {
            icon: '🧠',
            label: 'Mémoire Utilisée',
            value: `${system.memoryUsageMB.toFixed(0)} MB`,
            subtitle: `${memoryUsagePercent}% de ${system.totalMemoryMB.toFixed(0)} MB`,
            color: memoryUsagePercent > 80 ? 'text-red-400' : memoryUsagePercent > 60 ? 'text-yellow-400' : 'text-green-400'
        },
        {
            icon: '💾',
            label: 'Mémoire Libre',
            value: `${system.availableMemoryMB.toFixed(0)} MB`,
            subtitle: `${((system.availableMemoryMB / system.totalMemoryMB) * 100).toFixed(1)}% libre`,
            color: 'text-blue-400'
        },
        {
            icon: '⚡',
            label: 'Processeurs',
            value: `${system.processorCount}`,
            subtitle: system.machineName,
            color: 'text-purple-400'
        }
    ];
    
    container.innerHTML = metrics.map(metric => `
        <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl">${metric.icon}</span>
                <div class="flex-1">
                    <p class="text-sm text-slate-400">${metric.label}</p>
                    <p class="text-xl font-bold ${metric.color}">${metric.value}</p>
                    ${metric.subtitle ? `<p class="text-xs text-slate-500">${metric.subtitle}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function displayProcessMetrics(process) {
    const container = document.getElementById('processMetrics');
    if (!container) return;
    
    const uptimeFormatted = formatProcessUptime(process.uptime);
    
    const metrics = [
        {
            icon: '🔧',
            label: 'CPU Processus',
            value: `${process.cpuUsagePercent}%`,
            color: process.cpuUsagePercent > 50 ? 'text-red-400' : process.cpuUsagePercent > 25 ? 'text-yellow-400' : 'text-green-400'
        },
        {
            icon: '📦',
            label: 'Mémoire Processus',
            value: `${process.memoryUsageMB.toFixed(0)} MB`,
            subtitle: `Privée: ${process.privateMemoryMB.toFixed(0)} MB`,
            color: 'text-blue-400'
        },
        {
            icon: '🧵',
            label: 'Threads',
            value: `${process.threadCount}`,
            subtitle: `Handles: ${process.handleCount}`,
            color: 'text-green-400'
        },
        {
            icon: '⏱️',
            label: 'Uptime Processus',
            value: uptimeFormatted,
            subtitle: `PID: ${process.processId}`,
            color: 'text-purple-400'
        },
        {
            icon: '📋',
            label: 'Nom Processus',
            value: process.processName,
            subtitle: new Date(process.startTime).toLocaleString('fr-FR'),
            color: 'text-cyan-400'
        }
    ];
    
    container.innerHTML = metrics.map(metric => `
        <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl">${metric.icon}</span>
                <div class="flex-1">
                    <p class="text-sm text-slate-400">${metric.label}</p>
                    <p class="text-lg font-bold ${metric.color}">${metric.value}</p>
                    ${metric.subtitle ? `<p class="text-xs text-slate-500">${metric.subtitle}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateSystemCharts(system, process) {
    updateSystemCpuChart(system, process);
    updateSystemMemoryChart(system, process);
}

function updateSystemCpuChart(system, process) {
    const ctx = document.getElementById('chartSystemCpu');
    if (!ctx) return;
    
    if (systemCharts.cpu) {
        systemCharts.cpu.data.datasets[0].data = [system.cpuUsagePercent, process.cpuUsagePercent];
        systemCharts.cpu.update('none');
        return;
    }
    
    systemCharts.cpu = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['CPU Système', 'CPU Processus'],
            datasets: [{
                data: [system.cpuUsagePercent, process.cpuUsagePercent],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(16, 185, 129, 0.6)'
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        color: '#94a3b8',
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                }
            }
        }
    });
}

function updateSystemMemoryChart(system, process) {
    const ctx = document.getElementById('chartSystemMemory');
    if (!ctx) return;
    
    const systemUsed = system.memoryUsageMB;
    const systemFree = system.availableMemoryMB;
    const processMemory = process.memoryUsageMB;
    
    if (systemCharts.memory) {
        systemCharts.memory.data.datasets[0].data = [systemUsed, systemFree, processMemory];
        systemCharts.memory.update('none');
        return;
    }
    
    systemCharts.memory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mémoire Utilisée', 'Mémoire Libre', 'Processus'],
            datasets: [{
                label: 'Mémoire (MB)',
                data: [systemUsed, systemFree, processMemory],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(34, 197, 94, 0.6)',
                    'rgba(168, 85, 247, 0.6)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(34, 197, 94, 1)',
                    'rgba(168, 85, 247, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#94a3b8',
                        callback: function(value) {
                            return value + ' MB';
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { 
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y.toFixed(0)} MB`;
                        }
                    }
                }
            }
        }
    });
}

function formatProcessUptime(uptimeString) {
    // Utiliser la même fonction que dans admin.js mais adaptée
    if (typeof uptimeString === 'string') {
        const parts = uptimeString.split('.');
        let timeStr = parts[0];
        let totalSeconds = 0;
        
        if (parts.length > 1 && parts[0].includes(':') === false) {
            const days = parseInt(parts[0]);
            timeStr = parts[1];
            totalSeconds += days * 86400;
        }
        
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 3) {
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            const seconds = parseInt(timeParts[2]) || 0;
            totalSeconds += hours * 3600 + minutes * 60 + seconds;
        }
        
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}j ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
    return uptimeString || '0s';
}
