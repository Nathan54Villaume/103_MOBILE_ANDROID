/**
 * Dashboard Projets 2025 - Fichier principal
 * Orchestre tous les modules et composants de l'application
 */

class DashboardApp {
  constructor() {
    this.data = [];
    this.activeFilter = 'all';
    this.activeStatus = 'all';
    this.commentsComponent = null;
    this.drawer = null;
    this.imageModal = null;
    this.authModal = null;
    this.shareModal = null;
    
    this.init();
  }

  async init() {
    try {
      // Charger les données des projets
      await this.loadData();
      
      // Initialiser les composants
      this.initComponents();
      
      // Initialiser les event listeners
      this.initEventListeners();
      
      // Rendu initial
      this.render();
      
      console.info('✅ Dashboard initialisé avec', this.data.length, 'projets');
      console.info('✅ Système de commentaires V2 initialisé (JSONL multi-utilisateurs)');
      console.info('✅ Système i18n initialisé avec langue:', window.i18n.getLang());
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du dashboard:', error);
    }
  }

  /**
   * Charge les données des projets depuis le fichier JSON
   */
  async loadData() {
    try {
      this.data = await window.DashboardUtils.loadJson('/dashboard-projects/data/projects.json');
      
      // Fallback pour le statut
      this.data.forEach(p => { 
        if (!p.status) p.status = 'livre'; 
      });
      
      // Exposer les données globalement pour la compatibilité
      window.DATA = this.data;
      
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      // Données de fallback en cas d'erreur
      this.data = [];
      window.DATA = [];
    }
  }

  /**
   * Initialise tous les composants
   */
  initComponents() {
    // Initialiser le composant de commentaires V2
    this.commentsComponent = new CommentsComponent('commentsContainer', {
      apiBaseUrl: '/api/commentsv2',
      currentUser: window.__SESSION_USER || null,
      limit: 50
    });
    
    // Initialiser les modales et composants
    this.drawer = new Drawer();
    this.imageModal = new ImageModal();
    this.authModal = new AuthModal();
    this.shareModal = new ShareModal();
    
    // Exposer globalement pour la compatibilité
    window.drawer = this.drawer;
    window.imageModal = this.imageModal;
    window.authModal = this.authModal;
    window.shareModal = this.shareModal;
    window.commentsComponent = this.commentsComponent;
  }

  /**
   * Initialise tous les event listeners
   */
  initEventListeners() {
    // Event listeners pour les filtres
    const filterButtons = document.querySelectorAll('[data-filter]');
    const statusButtons = document.querySelectorAll('[data-status]');

    filterButtons.forEach(btn => btn.addEventListener('click', () => {
      this.activeFilter = btn.dataset.filter;
      filterButtons.forEach(b => b.classList.remove('bg-white/20'));
      btn.classList.add('bg-white/20');
      this.renderFiltered();
    }));

    statusButtons.forEach(btn => btn.addEventListener('click', () => {
      this.activeStatus = btn.dataset.status;
      statusButtons.forEach(b => b.classList.remove('bg-white/20'));
      btn.classList.add('bg-white/20');
      this.renderFiltered();
    }));

    // Event listener pour le KPI compétences
    document.getElementById('kpiSkillsCard').addEventListener('click', () => {
      this.drawer.showSkillsLexicon(this.data);
    });

    // Event listeners pour les boutons principaux
    const btnAddProject = document.getElementById('btnAddProject');
    const btnShare = document.getElementById('btnShare');
    
    // Authentification pour ajouter un projet
    btnAddProject.addEventListener('click', () => {
      this.authModal.show(
        () => this.showProjectForm(), // onSuccess
        () => console.log('Authentification annulée') // onCancel
      );
    });
    
    btnShare.addEventListener('click', () => {
      this.shareModal.show(this.data);
    });
  }

