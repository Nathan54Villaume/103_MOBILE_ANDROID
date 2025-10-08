/**
 * Fonctions utilitaires pour le Dashboard Projets
 * Contient les fonctions communes utilisées dans l'application
 */

/**
 * Génère un élément chip (badge) avec le texte fourni
 * @param {string} txt - Le texte à afficher dans le chip
 * @returns {string} - Le HTML du chip
 */
function chip(txt) {
  return `<span class="chip text-[11px] px-2 py-1 rounded-full bg-white/5">${txt}</span>`;
}

/**
 * Supprime les doublons d'un tableau
 * @param {Array} arr - Le tableau à traiter
 * @returns {Array} - Le tableau sans doublons
 */
function uniq(arr) { 
  return [...new Set(arr)]; 
}

/**
 * Copie du texte dans le presse-papiers avec fallback
 * @param {string} text - Le texte à copier
 * @returns {Promise} - Promise qui se résout si la copie réussit
 */
function copyToClipboard(text) {
  // Méthode moderne (nécessite HTTPS)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  
  // Méthode de fallback (fonctionne en HTTP)
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful ? Promise.resolve() : Promise.reject(new Error('execCommand failed'));
  } catch (err) {
    document.body.removeChild(textArea);
    return Promise.reject(err);
  }
}

/**
 * Affiche une notification temporaire
 * @param {string} message - Le message à afficher
 * @param {string} type - Le type de notification ('success', 'error', 'info')
 * @param {number} duration - Durée d'affichage en ms (défaut: 3000)
 */
function showNotification(message, type = 'info', duration = 3000) {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-[100] ${colors[type]} text-white p-4 rounded-lg shadow-lg max-w-sm`;
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">${icons[type]}</span>
      <div>
        <p class="font-semibold">${message}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
}

/**
 * Génère un message dynamique pour le partage basé sur les projets
 * @param {string} currentLang - La langue actuelle ('fr' ou 'it')
 * @param {Array} projects - La liste des projets
 * @param {string} currentUrl - L'URL actuelle
 * @returns {string} - Le message formaté
 */
function generateDynamicMessage(currentLang, projects, currentUrl) {
  const activeProjects = projects.filter(p => p.status === 'en_cours').length;
  const completedProjects = projects.filter(p => p.status === 'livre').length;
  
  // Compter les projets par zone (selon les filtres)
  const atsProjects = projects.filter(p => p.filters && p.filters.includes('ATS')).length;
  const atrProjects = projects.filter(p => p.filters && p.filters.includes('ATR')).length;
  const bothProjects = projects.filter(p => p.filters && p.filters.includes('ATS') && p.filters.includes('ATR')).length;
  
  const messages = {
    fr: `Bonjour,

Je souhaitais partager avec vous ma synthèse interactive des projets 2025.

📊 Dashboard Projets 2025 - Synthèse ATS/ATR
${currentUrl}

Cette synthèse présente l'ensemble des projets techniques réalisés cette année, avec :
• ${projects.length} projets au total (${activeProjects} en cours, ${completedProjects} terminés)
• ${atsProjects} projets ATS, ${atrProjects} projets ATR, ${bothProjects} projets mixtes
• Détails techniques et résultats obtenus
• Compétences mobilisées et technologies utilisées
• Captures d'écran et démonstrations

Le dashboard est interactif et permet de naviguer dans chaque projet pour découvrir les réalisations, objectifs et impacts business.

N'hésitez pas à me faire vos retours si vous souhaitez plus de détails sur un projet spécifique.

Cordialement,
Nathan Villaume`,
    it: `Buongiorno,

Desideravo condividere con voi la mia sintesi interattiva dei progetti 2025.

📊 Dashboard Progetti 2025 - Sintesi ATS/ATR
${currentUrl}

Questa sintesi presenta l'insieme dei progetti tecnici realizzati quest'anno, con :
• ${projects.length} progetti totali (${activeProjects} in corso, ${completedProjects} completati)
• ${atsProjects} progetti ATS, ${atrProjects} progetti ATR, ${bothProjects} progetti misti
• Dettagli tecnici e risultati ottenuti
• Competenze mobilitate e tecnologie utilizzate
• Screenshot e dimostrazioni

La dashboard è interattiva e permette di navigare in ogni progetto per scoprire le realizzazioni, obiettivi e impatti business.

Non esitate a farmi i vostri feedback se desiderate maggiori dettagli su un progetto specifico.

Cordiali saluti,
Nathan Villaume`
  };
  
  return messages[currentLang] || messages.fr;
}

/**
 * Valide un mot de passe administrateur
 * @param {string} password - Le mot de passe à valider
 * @returns {boolean} - True si le mot de passe est valide
 */
function validateAdminPassword(password) {
  return password === 'admin';
}

/**
 * Formate une date selon la locale
 * @param {Date} date - La date à formater
 * @param {string} locale - La locale à utiliser (défaut: 'fr-FR')
 * @returns {string} - La date formatée
 */
function formatDate(date, locale = 'fr-FR') {
  return date.toLocaleString(locale);
}

/**
 * Débounce une fonction pour éviter les appels trop fréquents
 * @param {Function} func - La fonction à débouncer
 * @param {number} wait - Le délai d'attente en ms
 * @returns {Function} - La fonction débouncée
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle une fonction pour limiter la fréquence d'exécution
 * @param {Function} func - La fonction à throttler
 * @param {number} limit - La limite de temps en ms
 * @returns {Function} - La fonction throttlée
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Vérifie si un élément est visible dans le viewport
 * @param {HTMLElement} element - L'élément à vérifier
 * @returns {boolean} - True si l'élément est visible
 */
function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll fluide vers un élément
 * @param {HTMLElement} element - L'élément vers lequel scroller
 * @param {Object} options - Options de scroll (behavior, block, etc.)
 */
function scrollToElement(element, options = {}) {
  const defaultOptions = {
    behavior: 'smooth',
    block: 'center'
  };
  
  element.scrollIntoView({ ...defaultOptions, ...options });
}

/**
 * Génère un ID unique
 * @param {string} prefix - Préfixe pour l'ID (optionnel)
 * @returns {string} - Un ID unique
 */
function generateUniqueId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return prefix ? `${prefix}-${timestamp}-${randomStr}` : `${timestamp}-${randomStr}`;
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * @param {string} text - Le texte à échapper
 * @returns {string} - Le texte échappé
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Charge un fichier JSON de manière asynchrone
 * @param {string} url - L'URL du fichier JSON
 * @returns {Promise} - Promise qui se résout avec les données JSON
 */
async function loadJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement du JSON:', error);
    throw error;
  }
}

/**
 * Sauvegarde des données dans le localStorage
 * @param {string} key - La clé de sauvegarde
 * @param {any} data - Les données à sauvegarder
 */
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
  }
}

/**
 * Charge des données depuis le localStorage
 * @param {string} key - La clé de chargement
 * @param {any} defaultValue - Valeur par défaut si la clé n'existe pas
 * @returns {any} - Les données chargées ou la valeur par défaut
 */
function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Erreur lors du chargement:', error);
    return defaultValue;
  }
}

// Exposer les fonctions globalement
window.DashboardUtils = {
  chip,
  uniq,
  copyToClipboard,
  showNotification,
  generateDynamicMessage,
  validateAdminPassword,
  formatDate,
  debounce,
  throttle,
  isElementInViewport,
  scrollToElement,
  generateUniqueId,
  escapeHtml,
  loadJson,
  saveToLocalStorage,
  loadFromLocalStorage
};
