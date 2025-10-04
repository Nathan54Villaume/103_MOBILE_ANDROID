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
            <div class="compact-settings" style="max-height: 65vh; overflow-y: auto;">
              <style>
                .compact-settings {
                  scrollbar-width: thin;
                  scrollbar-color: var(--tesla-gray-600) transparent;
                }
                
                .compact-settings::-webkit-scrollbar {
                  width: 6px;
                }
                
                .compact-settings::-webkit-scrollbar-track {
                  background: transparent;
                }
                
                .compact-settings::-webkit-scrollbar-thumb {
                  background: var(--tesla-gray-600);
                  border-radius: 3px;
                }
                
                /* STYLES POUR LES CONTRÔLES */
                #chart-settings-dialog input, 
                #chart-settings-dialog select, 
                #chart-settings-dialog button {
                  display: block !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  pointer-events: auto !important;
                }
                
                .settings-row {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 8px;
                  margin-bottom: 8px;
                }
                
                .settings-field {
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                }
                
                .settings-label {
                  font-size: 11px;
                  font-weight: 500;
                  color: var(--tesla-gray-200);
                }
                
                .settings-input,
                .settings-select {
                  background: var(--tesla-gray-800);
                  border: 1px solid var(--tesla-gray-500);
                  border-radius: 4px;
                  padding: 6px 8px;
                  color: var(--tesla-white);
                  font-size: 12px;
                  transition: all 0.2s;
                }
                
                .settings-input:focus,
                .settings-select:focus {
                  outline: none;
                  border-color: var(--tesla-blue);
                  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.15);
                }
                
                .settings-checkbox {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  padding: 4px 6px;
                  border-radius: 4px;
                  transition: background 0.2s;
                  cursor: pointer;
                }
                
                .settings-checkbox:hover {
                  background: var(--tesla-glass-hover);
                }
                
                .settings-checkbox input {
                  width: 14px;
                  height: 14px;
                  accent-color: var(--tesla-blue);
                  cursor: pointer;
                }
                
                .settings-checkbox label {
                  font-size: 11px;
                  color: var(--tesla-gray-100);
                  cursor: pointer;
                }
                
                .settings-divider {
                  height: 1px;
                  background: var(--tesla-border);
                  margin: 10px 0;
                }
                
                .settings-actions {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 6px;
                  margin-top: 10px;
                }
                
                .action-btn {
                  background: var(--tesla-gray-800);
                  border: 1px solid var(--tesla-gray-500);
                  border-radius: 4px;
                  padding: 6px;
                  color: var(--tesla-gray-100);
                  font-size: 11px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: all 0.2s;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                }
                
                .action-btn:hover {
                  background: var(--tesla-gray-700);
                  border-color: var(--tesla-gray-400);
                  transform: translateY(-1px);
                }
                
                
                .collapse-icon {
                  transition: transform 0.3s;
                }
                
                .collapse-icon.expanded {
                  transform: rotate(90deg);
                }
                
                .collapse-content {
                  display: none;
                  margin-top: 8px;
                  padding-top: 8px;
                  border-top: 1px solid var(--tesla-border);
                }
                
                .collapse-content.show {
                  display: block;
                }
                
                .signal-chip {
                  background: var(--tesla-gray-800);
                  border: 1px solid var(--tesla-gray-500);
                  border-radius: 4px;
                  padding: 4px 8px;
                  font-size: 10px;
                  color: var(--tesla-gray-200);
                  margin-top: 8px;
                }
              </style>
      
      <!-- Réglages principaux -->
      <div class="settings-row">
        <div class="settings-field">
          <label class="settings-label">Base de temps</label>
          <select id="new-chart-timerange" class="settings-select">
            <option value="15">15 minutes</option>
            <option value="60">1 heure</option>
            <option value="240">4 heures</option>
            <option value="1440">24 heures</option>
          </select>
        </div>
        <div class="settings-field">
          <label class="settings-label">Épaisseur ligne</label>
          <select id="new-chart-line-width" class="settings-select">
            <option value="1">Fine (1px)</option>
            <option value="2" selected>Normal (2px)</option>
            <option value="3">Épaisse (3px)</option>
            <option value="4">Très épaisse (4px)</option>
          </select>
        </div>
      </div>
      
      <div class="settings-row">
        <div class="settings-checkbox">
          <input type="checkbox" id="new-chart-show-grid" checked>
          <label for="new-chart-show-grid">Grille</label>
        </div>
        <div class="settings-checkbox">
          <input type="checkbox" id="new-chart-show-legend" checked>
          <label for="new-chart-show-legend">Légende</label>
        </div>
      </div>

      
      <!-- Bouton collapse pour paramètres avancés -->
      <button type="button" id="toggle-advanced-settings" style="
        background: var(--tesla-gray-800);
        border: 1px solid var(--tesla-gray-500);
        border-radius: 6px;
        padding: 12px;
        color: var(--tesla-gray-100);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        width: 100%;
        margin-top: 12px;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        line-height: 1;
        vertical-align: middle;
      ">
        <span style="display: inline; white-space: nowrap;">Avancés</span>
        <svg id="chevron-icon" style="width: 14px; height: 14px; display: inline-block; transition: transform 0.3s;" aria-hidden="true">
          <use href="#i-arrow-right" />
        </svg>
      </button>
      
      <!-- Paramètres avancés (collapsé) -->
      <div id="advanced-settings" class="collapse-content">
        <div class="settings-row">
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-show-tooltips" checked>
            <label for="new-chart-show-tooltips">Tooltips</label>
          </div>
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-show-crosshair" checked>
            <label for="new-chart-show-crosshair">Crosshair</label>
          </div>
        </div>
        
        <div class="settings-row">
          <div class="settings-field">
            <label class="settings-label">Lissage courbes</label>
            <select id="new-chart-tension" class="settings-select">
              <option value="0">Aucun</option>
              <option value="0.1" selected>Léger</option>
              <option value="0.3">Moyen</option>
              <option value="0.5">Fort</option>
            </select>
          </div>
          <div class="settings-field">
            <label class="settings-label">Transparence <span id="new-chart-alpha-value">20%</span></label>
            <input type="range" id="new-chart-alpha" min="0" max="100" value="20" 
                   style="width: 100%; height: 4px; background: var(--tesla-gray-700); border-radius: 2px; appearance: none; cursor: pointer; accent-color: var(--tesla-blue);">
          </div>
        </div>
        
        <div class="settings-divider"></div>
        
        <div class="settings-row">
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-y-zero">
            <label for="new-chart-y-zero">Y commence à 0</label>
          </div>
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-y-auto" checked>
            <label for="new-chart-y-auto">Échelle Y auto</label>
          </div>
        </div>
        
        <div class="settings-row">
          <div class="settings-field">
            <label class="settings-label">Format heure X</label>
            <select id="new-chart-time-format" class="settings-select">
              <option value="HH:mm">HH:mm</option>
              <option value="HH:mm:ss" selected>HH:mm:ss</option>
              <option value="dd/MM HH:mm">dd/MM HH:mm</option>
            </select>
          </div>
          <div class="settings-field">
            <label class="settings-label">Unité Y</label>
            <select id="new-chart-y-unit" class="settings-select">
              <option value="auto" selected>Auto</option>
              <option value="kW">kW</option>
              <option value="V">V</option>
              <option value="A">A</option>
            </select>
          </div>
        </div>
        
        <div class="settings-divider"></div>
        
        <div class="settings-row">
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-enable-zoom" checked>
            <label for="new-chart-enable-zoom">Zoom molette</label>
          </div>
          <div class="settings-checkbox">
            <input type="checkbox" id="new-chart-enable-pan" checked>
            <label for="new-chart-enable-pan">Panoramique</label>
          </div>
        </div>
        
        <div class="settings-row">
          <div class="settings-field">
            <label class="settings-label">Sensibilité zoom <span id="new-chart-zoom-speed-value">1.0x</span></label>
            <input type="range" id="new-chart-zoom-speed" min="0.1" max="2" step="0.1" value="1" 
                   style="width: 100%; height: 4px; background: var(--tesla-gray-700); border-radius: 2px; appearance: none; cursor: pointer; accent-color: var(--tesla-blue);">
          </div>
          <div class="settings-field">
            <label class="settings-label">Actualisation</label>
            <select id="new-chart-refresh-rate" class="settings-select">
              <option value="1" selected>1 sec</option>
              <option value="5">5 sec</option>
              <option value="10">10 sec</option>
              <option value="30">30 sec</option>
              <option value="60">1 min</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="settings-divider"></div>
      
      <div class="settings-actions">
        <button type="button" id="new-chart-reset" class="action-btn">
          <svg class="icon stroke" style="width: 12px; height: 12px;" aria-hidden="true"><use href="#i-refresh" /></svg>
          <span>Reset</span>
        </button>
        <button type="button" id="new-chart-export-png" class="action-btn">
          <svg class="icon stroke" style="width: 12px; height: 12px;" aria-hidden="true"><use href="#i-download" /></svg>
          <span>PNG</span>
        </button>
        <button type="button" id="new-chart-export-csv" class="action-btn">
          <svg class="icon stroke" style="width: 12px; height: 12px;" aria-hidden="true"><use href="#i-download" /></svg>
          <span>CSV</span>
        </button>
      </div>
      
      <!-- Signaux -->
      <div id="new-chart-signals" style="display: flex; flex-direction: column; gap: 4px;">
        <!-- Les signaux seront ajoutés dynamiquement -->
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
      
      // Ajouter les événements hover
      toggleAdvancedBtn.addEventListener('mouseenter', () => {
        toggleAdvancedBtn.style.background = 'var(--tesla-gray-700)';
        toggleAdvancedBtn.style.borderColor = 'var(--tesla-gray-400)';
      });
      
      toggleAdvancedBtn.addEventListener('mouseleave', () => {
        toggleAdvancedBtn.style.background = 'var(--tesla-gray-800)';
        toggleAdvancedBtn.style.borderColor = 'var(--tesla-gray-500)';
      });
      
      toggleAdvancedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isHidden = !advancedSettings.classList.contains('show');
          
          if (isHidden) {
            advancedSettings.classList.add('show');
            if (chevronIcon) chevronIcon.classList.add('expanded');
          } else {
            advancedSettings.classList.remove('show');
            if (chevronIcon) chevronIcon.classList.remove('expanded');
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
        signalDiv.className = 'signal-chip';
        signalDiv.textContent = `${dataset.label} (${dataset.data?.length || 0} pts)`;
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
    // Module initialisé - nouveau système uniquement
}