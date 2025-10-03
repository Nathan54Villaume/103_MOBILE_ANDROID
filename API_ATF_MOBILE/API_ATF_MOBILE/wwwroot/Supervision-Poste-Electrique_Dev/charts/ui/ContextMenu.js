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
    this.handleWheel = this.handleWheel.bind(this);
    
    this.init();
  }

  /**
   * Initialise le gestionnaire de menu contextuel
   */
  init() {
    // Ne pas charger les signaux immédiatement - on le fera à la demande
    // this.loadAvailableSignals(); // Chargé seulement quand le menu s'ouvre
    
    // Event listeners globaux
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('wheel', this.handleWheel, { passive: false });
    
    // ContextMenu initialisé
  }

  /**
   * Charge les signaux disponibles depuis le service
   */
  async loadAvailableSignals() {
    try {
      this.availableSignals = await this.signalService.getAvailableSignals();
      // Signaux disponibles
    } catch (error) {
      // En cas d'erreur, utiliser les signaux de fallback
      console.warn('[ContextMenu] API non disponible, utilisation des signaux de démonstration');
      this.availableSignals = this.signalService.getFallbackSignals();
    }
  }

  /**
   * Affiche le menu contextuel
   * @param {MouseEvent} event - Événement de clic droit
   * @param {Object} chartInstance - Instance Chart.js
   * @param {Array<string>} currentSignals - Signaux actuellement sélectionnés
   * @param {Function} onSelectionChange - Callback changement sélection
   */
  async show(event, chartInstance, currentSignals = [], onSelectionChange = null) {
    console.log('[ContextMenu] show() appelé');
    event.preventDefault();

    // Fermer le menu existant
    this.hide();

    this.currentChart = chartInstance;
    this.onSelectionChange = onSelectionChange;
    this.currentSignals = [...currentSignals]; // Copie des signaux actuels
    
    // Charger les signaux seulement maintenant (à la demande)
    if (this.availableSignals.length === 0) {
      console.log('[ContextMenu] Chargement des signaux...');
      await this.loadAvailableSignals();
    }
    
    // Créer le menu
    this.currentMenu = this.createMenuElement(currentSignals);
    console.log('[ContextMenu] Menu créé:', this.currentMenu);
    
    // Positionner le menu (l'ajoute aussi au DOM)
    this.positionMenu(this.currentMenu, event.clientX, event.clientY);
    console.log('[ContextMenu] Menu positionné à:', event.clientX, event.clientY);
    
    // Animation d'ouverture
    requestAnimationFrame(() => {
      this.currentMenu.classList.add('tesla-context-menu--open');
      console.log('[ContextMenu] Classe tesla-context-menu--open ajoutée');
      console.log('[ContextMenu] Styles du menu:', {
        position: this.currentMenu.style.position,
        left: this.currentMenu.style.left,
        top: this.currentMenu.style.top,
        opacity: this.currentMenu.style.opacity,
        visibility: this.currentMenu.style.visibility,
        zIndex: this.currentMenu.style.zIndex,
        classes: this.currentMenu.className
      });
    });
    
    // Focus sur le premier élément
    this.focusFirstItem();
    
    this.isOpen = true;
    console.log('[ContextMenu] Menu ouvert avec succès');
    
    // Vérification finale
    setTimeout(() => {
      const menuInDOM = document.querySelector(`#${this.currentMenu.id}`);
      console.log('[ContextMenu] Menu dans le DOM:', !!menuInDOM);
      if (menuInDOM) {
        const computedStyle = window.getComputedStyle(menuInDOM);
        console.log('[ContextMenu] Styles calculés:', {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex
        });
      }
    }, 100);
  }

  /**
   * Ferme le menu contextuel
   */
  hide() {
    if (!this.currentMenu || !this.isOpen) return;
    
    // Animation de fermeture
    this.currentMenu.classList.remove('tesla-context-menu--open');
    this.currentMenu.classList.add('tesla-context-menu--closing');
    
    setTimeout(() => {
      if (this.currentMenu && this.currentMenu.parentNode) {
        this.currentMenu.parentNode.removeChild(this.currentMenu);
      }
      this.currentMenu = null;
      this.isOpen = false;
      this.currentChart = null;
      this.onSelectionChange = null;
    }, this.options.animationDuration);
  }

  /**
   * Crée l'élément DOM du menu
   * @param {Array<string>} currentSignals - Signaux sélectionnés
   * @returns {HTMLElement} Élément menu
   */
  createMenuElement(currentSignals) {
    const menu = document.createElement('div');
    menu.className = 'tesla-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Sélection des signaux');
    menu.id = 'context-menu-' + Date.now();
    
    // En-tête Tesla
    const header = document.createElement('div');
    header.className = 'tesla-context-menu-header';
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg class="icon stroke" style="width: 16px; height: 16px; color: var(--tesla-blue);" aria-hidden="true">
          <use href="#i-sliders" />
        </svg>
        <span>Sélection des signaux</span>
      </div>
    `;
    menu.appendChild(header);
    
    // Message de chargement si pas de signaux
    if (this.availableSignals.length === 0) {
      const loading = document.createElement('div');
      loading.className = 'tesla-context-menu-loading';
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
    scrollContainer.className = 'tesla-context-menu-body';
    
    // Créer les groupes
    Object.entries(groups).forEach(([groupName, signals], groupIndex) => {
      if (groupIndex > 0) {
        // Séparateur entre groupes
        const separator = document.createElement('div');
        separator.className = 'tesla-context-menu-separator';
        scrollContainer.appendChild(separator);
      }
      
      // Titre du groupe
      if (Object.keys(groups).length > 1) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tesla-context-menu-group-header';
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
    footer.className = 'tesla-context-menu-footer';
    
    // Bouton "Tout sélectionner"
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'tesla-context-menu-button';
    selectAllBtn.textContent = 'Tout sélectionner';
    selectAllBtn.addEventListener('click', () => this.selectAllSignals(true));
    
    // Bouton "Désélectionner tout"
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'tesla-context-menu-button';
    deselectAllBtn.textContent = 'Désélectionner';
    deselectAllBtn.addEventListener('click', () => this.selectAllSignals(false));
    
    // Bouton "Valider"
    const validateBtn = document.createElement('button');
    validateBtn.className = 'tesla-context-menu-button primary';
    validateBtn.textContent = 'Valider';
    validateBtn.addEventListener('click', () => this.validateSelection());
    
    footer.appendChild(selectAllBtn);
    footer.appendChild(deselectAllBtn);
    footer.appendChild(validateBtn);
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
    const item = document.createElement('button');
    item.className = 'tesla-context-menu-item';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', checked);
    item.setAttribute('tabindex', '0');
    item.dataset.signalId = signal.id;
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    
    // Label et unité
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
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
      color: var(--tesla-gray-400);
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
    const originalPosition = menu.style.position;
    const originalLeft = menu.style.left;
    const originalTop = menu.style.top;
    const originalOpacity = menu.style.opacity;
    
    menu.style.position = 'fixed';
    menu.style.left = '-9999px';
    menu.style.top = '-9999px';
    menu.style.opacity = '0';
    menu.style.visibility = 'hidden';
    
    // Ajouter temporairement pour mesurer
    if (!menu.parentNode) {
      document.body.appendChild(menu);
    }
    
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
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
    
    // Appliquer la position finale
    menu.style.position = 'fixed';
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.opacity = '0'; // Sera animé par CSS
    menu.style.visibility = 'visible';
    
    console.log('[ContextMenu] Position finale:', finalX, finalY, 'Taille:', rect.width, rect.height);
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
    
    // Mettre à jour la liste des signaux actuels
    this.currentSignals = Array.from(
      this.currentMenu.querySelectorAll('.tesla-context-menu-item input[type="checkbox"]:checked')
    ).map(cb => cb.closest('.tesla-context-menu-item').dataset.signalId);
  }

  /**
   * Valide la sélection et ferme le menu
   */
  validateSelection() {
    if (!this.currentMenu) return;
    
    // Récupérer tous les signaux sélectionnés
    const selectedSignals = Array.from(
      this.currentMenu.querySelectorAll('.tesla-context-menu-item input[type="checkbox"]:checked')
    ).map(cb => cb.closest('.tesla-context-menu-item').dataset.signalId);
    
    // Notifier le changement
    if (this.onSelectionChange) {
      this.onSelectionChange(selectedSignals);
    }
    
    // Fermer le menu
    this.hide();
  }

  /**
   * Gère les clics sur le document
   * @param {MouseEvent} event - Événement de clic
   */
  handleDocumentClick(event) {
    if (this.isOpen && this.currentMenu && !this.currentMenu.contains(event.target)) {
      // Empêcher le scroll pendant que le menu est ouvert
      event.preventDefault();
      this.hide();
    }
  }

  /**
   * Gère le scroll de la molette
   * @param {WheelEvent} event - Événement de molette
   */
  handleWheel(event) {
    if (this.isOpen && this.currentMenu) {
      // Empêcher le scroll de la page quand le menu est ouvert
      event.preventDefault();
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
    document.removeEventListener('wheel', this.handleWheel);
    // ContextMenu détruit
  }
}
