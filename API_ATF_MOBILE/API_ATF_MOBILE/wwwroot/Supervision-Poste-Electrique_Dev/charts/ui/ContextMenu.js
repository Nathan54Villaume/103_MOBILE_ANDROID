/**
 * ContextMenu.js - Menu contextuel pour sélection des signaux
 * 
 * Fonctionnalités :
 * - Clic droit sur courbe → menu contextuel
 * - Liste des signaux avec checkboxes multi-sélection
 * - Navigation clavier (Tab/Enter/Escape/Arrows)
 * - Positionnement intelligent (évite les débordements)
 * - Accessibility complète (ARIA, focus, screen reader)
 * - Animation fluide d'ouverture/fermeture
 * - Fermeture automatique (clic extérieur, Escape)
 */

export class ContextMenu {
  constructor(signalService, options = {}) {
    this.signalService = signalService;
    this.options = {
      className: 'context-menu',
      maxHeight: 400,
      animationDuration: 200,
      ...options
    };
    
    this.isOpen = false;
    this.currentMenu = null;
    this.currentChart = null;
    this.onSelectionChange = null;
    this.availableSignals = [];
    
    // Bindings
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleSignalToggle = this.handleSignalToggle.bind(this);
    
    this.init();
  }

  /**
   * Initialise le gestionnaire de menu contextuel
   */
  init() {
    // Charger les signaux disponibles
    this.loadAvailableSignals();
    
    // Event listeners globaux
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown);
    
