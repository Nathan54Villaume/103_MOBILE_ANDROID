import { getChart } from '../charts/index.js';

let currentChartKey = null;
const dialog = document.getElementById('chart-settings-dialog');
const form = dialog?.querySelector('form');
const body = dialog?.querySelector('#chart-settings-body');
const titleEl = dialog?.querySelector('#chart-settings-title');
const subEl = dialog?.querySelector('#chart-settings-sub');
const resetBtn = dialog?.querySelector('#chart-settings-reset');
const applyAllBtn = dialog?.querySelector('#chart-settings-apply-all');

function ensureDialog() {
  if (!dialog) return;
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = () => dialog.setAttribute('open', 'open');
    dialog.close = () => dialog.removeAttribute('open');
  }
}

function openSettings(chartKey) {
  if (!dialog || !body) return;
  
  // Utiliser uniquement le nouveau système
  const newChart = getChart(chartKey);
  if (newChart) {
    console.log(`[chart-settings] Ouverture des settings pour chart: ${chartKey}`);
    openNewSystemSettings(chartKey, newChart);
    return;
  }
  
    console.warn(`[chart-settings] Aucun chart trouvé pour la clé: ${chartKey}`);
}

function closeDialog() {
  if (!dialog) return;
  
  // Nettoyer les event listeners
  if (dialog._keydownHandler) {
    document.removeEventListener('keydown', dialog._keydownHandler);
    dialog._keydownHandler = null;
  }
  if (dialog._backdropHandler) {
    dialog.removeEventListener('click', dialog._backdropHandler);
    dialog._backdropHandler = null;
  }
  if (dialog._closeHandler) {
  const closeBtn = dialog.querySelector('[data-dialog-close]');
  if (closeBtn) {
      closeBtn.removeEventListener('click', dialog._closeHandler);
    }
    dialog._closeHandler = null;
  }
  if (dialog._saveHandler) {
    const saveBtn = dialog.querySelector('#chart-settings-save');
    if (saveBtn) {
      saveBtn.removeEventListener('click', dialog._saveHandler);
    }
    dialog._saveHandler = null;
  }
  if (dialog._resetHandler) {
    const resetBtn = dialog.querySelector('#chart-settings-reset');
    if (resetBtn) {
      resetBtn.removeEventListener('click', dialog._resetHandler);
    }
    dialog._resetHandler = null;
  }
  
  dialog.close();
  currentChartKey = null;
  console.log('[chart-settings] Dialog fermé et nettoyé');
}

