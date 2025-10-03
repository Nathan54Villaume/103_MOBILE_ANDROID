/**
 * Composant Drawer pour afficher les détails d'un projet
 * Gère l'affichage des informations détaillées dans un panneau latéral
 */

class Drawer {
  constructor() {
    this.drawer = document.getElementById('drawer');
    this.drawerTitle = document.getElementById('drawerTitle');
    this.drawerArea = document.getElementById('drawerArea');
    this.drawerObjective = document.getElementById('drawerObjective');
    this.drawerReal = document.getElementById('drawerReal');
    this.drawerResults = document.getElementById('drawerResults');
    this.drawerSkills = document.getElementById('drawerSkills');
    this.drawerMedia = document.getElementById('drawerMedia');
    this.drawerMediaSection = document.getElementById('drawerMediaSection');
    this.drawerImages = document.getElementById('drawerImages');
    this.drawerImagesSection = document.getElementById('drawerImagesSection');
    this.drawerSkillsSection = document.getElementById('drawerSkillsSection');
    this.drawerSkillsTitle = document.getElementById('drawerSkillsTitle');
    
    this.currentProjectId = null;
    this.init();
  }

  init() {
    // Event listeners pour fermer le drawer
    this.drawer.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) {
        this.close();
      }
    });
    
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  /**
   * Ouvre le drawer avec les informations d'un projet
   * @param {Object} project - L'objet projet à afficher
   */
  open(project) {
    this.currentProjectId = project.id;
    window.currentProjectId = this.currentProjectId;
    
    // Utiliser les traductions si disponibles, sinon fallback sur les données originales
    const projectTitle = window.i18n.t(`project.${project.id}.title`) || project.title;
    const projectObjective = window.i18n.t(`project.${project.id}.objective`) || project.objective;
    const projectReal = window.i18n.t(`project.${project.id}.real`) || project.real;
    const projectResults = window.i18n.t(`project.${project.id}.results`) || project.results;
    
    // Mapping des zones des projets
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
    
    // Mettre à jour le contenu
    this.drawerTitle.textContent = projectTitle;
    this.drawerArea.textContent = translatedArea;
    this.drawerObjective.textContent = projectObjective;
    this.drawerReal.innerHTML = projectReal.map(x => `<li>${x}</li>`).join('');
    this.drawerResults.innerHTML = projectResults.map(x => `<li>${x}</li>`).join('');
    
    // Réinitialiser la section des compétences pour un projet normal
    this.drawerSkillsSection.classList.remove('hidden');
    this.drawerSkillsTitle.textContent = window.i18n.t('drawer.skills');
    this.drawerSkills.innerHTML = project.skills.map(skill => 
      `<span class="chip text-xs px-3 py-1 rounded-full bg-white/10">${skill}</span>`
    ).join('');

    // Charger les commentaires avec le nouveau composant V2
    if (window.commentsComponent) {
      window.commentsComponent.setEntity(project.id);
    }

    // Afficher les images
    this.renderImages(project.images);

    // Afficher les médias
    this.renderMedia(project.media);

    // Afficher le drawer
    this.drawer.classList.remove('hidden');
  }

  /**
   * Ferme le drawer
   */
  close() {
    this.drawer.classList.add('hidden');
    this.currentProjectId = null;
    window.currentProjectId = null;
  }

  /**
   * Rend les images du projet
   * @param {Array} images - Tableau des images à afficher
   */
  renderImages(images) {
    if (!images || images.length === 0) {
      this.drawerImagesSection.classList.add('hidden');
      return;
    }

    this.drawerImagesSection.classList.remove('hidden');
    this.drawerImages.innerHTML = images.map((img, i) => {
      // Mapping des légendes d'images
      const titleMapping = {
        'Étiquette roquette': window.i18n.t('image.etiquette-roquette'),
        'Interface supervision': window.i18n.t('image.interface-supervision'),
        'Interface RFID': window.i18n.t('image.interface-rfid'),
        'Badge opérateur': window.i18n.t('image.badge-operateur'),
        'Interface RFID ATR': window.i18n.t('image.interface-rfid-atr'),
        'Tableau de bord énergétique': window.i18n.t('image.tableau-bord-energetique'),
        'Écran d\'accueil': window.i18n.t('image.ecran-accueil'),
        'Liste des Gammes': window.i18n.t('image.liste-gammes'),
        'Validation étapes': window.i18n.t('image.validation-etapes'),
        'Interface Parametres': window.i18n.t('image.interface-parametres'),
        'Supervision soudures': window.i18n.t('image.supervision-soudures'),
        'Historique paramètres': window.i18n.t('image.historique-parametres'),
        'Caméra de détection': window.i18n.t('image.camera-detection')
      };
      
      const translatedTitle = titleMapping[img.title] || img.title;
      const safeTitle = (translatedTitle || '').replace(/'/g, "\\'");
      
      return `
        <div class="relative group cursor-pointer" onclick="window.imageModal.open('${img.src}', '${safeTitle}')">
          <img src="${img.src}" alt="${translatedTitle || 'Capture ' + (i+1)}" 
               class="w-full h-48 object-cover rounded-xl border border-white/10 transition-transform hover:scale-105" />
          ${translatedTitle ? `<p class="text-xs text-slate-400 mt-1">${translatedTitle}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Rend les médias du projet (graphiques, etc.)
   * @param {Array} media - Tableau des médias à afficher
   */
  renderMedia(media) {
    if (!media || media.length === 0) {
      this.drawerMediaSection.classList.add('hidden');
      return;
    }

    this.drawerMediaSection.classList.remove('hidden');
    this.drawerMedia.innerHTML = media.map((m, i) => {
      if (m.type === 'chart') {
        return `<canvas data-chart-id="${this.currentProjectId}-media-${i}" height="140" class="rounded-xl bg-ink-700 p-2 border border-white/10"></canvas>`;
      }
      return '';
    }).join('');

    // Initialiser les graphiques
    media.forEach((m, i) => {
      if (m.type === 'chart') {
        setTimeout(() => {
          this.initChart(m, i);
        }, 100);
      }
    });
  }

  /**
   * Initialise un graphique Chart.js
   * @param {Object} media - L'objet média contenant les infos du graphique
   * @param {number} index - L'index du graphique
   */
  initChart(media, index) {
    const canvas = document.querySelector(`canvas[data-chart-id="${this.currentProjectId}-media-${index}"]`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({length: 12}, (_, k) => `${k}:00`),
        datasets: [{
          label: media.label || 'Série',
          data: Array.from({length: 12}, () => Math.round(Math.random() * 100)),
          fill: false,
          borderColor: '#10b981',
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          }
        }
      }
    });
  }

  /**
   * Affiche le lexique des compétences
   * @param {Array} projects - Liste des projets pour extraire les compétences
   */
  showSkillsLexicon(projects) {
    const allSkills = window.DashboardUtils.uniq(projects.flatMap(p => p.skills)).sort();
    
    this.drawerTitle.textContent = window.i18n.t('skills.lexicon.title');
    this.drawerArea.textContent = `${allSkills.length} ${window.i18n.t('skills.lexicon.subtitle')}`;
    
    // Créer les bulles cliquables DANS l'objectif (en haut)
    const chipsHTML = allSkills.map(skill => {
      const safeId = skill.replace(/[^a-zA-Z0-9]/g, '_');
      return `<span class="chip text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-brand-500/30 cursor-pointer transition-colors" onclick="window.drawer.scrollToSkill('${safeId}')">${skill}</span>`;
    }).join('');
    
    this.drawerObjective.innerHTML = `
      <p class="text-slate-200 mb-4">${window.i18n.t('skills.lexicon.description')}</p>
      <div class="mt-4 p-3 rounded-lg bg-slate-800/60 border border-slate-600/30">
        <p class="text-xs uppercase tracking-wide text-slate-400 mb-3">${window.i18n.t('skills.lexicon.clickHint')}</p>
        <div class="flex flex-wrap gap-2">${chipsHTML}</div>
      </div>
    `;
    
    // Créer le lexique avec IDs dans REALISATION
    const currentLang = window.i18n.getLang();
    const lexiqueHTML = allSkills.map(skill => {
      const description = window.skillsLexicon?.[currentLang]?.[skill] || window.i18n.t('skills.lexicon.defaultDesc');
      const safeId = skill.replace(/[^a-zA-Z0-9]/g, '_');
      return `
        <div id="skill-${safeId}" class="skill-card mb-4 p-4 rounded-xl bg-ink-700/60 border border-white/10 hover:border-brand-500/30 transition-all">
          <h4 class="text-base font-semibold text-brand-400 mb-2 flex items-center gap-2">
            <span class="text-brand-500">▸</span> ${skill}
          </h4>
          <p class="text-sm text-slate-300 leading-relaxed">${description}</p>
        </div>
      `;
    }).join('');
    
    this.drawerReal.innerHTML = lexiqueHTML;
    this.drawerResults.innerHTML = '';
    this.drawerSkillsSection.classList.add('hidden');
    this.drawerMediaSection.classList.add('hidden');
    this.drawerImagesSection.classList.add('hidden');
    
    this.drawer.classList.remove('hidden');
  }

  /**
   * Scroll vers une compétence et la met en surbrillance
   * @param {string} skillId - L'ID de la compétence
   */
  scrollToSkill(skillId) {
    const element = document.getElementById('skill-' + skillId);
    if (!element) return;

    // Enlever le highlight de tous les éléments
    document.querySelectorAll('.skill-card').forEach(card => {
      card.classList.remove('bg-brand-500/20', 'border-brand-500', 'scale-105');
    });
    
    // Scroller vers l'élément
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Ajouter le highlight
    element.classList.add('bg-brand-500/20', 'border-brand-500', 'scale-105');
    
    // Retirer le highlight après 2 secondes
    setTimeout(() => {
      element.classList.remove('bg-brand-500/20', 'border-brand-500', 'scale-105');
    }, 2000);
  }
}

// Exposer globalement
window.Drawer = Drawer;