    console.log('[ContextMenu] Initialisé');
  }

  /**
   * Charge les signaux disponibles depuis le service
   */
  async loadAvailableSignals() {
    try {
      this.availableSignals = await this.signalService.getAvailableSignals();
      console.log(`[ContextMenu] ${this.availableSignals.length} signaux disponibles`);
    } catch (error) {
      console.error('[ContextMenu] Erreur chargement signaux:', error);
      this.availableSignals = [];
    }
  }

  /**
   * Affiche le menu contextuel
   * @param {MouseEvent} event - Événement de clic droit
   * @param {Object} chartInstance - Instance Chart.js
   * @param {Array<string>} currentSignals - Signaux actuellement sélectionnés
   * @param {Function} onSelectionChange - Callback changement sélection
   */
  show(event, chartInstance, currentSignals = [], onSelectionChange = null) {
    event.preventDefault();
    
    // Fermer le menu existant
    this.hide();
    
    this.currentChart = chartInstance;
    this.onSelectionChange = onSelectionChange;
    
    // Créer le menu
    this.currentMenu = this.createMenuElement(currentSignals);
    
    // Positionner le menu
    this.positionMenu(this.currentMenu, event.clientX, event.clientY);
    
    // Ajouter au DOM avec animation
    document.body.appendChild(this.currentMenu);
    
    // Animation d'ouverture
    requestAnimationFrame(() => {
      this.currentMenu.classList.add('context-menu--open');
    });
    
    // Focus sur le premier élément
    this.focusFirstItem();
    
    this.isOpen = true;
    console.log('[ContextMenu] Menu ouvert');
  }

  /**
   * Ferme le menu contextuel
   */
  hide() {
    if (!this.currentMenu || !this.isOpen) return;
    
    // Animation de fermeture
    this.currentMenu.classList.add('context-menu--closing');
    
    setTimeout(() => {
      if (this.currentMenu && this.currentMenu.parentNode) {
        this.currentMenu.parentNode.removeChild(this.currentMenu);
      }
      this.currentMenu = null;
      this.isOpen = false;
    }, this.options.animationDuration);
    
    console.log('[ContextMenu] Menu fermé');
  }

  /**
   * Crée l'élément DOM du menu
   * @param {Array<string>} currentSignals - Signaux sélectionnés
   * @returns {HTMLElement} Élément menu
   */
  createMenuElement(currentSignals) {
    const menu = document.createElement('div');
    menu.className = this.options.className;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Sélection des signaux');
    menu.id = 'context-menu-' + Date.now();
    
    // Style de base
    Object.assign(menu.style, {
      position: 'fixed',
      zIndex: '10000',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      minWidth: '280px',
      maxWidth: '400px',
      maxHeight: `${this.options.maxHeight}px`,
      overflowY: 'auto',
      overflowX: 'hidden',
      opacity: '0',
      transform: 'scale(0.9) translateY(-10px)',
      transition: `all ${this.options.animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      fontSize: '14px',
      color: '#e2e8f0'
    });
    
    // En-tête
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #334155;
      font-weight: 600;
      font-size: 13px;
      color: #f1f5f9;
      background: #0f172a;
      border-radius: 8px 8px 0 0;
    `;
    header.textContent = 'Signaux disponibles';
    menu.appendChild(header);
    
    // Message de chargement si pas de signaux
    if (this.availableSignals.length === 0) {
      const loading = document.createElement('div');
      loading.style.cssText = `
        padding: 16px;
        text-align: center;
        color: #94a3b8;
        font-style: italic;
      `;
      loading.textContent = 'Chargement des signaux...';
      menu.appendChild(loading);
      
      // Recharger les signaux
      this.loadAvailableSignals().then(() => {
        if (this.isOpen && this.currentMenu === menu) {
          // Recréer le menu avec les signaux
          const newMenu = this.createMenuElement(currentSignals);
          this.replaceMenu(menu, newMenu);
        }
      });
      
      return menu;
    }
    
    // Grouper les signaux
    const groups = this.groupSignals(this.availableSignals);
    
    // Container scrollable
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
      max-height: ${this.options.maxHeight - 60}px;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    
    // Créer les groupes
    Object.entries(groups).forEach(([groupName, signals], groupIndex) => {
      if (groupIndex > 0) {
        // Séparateur entre groupes
        const separator = document.createElement('div');
        separator.style.cssText = `
          border-top: 1px solid #334155;
          margin: 4px 0;
        `;
        scrollContainer.appendChild(separator);
      }
      
      // Titre du groupe
      if (Object.keys(groups).length > 1) {
        const groupHeader = document.createElement('div');
        groupHeader.style.cssText = `
          padding: 8px 16px;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #0f172a;
        `;
        groupHeader.textContent = groupName;
        scrollContainer.appendChild(groupHeader);
      }
      
      // Items du groupe
      signals.forEach((signal, index) => {
        const item = this.createSignalItem(signal, currentSignals.includes(signal.id));
        scrollContainer.appendChild(item);
      });
    });
    
    menu.appendChild(scrollContainer);
    
    // Pied de page avec actions
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 8px 12px;
      border-top: 1px solid #334155;
      background: #0f172a;
      border-radius: 0 0 8px 8px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    `;
    
    // Bouton "Tout sélectionner"
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Tout sélectionner';
    selectAllBtn.style.cssText = `
      background: #374151;
      color: #d1d5db;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    selectAllBtn.addEventListener('click', () => this.selectAllSignals(true));
    selectAllBtn.addEventListener('mouseover', () => {
      selectAllBtn.style.background = '#4b5563';
    });
    selectAllBtn.addEventListener('mouseout', () => {
      selectAllBtn.style.background = '#374151';
    });
    
    // Bouton "Désélectionner tout"
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Désélectionner';
    deselectAllBtn.style.cssText = selectAllBtn.style.cssText;
    deselectAllBtn.addEventListener('click', () => this.selectAllSignals(false));
    deselectAllBtn.addEventListener('mouseover', () => {
      deselectAllBtn.style.background = '#4b5563';
    });
    deselectAllBtn.addEventListener('mouseout', () => {
      deselectAllBtn.style.background = '#374151';
    });
    
    footer.appendChild(selectAllBtn);
    footer.appendChild(deselectAllBtn);
    menu.appendChild(footer);
    
    return menu;
  }

  /**
   * Crée un item de signal
   * @param {Object} signal - Signal {id, label, unit, group}
   * @param {boolean} checked - État initial
   * @returns {HTMLElement} Élément item
   */
  createSignalItem(signal, checked) {
    const item = document.createElement('div');
    item.className = 'context-menu__item';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', checked);
    item.setAttribute('tabindex', '0');
    item.dataset.signalId = signal.id;
    
    item.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.2s;
      user-select: none;
    `;
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = `
      margin: 0;
      accent-color: #6366f1;
      cursor: pointer;
    `;
    
    // Label et unité
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    
    const labelText = document.createElement('div');
    labelText.textContent = signal.label;
    labelText.style.cssText = `
      color: ${checked ? '#f1f5f9' : '#e2e8f0'};
      font-weight: ${checked ? '500' : '400'};
      line-height: 1.3;
    `;
    
    const unitText = document.createElement('div');
    unitText.textContent = signal.unit ? `Unité: ${signal.unit}` : 'Sans unité';
    unitText.style.cssText = `
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
    `;
    
    labelContainer.appendChild(labelText);
    labelContainer.appendChild(unitText);
    
    item.appendChild(checkbox);
    item.appendChild(labelContainer);
    
    // Events
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleSignalToggle(signal.id);
    });
    
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleSignalToggle(signal.id);
      }
    });
    
    // Hover effects
    item.addEventListener('mouseover', () => {
      item.style.background = '#334155';
    });
    
    item.addEventListener('mouseout', () => {
      item.style.background = 'transparent';
    });
    
    item.addEventListener('focus', () => {
      item.style.background = '#334155';
      item.style.outline = '2px solid #6366f1';
    });
    
    item.addEventListener('blur', () => {
      item.style.background = 'transparent';
      item.style.outline = 'none';
    });
    
    return item;
  }

  /**
   * Groupe les signaux par catégorie
   * @param {Array} signals - Liste des signaux
   * @returns {Object} Signaux groupés
   */
  groupSignals(signals) {
    const groups = {};
    
    signals.forEach(signal => {
      const group = signal.group || 'Autres';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(signal);
    });
    
    // Trier les signaux dans chaque groupe
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => a.label.localeCompare(b.label));
    });
    
    return groups;
  }

  /**
   * Positionne le menu pour éviter les débordements
   * @param {HTMLElement} menu - Élément menu
   * @param {number} x - Position X du clic
   * @param {number} y - Position Y du clic
   */
  positionMenu(menu, x, y) {
    // Mesurer le menu (temporairement ajouté hors écran)
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.style.opacity = '0';
    document.body.appendChild(menu);
    
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    document.body.removeChild(menu);
    
    // Calculer la position optimale
    let finalX = x;
    let finalY = y;
    
    // Éviter débordement droite
    if (x + rect.width > viewportWidth - 20) {
      finalX = x - rect.width;
    }
    
    // Éviter débordement gauche
    if (finalX < 20) {
      finalX = 20;
    }
    
    // Éviter débordement bas
    if (y + rect.height > viewportHeight - 20) {
      finalY = y - rect.height;
    }
    
    // Éviter débordement haut
    if (finalY < 20) {
      finalY = 20;
    }
    
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
  }

  /**
   * Replace le menu actuel
   * @param {HTMLElement} oldMenu - Ancien menu
   * @param {HTMLElement} newMenu - Nouveau menu
   */
  replaceMenu(oldMenu, newMenu) {
    if (oldMenu.parentNode) {
      const rect = oldMenu.getBoundingClientRect();
      newMenu.style.left = `${rect.left}px`;
      newMenu.style.top = `${rect.top}px`;
      
      oldMenu.parentNode.insertBefore(newMenu, oldMenu);
      oldMenu.parentNode.removeChild(oldMenu);
      
      this.currentMenu = newMenu;
      
      // Animation d'ouverture
      requestAnimationFrame(() => {
        newMenu.classList.add('context-menu--open');
      });
      
      this.focusFirstItem();
    }
  }

  /**
   * Focus sur le premier item
   */
  focusFirstItem() {
    if (!this.currentMenu) return;
    
    const firstItem = this.currentMenu.querySelector('.context-menu__item[tabindex="0"]');
    if (firstItem) {
      firstItem.focus();
    }
  }

  /**
   * Sélectionne/désélectionne tous les signaux
   * @param {boolean} selected - État de sélection
   */
  selectAllSignals(selected) {
    if (!this.currentMenu) return;
    
    const items = this.currentMenu.querySelectorAll('.context-menu__item');
    const selectedSignals = [];
    
    items.forEach(item => {
      const signalId = item.dataset.signalId;
      const checkbox = item.querySelector('input[type="checkbox"]');
      const labelText = item.querySelector('div div');
      
      if (checkbox && labelText) {
        checkbox.checked = selected;
        item.setAttribute('aria-checked', selected);
        labelText.style.color = selected ? '#f1f5f9' : '#e2e8f0';
        labelText.style.fontWeight = selected ? '500' : '400';
        
        if (selected) {
          selectedSignals.push(signalId);
        }
      }
    });
    
    // Notifier le changement
    if (this.onSelectionChange) {
      this.onSelectionChange(selected ? selectedSignals : []);
    }
  }

  /**
   * Gère le toggle d'un signal
   * @param {string} signalId - ID du signal
   */
  handleSignalToggle(signalId) {
    const item = this.currentMenu?.querySelector(`[data-signal-id="${signalId}"]`);
    if (!item) return;
    
    const checkbox = item.querySelector('input[type="checkbox"]');
    const labelText = item.querySelector('div div');
    
    if (!checkbox || !labelText) return;
    
    // Toggle
    checkbox.checked = !checkbox.checked;
    const checked = checkbox.checked;
    
    item.setAttribute('aria-checked', checked);
    labelText.style.color = checked ? '#f1f5f9' : '#e2e8f0';
    labelText.style.fontWeight = checked ? '500' : '400';
    
    // Récupérer tous les signaux sélectionnés
    const selectedSignals = Array.from(
      this.currentMenu.querySelectorAll('.context-menu__item input[type="checkbox"]:checked')
    ).map(cb => cb.closest('.context-menu__item').dataset.signalId);
    
    // Notifier le changement
    if (this.onSelectionChange) {
      this.onSelectionChange(selectedSignals);
    }
    
    console.log(`[ContextMenu] Signal ${signalId} ${checked ? 'sélectionné' : 'désélectionné'}`);
  }

  /**
   * Gère les clics sur le document
   * @param {MouseEvent} event - Événement de clic
   */
  handleDocumentClick(event) {
    if (this.isOpen && this.currentMenu && !this.currentMenu.contains(event.target)) {
      this.hide();
    }
  }

  /**
   * Gère les touches du clavier
   * @param {KeyboardEvent} event - Événement clavier
   */
  handleKeyDown(event) {
    if (!this.isOpen || !this.currentMenu) return;
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;
        
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        this.navigateItems(event.key === 'ArrowDown' ? 1 : -1);
        break;
    }
  }

  /**
   * Navigation entre les items
   * @param {number} direction - 1 pour bas, -1 pour haut
   */
  navigateItems(direction) {
    const items = Array.from(this.currentMenu.querySelectorAll('.context-menu__item[tabindex="0"]'));
    const focused = document.activeElement;
    const currentIndex = items.indexOf(focused);
    
    if (currentIndex === -1) {
      // Aucun focus, prendre le premier ou dernier
      const targetIndex = direction > 0 ? 0 : items.length - 1;
      if (items[targetIndex]) {
        items[targetIndex].focus();
      }
    } else {
      // Calculer le nouvel index
      let newIndex = currentIndex + direction;
      
      // Boucler aux extrémités
      if (newIndex < 0) {
        newIndex = items.length - 1;
      } else if (newIndex >= items.length) {
        newIndex = 0;
      }
      
      if (items[newIndex]) {
        items[newIndex].focus();
      }
    }
  }

  /**
   * Nettoyage et destruction
   */
  destroy() {
    this.hide();
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    console.log('[ContextMenu] Détruit');
  }
}