// === NOUVEAU SYSTÈME DE SETTINGS ===
function openNewSystemSettings(chartKey, chartInstance) {
  currentChartKey = chartKey;
  ensureDialog();
  
  console.log(`[chart-settings] openNewSystemSettings appelé pour ${chartKey}`);
  console.log(`[chart-settings] chartInstance:`, chartInstance);
  
  // Vérifier que chartInstance a bien un host
  if (!chartInstance || !chartInstance.host) {
    console.error(`[chart-settings] chartInstance.host manquant pour ${chartKey}`);
    return;
  }
  
  const chartHost = chartInstance.host;
  const chart = chartHost.chart;
  
  console.log(`[chart-settings] chartHost:`, chartHost);
  console.log(`[chart-settings] chart:`, chart);
  
  // Titre et sous-titre
  if (titleEl) titleEl.textContent = `Réglages - ${chartKey}`;
  if (subEl) subEl.textContent = `Nouveau système de charts`;
  
          // Créer le contenu des settings pour le nouveau système
          body.innerHTML = `
            <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2" style="scrollbar-width: none; -ms-overflow-style: none;">
              <style>
                .settings-container::-webkit-scrollbar { display: none; }
                /* STYLES POUR LES CONTRÔLES DANS LE DIALOG */
                #chart-settings-dialog input, 
                #chart-settings-dialog select, 
                #chart-settings-dialog button {
                  display: block !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  pointer-events: auto !important;
                }
                #chart-settings-dialog .hidden { display: block !important; }
              </style>
      
      <!-- SECTION RÉGLAGES DE BASE -->
      <div class="bg-gray-800 rounded-lg p-4">
        <h3 class="text-md font-semibold text-gray-200 mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
          Réglages essentiels
        </h3>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Base de temps</label>
            <select id="new-chart-timerange" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
              <option value="15">15 minutes</option>
              <option value="60">1 heure</option>
              <option value="240">4 heures</option>
              <option value="1440">24 heures</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Épaisseur ligne</label>
            <select id="new-chart-line-width" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
              <option value="1">Fine (1px)</option>
              <option value="2" selected>Normal (2px)</option>
              <option value="3">Épaisse (3px)</option>
              <option value="4">Très épaisse (4px)</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" id="new-chart-show-grid" class="rounded bg-gray-700 border-gray-600" checked>
              <span class="text-sm text-gray-300">Grille</span>
            </label>
          </div>
          <div>
            <label class="flex items-center space-x-2">
              <input type="checkbox" id="new-chart-show-legend" class="rounded bg-gray-700 border-gray-600" checked>
              <span class="text-sm text-gray-300">Légende</span>
            </label>
          </div>
        </div>
        
        <!-- BOUTON PARAMÈTRES AVANCÉS -->
        <div class="border-t border-gray-600 pt-3 mt-4">
          <button type="button" id="toggle-advanced-settings" class="w-full flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors">
            <svg id="chevron-icon" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
            <span id="toggle-text">Paramètres avancés</span>
          </button>
        </div>
      </div>

      <!-- SECTION PARAMÈTRES AVANCÉS (MASQUÉE PAR DÉFAUT) -->
      <div id="advanced-settings" class="space-y-4" style="display: none;">
        
        <!-- APPARENCE AVANCÉE -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-md font-semibold text-gray-200 mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4zM4 9a2 2 0 100 4h12a2 2 0 100-4H4zM4 15a2 2 0 100 4h12a2 2 0 100-4H4z"/></svg>
            Apparence avancée
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-show-tooltips" class="rounded bg-gray-700 border-gray-600" checked>
                <span class="text-sm text-gray-300">Tooltips</span>
              </label>
            </div>
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-show-crosshair" class="rounded bg-gray-700 border-gray-600" checked>
                <span class="text-sm text-gray-300">Crosshair</span>
              </label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Lissage courbes</label>
              <select id="new-chart-tension" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
                <option value="0">Aucun (0)</option>
                <option value="0.1" selected>Léger (0.1)</option>
                <option value="0.3">Moyen (0.3)</option>
                <option value="0.5">Fort (0.5)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Transparence zones</label>
              <input type="range" id="new-chart-alpha" min="0" max="100" value="20" 
                     class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
              <div class="text-xs text-gray-400 mt-1 text-center">
                <span id="new-chart-alpha-value">20%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- CONFIGURATION AXES -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-md font-semibold text-gray-200 mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
            Configuration des axes
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-y-zero" class="rounded bg-gray-700 border-gray-600">
                <span class="text-sm text-gray-300">Y commence à 0</span>
              </label>
            </div>
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-y-auto" class="rounded bg-gray-700 border-gray-600" checked>
                <span class="text-sm text-gray-300">Échelle Y auto</span>
              </label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Format heure X</label>
              <select id="new-chart-time-format" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
                <option value="HH:mm">HH:mm</option>
                <option value="HH:mm:ss" selected>HH:mm:ss</option>
                <option value="dd/MM HH:mm">dd/MM HH:mm</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Unité Y</label>
              <select id="new-chart-y-unit" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
                <option value="auto" selected>Automatique</option>
                <option value="kW">kW (puissance)</option>
                <option value="V">V (tension)</option>
                <option value="A">A (courant)</option>
                <option value="">Sans unité</option>
              </select>
            </div>
          </div>
        </div>

        <!-- INTERACTIONS AVANCÉES -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-md font-semibold text-gray-200 mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
            Interactions
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-enable-zoom" class="rounded bg-gray-700 border-gray-600" checked>
                <span class="text-sm text-gray-300">Zoom molette</span>
              </label>
            </div>
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-chart-enable-pan" class="rounded bg-gray-700 border-gray-600" checked>
                <span class="text-sm text-gray-300">Panoramique</span>
              </label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Sensibilité zoom</label>
              <input type="range" id="new-chart-zoom-speed" min="0.1" max="2" step="0.1" value="1" 
                     class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
              <div class="text-xs text-gray-400 mt-1 text-center">
                <span id="new-chart-zoom-speed-value">1.0x</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Actualisation</label>
              <select id="new-chart-refresh-rate" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white">
                <option value="1" selected>1 seconde</option>
                <option value="5">5 secondes</option>
                <option value="10">10 secondes</option>
                <option value="30">30 secondes</option>
                <option value="60">1 minute</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION ACTIONS & SIGNAUX -->
      <div class="bg-gray-800 rounded-lg p-4">
        <h3 class="text-md font-semibold text-gray-200 mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v-4m6-2v-2m0 2v2m0-2a2 2 0 100 4m0-4a2 2 0 110 4"/></svg>
          Actions & Signaux
        </h3>
        <div class="grid grid-cols-3 gap-2 mb-4">
          <button type="button" id="new-chart-reset" class="btn btn-soft text-sm">🔄 Reset</button>
          <button type="button" id="new-chart-export-png" class="btn btn-soft text-sm">📷 PNG</button>
          <button type="button" id="new-chart-export-csv" class="btn btn-soft text-sm">📊 CSV</button>
        </div>
        
        <div class="border-t border-gray-600 pt-3">
          <p class="text-sm text-gray-400 mb-2">Signaux affichés :</p>
          <div id="new-chart-signals" class="space-y-2">
            <!-- Les signaux seront ajoutés dynamiquement -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  // === FONCTION D'APPLICATION DES PARAMÈTRES (définie en dehors du setTimeout) ===
  let applySettingsToChart;
  
  // === GESTIONNAIRES D'ÉVÉNEMENTS ===
  setTimeout(() => {
    console.log(`[chart-settings] Configuration des gestionnaires pour ${chartKey}`);
    
    // Toggle paramètres avancés
    const toggleAdvancedBtn = body.querySelector('#toggle-advanced-settings');
    const advancedSettings = body.querySelector('#advanced-settings');
    const chevronIcon = body.querySelector('#chevron-icon');
    const toggleText = body.querySelector('#toggle-text');
    
    if (toggleAdvancedBtn && advancedSettings) {
      console.log(`[chart-settings] Configuration du toggle paramètres avancés`);
      
      toggleAdvancedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isHidden = advancedSettings.style.display === 'none';
        console.log(`[chart-settings] Toggle paramètres avancés - actuellement caché: ${isHidden}`);
          
          if (isHidden) {
            advancedSettings.style.display = 'block';
            if (chevronIcon) chevronIcon.style.transform = 'rotate(180deg)';
            if (toggleText) toggleText.textContent = 'Masquer paramètres avancés';
          console.log(`[chart-settings] Paramètres avancés AFFICHÉS`);
          } else {
            advancedSettings.style.display = 'none';
            if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
            if (toggleText) toggleText.textContent = 'Paramètres avancés';
          console.log(`[chart-settings] Paramètres avancés MASQUÉS`);
        }
      });
    } else {
      console.warn(`[chart-settings] Éléments toggle non trouvés:`, { toggleAdvancedBtn, advancedSettings });
    }
    
    // Base de temps
            const timerangeSelect = body.querySelector('#new-chart-timerange');
    if (timerangeSelect) {
              timerangeSelect.value = String(chartHost.getTimeRange());
              timerangeSelect.addEventListener('change', () => {
                const minutes = parseInt(timerangeSelect.value, 10);
        console.log(`[chart-settings] Changement base de temps: ${minutes}min`);
                chartHost.setTimeRange(minutes);
                if (chart) {
                  chart.update('active');
                }
              });
            }

            // Fonction d'application des paramètres
            applySettingsToChart = (source = 'unknown') => {
      console.log(`[chart-settings] applySettingsToChart appelée depuis ${source}`);
      
      if (!chartHost || !chart) {
        console.error(`[chart-settings] chartHost ou chart est null !`);
                return;
              }
              
              const options = chart.options;
      
      // === PARAMÈTRES DE BASE ===
      const showGrid = body.querySelector('#new-chart-show-grid')?.checked ?? true;
      const showLegend = body.querySelector('#new-chart-show-legend')?.checked ?? true;
      
      // === PARAMÈTRES AVANCÉS ===
      const showTooltips = body.querySelector('#new-chart-show-tooltips')?.checked ?? true;
      const showCrosshair = body.querySelector('#new-chart-show-crosshair')?.checked ?? true;
      const tension = parseFloat(body.querySelector('#new-chart-tension')?.value || '0.1');
      const alpha = parseInt(body.querySelector('#new-chart-alpha')?.value || '20');
      
      // === CONFIGURATION AXES ===
      const yZero = body.querySelector('#new-chart-y-zero')?.checked ?? false;
      const yAuto = body.querySelector('#new-chart-y-auto')?.checked ?? true;
      const timeFormat = body.querySelector('#new-chart-time-format')?.value || 'HH:mm:ss';
      const yUnit = body.querySelector('#new-chart-y-unit')?.value || 'auto';
      
      // === INTERACTIONS ===
      const enableZoom = body.querySelector('#new-chart-enable-zoom')?.checked ?? true;
      const enablePan = body.querySelector('#new-chart-enable-pan')?.checked ?? true;
      const zoomSpeed = parseFloat(body.querySelector('#new-chart-zoom-speed')?.value || '1');
      const refreshRate = parseInt(body.querySelector('#new-chart-refresh-rate')?.value || '1');
      
      // === ÉPAISSEUR DE LIGNE ===
      const lineWidth = parseInt(body.querySelector('#new-chart-line-width')?.value || '2');
      
      console.log(`[chart-settings] Paramètres lus:`, {
        showGrid, showLegend, showTooltips, showCrosshair,
        tension, alpha, yZero, yAuto, timeFormat, yUnit,
        enableZoom, enablePan, zoomSpeed, refreshRate, lineWidth
      });
      
      // === APPLIQUER LES CHANGEMENTS ===
      
      // 1. Légende
              if (options.plugins?.legend) {
                options.plugins.legend.display = showLegend;
      }
      
      // 2. Tooltips
      if (options.interaction) {
        options.interaction.intersect = !showTooltips;
      }
      
      // 3. Grille
              if (options.scales?.x?.grid) {
                options.scales.x.grid.display = showGrid;
              }
              if (options.scales?.y?.grid) {
                options.scales.y.grid.display = showGrid;
      }
      
      // 4. Crosshair (plugin)
      if (options.plugins?.crosshair) {
        options.plugins.crosshair.enabled = showCrosshair;
      }
      
      // 5. Configuration des axes Y
      if (options.scales?.y) {
        if (yZero) {
          options.scales.y.min = 0;
          // Ne pas supprimer max pour laisser Chart.js calculer
          console.log(`[chart-settings] Y forcé à commencer à 0`);
        } else if (yAuto) {
          delete options.scales.y.min;
          delete options.scales.y.max;
          console.log(`[chart-settings] Y en mode automatique`);
        }
      }
      
      // 6. Format de temps
      if (options.scales?.x?.time) {
        options.scales.x.time.tooltipFormat = timeFormat;
      }
      
      // 7. Zoom/Pan (via le contrôleur)
      if (chartHost.zoomPanController) {
        chartHost.zoomPanController.setZoomEnabled(enableZoom);
        chartHost.zoomPanController.setPanEnabled(enablePan);
      }
      
      // 8. Styles des datasets
              chart.data.datasets?.forEach((dataset, index) => {
        // Épaisseur de ligne
                dataset.borderWidth = lineWidth;
        
        // Tension (lissage)
                dataset.tension = tension;
        
        // Transparence
        if (dataset.backgroundColor && dataset.borderColor) {
                  const baseColor = dataset.borderColor;
          const alphaHex = Math.round(alpha * 2.55).toString(16).padStart(2, '0');
          dataset.backgroundColor = baseColor + alphaHex;
        }
        
        console.log(`[chart-settings] Dataset ${index} mis à jour: largeur=${lineWidth}px, tension=${tension}, alpha=${alpha}%`);
      });
      
      // 9. Sauvegarder les paramètres dans localStorage via ChartHost
      if (chartHost) {
        const settings = {
          showGrid, showLegend, showTooltips, showCrosshair,
          tension, alpha, yZero, yAuto, timeFormat, yUnit,
          enableZoom, enablePan, zoomSpeed, refreshRate, lineWidth
        };
        chartHost.saveSettings(settings);
        console.log(`[chart-settings] Paramètres sauvegardés dans localStorage`);
      }
      
      // 10. Mise à jour du graphique
      chart.update('active');
      
      console.log(`[chart-settings] Paramètres appliqués avec succès`);
    };
    
    // Appliquer les paramètres sur changement
    const inputs = body.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => applySettingsToChart('input-change'));
    });
    
    // Gestionnaire spécial pour l'épaisseur de ligne (application immédiate)
    const lineWidthSelect = body.querySelector('#new-chart-line-width');
    if (lineWidthSelect) {
      lineWidthSelect.addEventListener('change', () => {
        console.log(`[chart-settings] Changement épaisseur ligne: ${lineWidthSelect.value}px`);
        applySettingsToChart('line-width-change');
      });
    }
    
    // Gestionnaires spéciaux pour les contrôles avec affichage de valeur
    const alphaSlider = body.querySelector('#new-chart-alpha');
    const alphaValue = body.querySelector('#new-chart-alpha-value');
    if (alphaSlider && alphaValue) {
      alphaSlider.addEventListener('input', (e) => {
        alphaValue.textContent = e.target.value + '%';
        applySettingsToChart('alpha-slider');
      });
    }
    
    const zoomSpeedSlider = body.querySelector('#new-chart-zoom-speed');
    const zoomSpeedValue = body.querySelector('#new-chart-zoom-speed-value');
    if (zoomSpeedSlider && zoomSpeedValue) {
      zoomSpeedSlider.addEventListener('input', (e) => {
        zoomSpeedValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
        applySettingsToChart('zoom-speed-slider');
      });
    }
    
    // Actions
            const resetBtn = body.querySelector('#new-chart-reset');
    const exportPngBtn = body.querySelector('#new-chart-export-png');
    const exportCsvBtn = body.querySelector('#new-chart-export-csv');
    
    resetBtn?.addEventListener('click', () => {
                  chartHost.resetView();
      closeDialog();
    });
    
    exportPngBtn?.addEventListener('click', () => {
      const canvas = chart.canvas;
                  const link = document.createElement('a');
      link.download = `${chartKey}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
                  link.click();
    });
    
    exportCsvBtn?.addEventListener('click', () => {
      const datasets = chart.data.datasets || [];
      const csvData = datasets.map(dataset => {
        const points = dataset.data.map(p => `${new Date(p.x).toISOString()},${p.y}`);
        return `${dataset.label}\n${points.join('\n')}`;
      }).join('\n\n');
      
      const blob = new Blob([csvData], { type: 'text/csv' });
                  const link = document.createElement('a');
      link.download = `${chartKey}-${new Date().toISOString().slice(0, 10)}.csv`;
                  link.href = URL.createObjectURL(blob);
                  link.click();
                  URL.revokeObjectURL(link.href);
              });

    // Afficher les signaux actuels
            const signalsContainer = body.querySelector('#new-chart-signals');
    if (signalsContainer && chart.data.datasets) {
      chart.data.datasets.forEach(dataset => {
        const signalDiv = document.createElement('div');
        signalDiv.className = 'text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded';
        signalDiv.textContent = `${dataset.label} (${dataset.data?.length || 0} points)`;
        signalsContainer.appendChild(signalDiv);
      });
    }
    
    // Charger l'état actuel du chart
    const loadCurrentChartState = () => {
      if (!chart || !chart.options) return;
      
      const options = chart.options;
      const datasets = chart.data.datasets || [];
      
      console.log(`[chart-settings] Chargement de l'état actuel du chart`);
      
      // Charger depuis les paramètres sauvegardés si disponibles, sinon depuis l'état actuel
      let showGrid, showLegend, showTooltips, showCrosshair, yZero, yAuto, timeFormat, lineWidth, tension;
      let alpha = 10, enableZoom = true, enablePan = true, zoomSpeed = 0.1, refreshRate = 1000;
      
      if (chartHost.currentSettings) {
        // Utiliser les paramètres sauvegardés
        const settings = chartHost.currentSettings;
        showGrid = settings.showGrid ?? true;
        showLegend = settings.showLegend ?? true;
        showTooltips = settings.showTooltips ?? true;
        showCrosshair = settings.showCrosshair ?? true;
        yZero = settings.yZero ?? false;
        yAuto = settings.yAuto ?? true;
        timeFormat = settings.timeFormat || 'HH:mm:ss';
        lineWidth = settings.lineWidth || 2;
        tension = settings.tension || 0.1;
        alpha = settings.alpha || 10;
        enableZoom = settings.enableZoom ?? true;
        enablePan = settings.enablePan ?? true;
        zoomSpeed = settings.zoomSpeed || 0.1;
        refreshRate = settings.refreshRate || 1000;
        console.log(`[chart-settings] Paramètres chargés depuis localStorage:`, settings);
      } else {
        // Fallback vers l'état actuel du chart
        showGrid = options.scales?.x?.grid?.display ?? true;
        showLegend = options.plugins?.legend?.display ?? true;
        showTooltips = !options.interaction?.intersect ?? true;
        showCrosshair = options.plugins?.crosshair?.enabled ?? true;
        yZero = options.scales?.y?.min === 0;
        yAuto = !options.scales?.y?.min && !options.scales?.y?.max;
        timeFormat = options.scales?.x?.time?.tooltipFormat || 'HH:mm:ss';
        lineWidth = datasets.length > 0 ? datasets[0].borderWidth || 2 : 2;
        tension = datasets.length > 0 ? datasets[0].tension || 0.1 : 0.1;
        console.log(`[chart-settings] Paramètres chargés depuis l'état actuel du chart`);
      }
      
      // === APPLIQUER AUX CONTRÔLES ===
      const gridCheckbox = body.querySelector('#new-chart-show-grid');
      const legendCheckbox = body.querySelector('#new-chart-show-legend');
      const tooltipsCheckbox = body.querySelector('#new-chart-show-tooltips');
      const crosshairCheckbox = body.querySelector('#new-chart-show-crosshair');
      const yZeroCheckbox = body.querySelector('#new-chart-y-zero');
      const yAutoCheckbox = body.querySelector('#new-chart-y-auto');
      const timeFormatSelect = body.querySelector('#new-chart-time-format');
      const lineWidthSelect = body.querySelector('#new-chart-line-width');
      const tensionSelect = body.querySelector('#new-chart-tension');
      const alphaRange = body.querySelector('#new-chart-alpha');
      const zoomCheckbox = body.querySelector('#new-chart-enable-zoom');
      const panCheckbox = body.querySelector('#new-chart-enable-pan');
      const zoomSpeedRange = body.querySelector('#new-chart-zoom-speed');
      const refreshRateSelect = body.querySelector('#new-chart-refresh-rate');
      
      if (gridCheckbox) gridCheckbox.checked = showGrid;
      if (legendCheckbox) legendCheckbox.checked = showLegend;
      if (tooltipsCheckbox) tooltipsCheckbox.checked = showTooltips;
      if (crosshairCheckbox) crosshairCheckbox.checked = showCrosshair;
      if (yZeroCheckbox) yZeroCheckbox.checked = yZero;
      if (yAutoCheckbox) yAutoCheckbox.checked = yAuto;
      if (timeFormatSelect) timeFormatSelect.value = timeFormat;
      if (lineWidthSelect) lineWidthSelect.value = String(lineWidth);
      if (tensionSelect) tensionSelect.value = String(tension);
      if (alphaRange) alphaRange.value = String(alpha);
      if (zoomCheckbox) zoomCheckbox.checked = enableZoom;
      if (panCheckbox) panCheckbox.checked = enablePan;
      if (zoomSpeedRange) zoomSpeedRange.value = String(zoomSpeed);
      if (refreshRateSelect) refreshRateSelect.value = String(refreshRate);
      
      console.log(`[chart-settings] État chargé: grille=${showGrid}, légende=${showLegend}, tooltips=${showTooltips}, largeur=${lineWidth}px`);
    };
    
    // Initialiser les valeurs par défaut des contrôles
    const initializeControls = () => {
      // Charger l'état actuel du chart
      loadCurrentChartState();
      
      // Valeurs par défaut pour les sliders
      const alphaSlider = body.querySelector('#new-chart-alpha');
      const alphaValue = body.querySelector('#new-chart-alpha-value');
      if (alphaSlider && alphaValue) {
        alphaValue.textContent = alphaSlider.value + '%';
      }
      
      const zoomSpeedSlider = body.querySelector('#new-chart-zoom-speed');
      const zoomSpeedValue = body.querySelector('#new-chart-zoom-speed-value');
      if (zoomSpeedSlider && zoomSpeedValue) {
        zoomSpeedValue.textContent = parseFloat(zoomSpeedSlider.value).toFixed(1) + 'x';
      }
      
      console.log(`[chart-settings] Contrôles initialisés avec l'état actuel`);
    };
    
    // Initialiser les contrôles (sans appliquer les paramètres)
    initializeControls();
    
    // NE PAS appliquer les paramètres initiaux automatiquement
    // Les paramètres seront appliqués seulement quand l'utilisateur clique sur "Valider"
    console.log(`[chart-settings] Contrôles initialisés, en attente des actions utilisateur`);
    
    // === GESTIONNAIRES D'ÉVÉNEMENTS (définis après applySettingsToChart) ===
    
    // Gérer la fermeture avec Escape
    const handleKeydown = (evt) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closeDialog();
      }
    };
    
    // Gérer la fermeture avec clic sur overlay
    const handleBackdropClick = (evt) => {
      if (evt.target === dialog) {
        closeDialog();
      }
    };
    
    // Gérer la fermeture avec le bouton "Fermer"
    const handleCloseButton = (evt) => {
      evt.preventDefault();
      closeDialog();
    };
    
    // Gérer la fermeture avec le bouton "Valider"
    const handleSaveButton = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      console.log(`[chart-settings] Bouton Valider cliqué`);
      
      // Appliquer les paramètres une dernière fois avant de fermer
      applySettingsToChart('save-and-close');
      
      // Attendre un peu pour que les paramètres soient appliqués
      setTimeout(() => {
        closeDialog();
      }, 100);
    };
    
    // Gérer le bouton "Réinitialiser"
    const handleResetButton = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      console.log(`[chart-settings] Bouton Réinitialiser cliqué`);
      
      // Remettre les paramètres par défaut
      const gridCheckbox = body.querySelector('#new-chart-show-grid');
      const legendCheckbox = body.querySelector('#new-chart-show-legend');
      const tooltipsCheckbox = body.querySelector('#new-chart-show-tooltips');
      const crosshairCheckbox = body.querySelector('#new-chart-show-crosshair');
      const yZeroCheckbox = body.querySelector('#new-chart-y-zero');
      const yAutoCheckbox = body.querySelector('#new-chart-y-auto');
      const timeFormatSelect = body.querySelector('#new-chart-time-format');
      const lineWidthSelect = body.querySelector('#new-chart-line-width');
      const tensionSelect = body.querySelector('#new-chart-tension');
      
      // Valeurs par défaut
      if (gridCheckbox) gridCheckbox.checked = true;
      if (legendCheckbox) legendCheckbox.checked = true;
      if (tooltipsCheckbox) tooltipsCheckbox.checked = true;
      if (crosshairCheckbox) crosshairCheckbox.checked = true;
      if (yZeroCheckbox) yZeroCheckbox.checked = false;
      if (yAutoCheckbox) yAutoCheckbox.checked = true;
      if (timeFormatSelect) timeFormatSelect.value = 'HH:mm:ss';
      if (lineWidthSelect) lineWidthSelect.value = '2';
      if (tensionSelect) tensionSelect.value = '0.1';
      
      // Appliquer les paramètres par défaut
      applySettingsToChart('reset');
    };
    
    document.addEventListener('keydown', handleKeydown);
    dialog.addEventListener('click', handleBackdropClick);
    
    // Ajouter les gestionnaires pour les boutons
    const closeBtn = dialog.querySelector('[data-dialog-close]');
    const saveBtn = dialog.querySelector('#chart-settings-save');
    const resetBtnDialog = dialog.querySelector('#chart-settings-reset');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', handleCloseButton);
      console.log(`[chart-settings] Gestionnaire bouton Fermer attaché`);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveButton);
      console.log(`[chart-settings] Gestionnaire bouton Valider attaché`);
    }
    if (resetBtnDialog) {
      resetBtnDialog.addEventListener('click', handleResetButton);
      console.log(`[chart-settings] Gestionnaire bouton Réinitialiser attaché`);
    }
    
    // Stocker les gestionnaires pour les supprimer plus tard
    dialog._keydownHandler = handleKeydown;
    dialog._backdropHandler = handleBackdropClick;
    dialog._closeHandler = handleCloseButton;
    dialog._saveHandler = handleSaveButton;
    dialog._resetHandler = handleResetButton;
    
  }, 100);
  
  dialog.showModal();
}

// Event listeners
document.addEventListener('chart:open-settings', (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  openSettings(chartKey);
});

document.addEventListener('chart:export', (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  openSettings(chartKey);
});

document.addEventListener('chart:reset-view', async (evt) => {
  const { chartKey } = evt.detail || {};
  if (!chartKey) return;
  
  try {
    const { resetChart } = await import('../charts/index.js');
    const success = resetChart(chartKey);
    if (success) {
      console.log(`[chart-settings] Chart ${chartKey} reset via NEW system`);
      return;
    }
  } catch (error) {
    console.warn('[chart-settings] New system reset failed:', error);
  }
  
  console.log(`[chart-settings] Chart ${chartKey} reset via NEW system`);
});

export function initChartSettings() {
  console.log('[chart-settings] Module initialisé - nouveau système uniquement');
}