/**
 * Composant AuthModal pour l'authentification administrateur
 * Gère l'affichage du formulaire de connexion pour ajouter des projets
 */

class AuthModal {
  constructor() {
    this.modal = null;
    this.passwordInput = null;
    this.loginBtn = null;
    this.cancelBtn = null;
  }

  /**
   * Affiche la modale d'authentification
   * @param {Function} onSuccess - Callback appelé en cas de succès
   * @param {Function} onCancel - Callback appelé en cas d'annulation
   */
  show(onSuccess, onCancel) {
    const currentLang = window.i18n.getLang();
    
    this.modal = document.createElement('div');
    this.modal.id = 'authModal';
    this.modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80';
    this.modal.innerHTML = `
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/10">
        <div class="flex items-center gap-3 mb-4">
          <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <h3 class="text-xl font-semibold text-white">${window.i18n.t('auth.title')}</h3>
        </div>
        <p class="text-slate-300 mb-6">${window.i18n.t('auth.message')}</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">${window.i18n.t('auth.password')}</label>
            <input type="password" id="adminPassword" class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="${window.i18n.t('auth.password')}">
          </div>
          <div class="flex gap-3">
            <button id="btnAuthLogin" class="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              ${window.i18n.t('auth.login')}
            </button>
            <button id="btnAuthCancel" class="px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
              ${window.i18n.t('auth.cancel')}
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Récupérer les références des éléments
    this.passwordInput = this.modal.querySelector('#adminPassword');
    this.loginBtn = this.modal.querySelector('#btnAuthLogin');
    this.cancelBtn = this.modal.querySelector('#btnAuthCancel');
    
    // Event listeners
    this.loginBtn.addEventListener('click', () => this.handleLogin(onSuccess));
    this.cancelBtn.addEventListener('click', () => this.handleCancel(onCancel));
    
    // Entrée pour valider
    this.passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin(onSuccess);
      }
    });
    
    // Fermer avec Escape
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleCancel(onCancel);
      }
    });
    
    // Fermer en cliquant à l'extérieur
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.handleCancel(onCancel);
      }
    });
    
    // Focus sur le champ password
    setTimeout(() => this.passwordInput.focus(), 100);
  }

  /**
   * Gère la tentative de connexion
   * @param {Function} onSuccess - Callback de succès
   */
  handleLogin(onSuccess) {
    const password = this.passwordInput.value;
    
    if (window.DashboardUtils.validateAdminPassword(password)) {
      this.close();
      if (onSuccess) onSuccess();
    } else {
      this.showError();
    }
  }

  /**
   * Gère l'annulation
   * @param {Function} onCancel - Callback d'annulation
   */
  handleCancel(onCancel) {
    this.close();
    if (onCancel) onCancel();
  }

  /**
   * Affiche un message d'erreur
   */
  showError() {
    // Supprimer ancienne erreur si elle existe
    const existingError = this.modal.querySelector('.text-red-400');
    if (existingError) {
      existingError.remove();
    }
    
    // Afficher nouvelle erreur
    const errorMsg = document.createElement('div');
    errorMsg.className = 'text-red-400 text-sm mt-2';
    errorMsg.textContent = window.i18n.t('auth.error');
    
    this.passwordInput.parentNode.appendChild(errorMsg);
    this.passwordInput.focus();
    this.passwordInput.select();
  }

  /**
   * Ferme la modale
   */
  close() {
    if (this.modal && document.body.contains(this.modal)) {
      document.body.removeChild(this.modal);
    }
    this.modal = null;
    this.passwordInput = null;
    this.loginBtn = null;
    this.cancelBtn = null;
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
window.AuthModal = AuthModal;
