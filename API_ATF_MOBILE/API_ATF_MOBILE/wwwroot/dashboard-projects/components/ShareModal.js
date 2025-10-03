/**
 * Composant ShareModal pour le partage du dashboard
 * Gère l'affichage des options de partage (Teams, Outlook, copie de lien)
 */

class ShareModal {
  constructor() {
    this.modal = null;
  }

  /**
   * Affiche la modale de partage
   * @param {Array} projects - Liste des projets pour générer le message
   */
  show(projects) {
    const currentUrl = window.location.href;
    
    this.modal = document.createElement('div');
    this.modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm';
    this.modal.innerHTML = `
      <div class="bg-ink-800 border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold mb-4" data-i18n="share.title">Partager le dashboard</h3>
        <div class="space-y-3">
          <button class="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-3" onclick="window.shareModal.shareViaTeams()">
            <span class="text-xl">💼</span>
            <span data-i18n="share.teams">Partager via Microsoft Teams</span>
          </button>
          <button class="w-full p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-3" onclick="window.shareModal.shareViaOutlook()">
            <span class="text-xl">📧</span>
            <span data-i18n="share.outlook">Partager via Outlook</span>
          </button>
          <button class="w-full p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-3" onclick="window.shareModal.copyToClipboard()">
            <span class="text-xl">📋</span>
            <span data-i18n="share.copy">Copier le lien</span>
          </button>
        </div>
        <button class="mt-4 w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400" onclick="window.shareModal.close()" data-i18n="btn.close">Fermer</button>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Appliquer les traductions au menu
    window.requestAnimationFrame(() => {
      this.modal.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const translation = window.i18n.t(key);
        if (translation !== key) el.textContent = translation;
      });
    });
    
    // Fermer en cliquant à l'extérieur
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Fermer avec Escape
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    // Stocker les projets pour les fonctions de partage
    this.projects = projects;
  }

  /**
   * Partage via Microsoft Teams
   */
  shareViaTeams() {
    const currentLang = window.i18n.getLang();
    const professionalMessage = window.DashboardUtils.generateDynamicMessage(currentLang, this.projects, window.location.href);

    // Copier le message dans le presse-papiers
    window.DashboardUtils.copyToClipboard(professionalMessage).then(() => {
      // Messages de notification selon la langue
      const notificationMessages = {
        fr: {
          title: 'Message copié !',
          subtitle: 'Collez (Ctrl+V) dans Teams'
        },
        it: {
          title: 'Messaggio copiato!',
          subtitle: 'Incolla (Ctrl+V) in Teams'
        }
      };
      
      const notif = notificationMessages[currentLang] || notificationMessages.fr;
      
      // Afficher une notification
      window.DashboardUtils.showNotification(notif.title, 'success', 4000);
      
      // Essayer d'ouvrir Teams
      try {
        window.location.href = 'msteams:';
      } catch (e) {
        console.log('Erreur ouverture Teams:', e);
      }
      
    }).catch(err => {
      console.error('Erreur copie presse-papiers:', err);
      window.DashboardUtils.showNotification('Impossible de copier le message', 'error', 3000);
    });
    
    this.close();
  }

  /**
   * Partage via Outlook
   */
  shareViaOutlook() {
    const currentLang = window.i18n.getLang();
    const professionalMessage = window.DashboardUtils.generateDynamicMessage(currentLang, this.projects, window.location.href);
    
    // Sujets selon la langue
    const subjects = {
      fr: 'Dashboard Projets 2025 - Synthèse ATS/ATR',
      it: 'Dashboard Progetti 2025 - Sintesi ATS/ATR'
    };
    
    const subject = subjects[currentLang] || subjects.fr;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(professionalMessage)}`;
    
    // Créer un lien invisible pour déclencher l'ouverture
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.close();
  }

  /**
   * Copie le lien dans le presse-papiers
   */
  async copyToClipboard() {
    const currentUrl = window.location.href;
    
    try {
      await window.DashboardUtils.copyToClipboard(currentUrl);
      
      // Afficher une notification de succès
      const btn = this.modal.querySelector('[onclick="window.shareModal.copyToClipboard()"]');
      const originalText = btn.textContent;
      btn.textContent = '✅ Copié !';
      btn.classList.add('bg-green-500/20', 'text-green-400');
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-500/20', 'text-green-400');
      }, 2000);
      
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
      
      // Afficher une notification d'erreur
      const btn = this.modal.querySelector('[onclick="window.shareModal.copyToClipboard()"]');
      const originalText = btn.textContent;
      btn.textContent = '❌ Erreur';
      btn.classList.add('bg-red-500/20', 'text-red-400');
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-red-500/20', 'text-red-400');
      }, 2000);
    }
  }

  /**
   * Ferme la modale
   */
  close() {
    if (this.modal && document.body.contains(this.modal)) {
      document.body.removeChild(this.modal);
    }
    this.modal = null;
    this.projects = null;
  }

  /**
   * Vérifie si la modale est ouverte
   * @returns {boolean} - True si la modale est ouverte
   */
  isOpen() {
    return this.modal !== null && document.body.contains(this.modal);
  }
}

// Exposer globalement
window.ShareModal = ShareModal;