  /**
   * Rend les cartes de projets
   * @param {Array} projects - Liste des projets à afficher
   */
  renderCards(projects) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    projects.forEach(project => {
      const el = document.createElement('article');
      el.className = 'card relative rounded-2xl p-4 shadow-glass hover:shadow-2xl hover:shadow-black/30 transition-shadow duration-300';

      const isEnCours = (project.status || 'livre') === 'en_cours';
      const statusEmoji = isEnCours ? '🟡' : '🟢';
      const statusLabel = isEnCours ? window.i18n.t('status.inProgress') : window.i18n.t('status.completed');

      // Utiliser les traductions si disponibles, sinon fallback sur les données originales
      const projectTitle = window.i18n.t(`project.${project.id}.title`) || project.title;
      const projectObjective = window.i18n.t(`project.${project.id}.objective`) || project.objective;
      const projectRealShort = window.i18n.t(`project.${project.id}.real_short`) || project.real_short || project.real.slice(0, 3);
      const projectResultsShort = window.i18n.t(`project.${project.id}.results_short`) || project.results_short || project.results.slice(0, 3);
      
      // Mapping des zones pour les cartes
      const areaMapping = {
        'ATS · Supervision · SQL': window.i18n.t('area.ats-supervision-sql'),
        'ATS · RFID · Sécurité': window.i18n.t('area.ats-rfid-securite'),
        'ATR · RFID · Sécurité': window.i18n.t('area.atr-rfid-securite'),
        'ATS · ATR · Web · DataViz': window.i18n.t('area.ats-atr-web-dataviz'),
        'Android · API · UX': window.i18n.t('area.android-api-ux'),
        'ATR · Supervision · Qualité': window.i18n.t('area.atr-supervision-qualite'),
        'ATR · Vision · Automatisme': window.i18n.t('area.atr-vision-automatisme')
      };
      const translatedArea = areaMapping[project.area] || project.area;

      el.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="h-10 w-10 rounded-xl bg-brand-500/15 text-brand-400 grid place-items-center">📌</div>
          <div class="flex-1">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-semibold leading-tight flex items-center gap-2">
                ${projectTitle}
                <span class="chip text-[10px] px-2 py-0.5 rounded-full bg-white/5">${statusEmoji} ${statusLabel}</span>
              </h3>
              <button class="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20" data-open>${window.i18n.t('btn.view')}</button>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${translatedArea}</p>
            <div class="mt-4 mb-3 p-3 rounded-lg bg-gradient-to-r from-brand-500/10 to-brand-600/5 border-l-2 border-brand-500">
              <p class="text-xs uppercase tracking-wide text-brand-400 font-semibold mb-1">${window.i18n.t('card.objective')}</p>
              <p class="text-sm text-slate-100 leading-relaxed">${projectObjective}</p>
            </div>
            <div class="flex flex-wrap gap-1 mt-3">${project.skills.slice(0, 5).map(skill => 
              `<span class="chip text-[11px] px-2 py-1 rounded-full bg-white/5">${skill}</span>`
            ).join('')}</div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-ink-700/60 border border-white/10 p-3">
                <p class="text-[10px] text-slate-400">${window.i18n.t('card.realization')}</p>
                <ul class="mt-1 text-sm list-disc list-inside marker:text-brand-500 space-y-1">
                  ${projectRealShort.map(x => `<li>${x}</li>`).join('')}
                </ul>
              </div>
              <div class="rounded-xl bg-ink-700/60 border border-white/10 p-3">
                <p class="text-[10px] text-slate-400">${window.i18n.t('card.results')}</p>
                <ul class="mt-1 text-sm list-disc list-inside marker:text-emerald-400 space-y-1">
                  ${projectResultsShort.map(x => `<li>${x}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;

      // Event listener pour ouvrir le drawer
      el.querySelectorAll('[data-open]').forEach(btn => {
        btn.addEventListener('click', () => this.drawer.open(project));
      });
      
      grid.appendChild(el);
    });
  }

  /**
   * Filtre et rend les projets selon les critères actifs
   */
  renderFiltered() {
    let filteredProjects = this.data;
    
    if (this.activeFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.filters.includes(this.activeFilter));
    }
    
    if (this.activeStatus !== 'all') {
      filteredProjects = filteredProjects.filter(p => (p.status || 'livre') === this.activeStatus);
    }
    
    this.renderCards(filteredProjects);
    this.updateKPIs(filteredProjects);
  }

  /**
   * Met à jour les KPIs
   * @param {Array} projects - Liste des projets pour calculer les KPIs
   */
  updateKPIs(projects) {
    const projectCount = projects.length;
    const resultsCount = projects.reduce((acc, p) => acc + (p.results?.length || 0), 0);
    const skillsCount = window.DashboardUtils.uniq(projects.flatMap(p => p.skills)).length;
    
    document.getElementById('kpiProjects').textContent = projectCount;
    document.getElementById('kpiResults').textContent = resultsCount;
    document.getElementById('kpiSkills').textContent = skillsCount;
  }

  /**
   * Rendu initial de l'application
   */
  render() {
    this.renderCards(this.data);
    this.updateKPIs(this.data);
    document.getElementById('lastUpdate').textContent = window.DashboardUtils.formatDate(new Date());
  }

  /**
   * Affiche le formulaire de création de projet (placeholder)
   */
  showProjectForm() {
    // TODO: Implémenter le formulaire de création de projet
    window.DashboardUtils.showNotification('Formulaire de création de projet - À implémenter dans la phase suivante !', 'info', 3000);
  }

  /**
   * Met à jour le contenu dynamique (appelé lors du changement de langue)
   */
  updateDynamicContent() {
    if (this.data && this.data.length > 0) {
      this.renderCards(this.data);
    }
    
    if (this.drawer && document.getElementById('drawerTitle')?.textContent.includes('Lexique')) {
      this.drawer.showSkillsLexicon(this.data);
    }
    
    // Update comments system if it exists
    if (this.commentsComponent && window.currentProjectId) {
      this.commentsComponent.setEntity(window.currentProjectId);
    }
    
    // Apply translations to comments component if it exists
    if (this.commentsComponent) {
      this.commentsComponent.applyTranslations();
    }
  }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que tous les modules soient chargés
  if (typeof window.DashboardUtils !== 'undefined' && 
      typeof window.i18n !== 'undefined' && 
      typeof window.Drawer !== 'undefined') {
    
    // Initialiser l'application
    window.dashboardApp = new DashboardApp();
    
    // Exposer les fonctions globalement pour la compatibilité
    window.renderCards = (projects) => window.dashboardApp.renderCards(projects);
    window.showAllSkills = () => window.dashboardApp.drawer.showSkillsLexicon(window.dashboardApp.data);
    window.updateDynamicContent = () => window.dashboardApp.updateDynamicContent();
    
  } else {
    console.error('Erreur: Tous les modules ne sont pas chargés');
  }
});
