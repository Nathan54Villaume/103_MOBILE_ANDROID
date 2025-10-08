/**
 * Composant ImageModal pour afficher les images en grand format
 * Gère l'affichage des images dans une modale plein écran
 */

class ImageModal {
  constructor() {
    this.modal = document.getElementById('imageModal');
    this.modalImage = document.getElementById('modalImage');
    this.modalImageTitle = document.getElementById('modalImageTitle');
    
    this.init();
  }

  init() {
    // Event listener pour fermer la modale en cliquant sur le backdrop
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Event listener pour fermer avec Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.close();
      }
    });

    // Event listener pour empêcher la propagation sur l'image
    this.modalImage.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Ouvre la modale avec une image
   * @param {string} src - L'URL de l'image
   * @param {string} title - Le titre de l'image
   */
  open(src, title = '') {
    this.modalImage.src = src;
    this.modalImageTitle.textContent = title || '';
    this.modal.classList.remove('hidden');
    
    // Focus sur la modale pour les raccourcis clavier
    this.modal.focus();
  }

  /**
   * Ferme la modale
   */
  close() {
    this.modal.classList.add('hidden');
    this.modalImage.src = '';
    this.modalImageTitle.textContent = '';
  }

  /**
   * Vérifie si la modale est ouverte
   * @returns {boolean} - True si la modale est ouverte
   */
  isOpen() {
    return !this.modal.classList.contains('hidden');
  }
}

// Exposer globalement
window.ImageModal = ImageModal;
