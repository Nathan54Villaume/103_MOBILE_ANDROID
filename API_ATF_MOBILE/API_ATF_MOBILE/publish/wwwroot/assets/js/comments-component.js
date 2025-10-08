/**
 * Composant de commentaires V2 - Multi-utilisateurs avec pagination
 * Stockage: JSONL dans ApplicationData/API_ATF_MOBILE/comments/
 * 
 * Features:
 * - Liste de commentaires triés du plus récent au plus ancien
 * - Pagination cursor-based
 * - Formulaire avec accordion animé
 * - Optimistic UI avec rollback
 * - Formatage dates Europe/Paris
 * - Sanitization anti-XSS
 * - Rate limiting (10 req/5min)
 */

class CommentsComponent {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.entityId = options.entityId || '';
        this.apiBaseUrl = options.apiBaseUrl || '/api/comments';
        this.currentUser = options.currentUser || null;
        this.limit = options.limit || 50;
        
        this.comments = [];
        this.nextCursor = null;
        this.isLoading = false;
        this.formExpanded = false;
        
        this.init();
    }
    
    /**
     * Initialiser le composant
     */
    init() {
        if (!this.container) {
            console.error('Container non trouvé pour CommentsComponent');
            return;
        }
        
        this.render();
    }
    
    /**
     * Définir l'entité et charger les commentaires
     */
    async setEntity(entityId) {
        this.entityId = entityId;
        this.comments = [];
        this.nextCursor = null;
        await this.loadComments();
    }
    
    /**
     * Charger les commentaires depuis l'API
     */
    async loadComments(append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.updateLoadingState(true);
        
        try {
            const params = new URLSearchParams({
                entityId: this.entityId,
                limit: this.limit.toString()
            });
            
            if (append && this.nextCursor) {
                params.append('cursor', this.nextCursor);
            }
            
            const response = await fetch(`${this.apiBaseUrl}?${params}`);
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (append) {
                this.comments = [...this.comments, ...data.items];
            } else {
                this.comments = data.items;
            }
            
            this.nextCursor = data.nextCursor;
            
            this.renderCommentsList();
        } catch (error) {
            console.error('Erreur lors du chargement des commentaires:', error);
            this.showToast('Erreur lors du chargement des commentaires', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState(false);
        }
    }
    
    /**
     * Ajouter un commentaire (optimistic UI)
     */
    async addComment(authorName, message) {
        // Validation côté client
        if (!authorName || authorName.trim().length < 2) {
            this.showToast('Le nom doit contenir au moins 2 caractères', 'error');
            return;
        }
        
        if (!message || message.trim().length < 1) {
            this.showToast('Le message ne peut pas être vide', 'error');
            return;
        }
        
        // Créer un commentaire temporaire pour l'UI optimiste
        const tempComment = {
            id: 'temp-' + Date.now(),
            entityId: this.entityId,
            authorName: authorName.trim(),
            message: message.trim(),
            createdAt: new Date().toISOString(),
            _isOptimistic: true
        };
        
        // Ajouter immédiatement à la liste (optimistic UI)
        this.comments.unshift(tempComment);
        this.renderCommentsList();
        
        // Fermer le formulaire et réinitialiser
        this.toggleForm(false);
        this.clearForm();
        
        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    entityId: this.entityId,
                    authorName: authorName.trim(),
                    message: message.trim()
                })
            });
            
            if (response.status === 429) {
                throw new Error('Rate limit dépassé. Veuillez réessayer dans quelques minutes.');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erreur ${response.status}`);
            }
            
            const newComment = await response.json();
            
            // Remplacer le commentaire temporaire par le vrai
            const index = this.comments.findIndex(c => c.id === tempComment.id);
            if (index !== -1) {
                this.comments[index] = newComment;
                this.renderCommentsList();
            }
            
            this.showToast('Commentaire ajouté avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout du commentaire:', error);
            
            // Rollback: supprimer le commentaire optimiste
            this.comments = this.comments.filter(c => c.id !== tempComment.id);
            this.renderCommentsList();
            
            this.showToast(error.message || 'Erreur lors de l\'ajout du commentaire', 'error');
            
            // Rouvrir le formulaire avec les données
            this.toggleForm(true);
            const nameInput = this.container.querySelector('#commentAuthorName');
            const messageInput = this.container.querySelector('#commentMessage');
            if (nameInput) nameInput.value = authorName;
            if (messageInput) messageInput.value = message;
        }
    }
    
    /**
     * Formater une date en Europe/Paris
     */
    formatDate(isoDate) {
        const date = new Date(isoDate);
        const formatter = new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        return formatter.format(date);
    }
    
    /**
     * Obtenir les initiales d'un nom
     */
    getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
    
    /**
     * Basculer l'affichage du formulaire
     */
    toggleForm(show = null) {
        this.formExpanded = show !== null ? show : !this.formExpanded;
        
        const form = this.container.querySelector('#commentFormCollapse');
        const textarea = this.container.querySelector('#commentMessage');
        
        if (form) {
            if (this.formExpanded) {
                // 1. Retirer hidden d'abord
                form.classList.remove('hidden');
                // 2. Forcer un reflow pour que le navigateur calcule scrollHeight
                form.offsetHeight;
                // 3. Définir la hauteur pour l'animation
                form.style.maxHeight = form.scrollHeight + 'px';
                // 4. Focus après l'animation
                setTimeout(() => {
                    if (textarea) textarea.focus();
                }, 250);
            } else {
                // 1. Réduire la hauteur
                form.style.maxHeight = '0';
                // 2. Cacher après l'animation
                setTimeout(() => {
                    form.classList.add('hidden');
                }, 250);
            }
        }
    }
    
    /**
     * Effacer le formulaire
     */
    clearForm() {
        const nameInput = this.container.querySelector('#commentAuthorName');
        const messageInput = this.container.querySelector('#commentMessage');
        const charCount = this.container.querySelector('#charCount');
        
        if (messageInput) messageInput.value = '';
        if (charCount) charCount.textContent = '0';
        
        this.updateSubmitButton();
    }
    
    /**
     * Mettre à jour l'état du bouton d'envoi
     */
    updateSubmitButton() {
        const submitBtn = this.container.querySelector('#btnSubmitComment');
        const messageInput = this.container.querySelector('#commentMessage');
        
        if (submitBtn && messageInput) {
            const message = messageInput.value.trim();
            submitBtn.disabled = message.length === 0;
        }
    }
    
    /**
     * Mettre à jour l'état de chargement
     */
    updateLoadingState(loading) {
        const loader = this.container.querySelector('#commentsLoader');
        if (loader) {
            loader.classList.toggle('hidden', !loading);
        }
    }
    
    /**
     * Afficher un toast
     */
    showToast(message, type = 'info') {
        // Créer un toast temporaire
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            'bg-blue-600'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Rendu initial du composant
     */
    render() {
        this.container.innerHTML = `
            <div class="comments-component">
                <!-- En-tête -->
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                        💬 <span data-i18n="comments.title">Commentaires</span>
                        <span id="commentsCount" class="text-xs px-2 py-0.5 rounded-full bg-white/10">0</span>
                    </h4>
                    <button id="btnAddComment" 
                            class="px-3 py-1.5 text-xs rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
                            data-i18n="comments.add">
                        ➕ Ajouter
                    </button>
                </div>
                
                <!-- Formulaire (collapsé par défaut) -->
                <div id="commentFormCollapse" 
                     class="hidden overflow-hidden transition-all duration-250 mb-4"
                     style="max-height: 0;">
                    <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-600/30">
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs text-slate-300 mb-1 block" data-i18n="comments.nameLabel">Nom</label>
                                <input type="text" 
                                       id="commentAuthorName" 
                                       class="w-full px-3 py-2 rounded-lg bg-ink-700 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30"
                                       data-i18n="comments.namePlaceholder"
                                       data-i18n-attr="placeholder"
                                       placeholder="Votre nom"
                                       maxlength="80" />
                            </div>
                            <div>
                                <label class="text-xs text-slate-300 mb-1 block" data-i18n="comments.messageLabel">Message</label>
                                <textarea id="commentMessage" 
                                          class="w-full min-h-[80px] p-3 rounded-lg bg-ink-700 border border-white/10 text-slate-200 text-sm resize-y focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30" 
                                          data-i18n="comments.messagePlaceholder"
                                          data-i18n-attr="placeholder"
                                          placeholder="Votre commentaire..."
                                          maxlength="2000"></textarea>
                                <div class="flex items-center justify-between mt-1">
                                    <span class="text-xs text-slate-400">
                                        <span id="charCount">0</span> <span data-i18n="comments.charCount">/ 2000 caractères</span>
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button id="btnSubmitComment" 
                                        disabled
                                        class="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        data-i18n="comments.send">
                                    💾 Envoyer
                                </button>
                                <button id="btnCancelComment" 
                                        class="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
                                        data-i18n="comments.cancel">
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Liste des commentaires -->
                <div id="commentsList" class="space-y-3">
                    <!-- Les commentaires seront insérés ici -->
                </div>
                
                <!-- Loader -->
                <div id="commentsLoader" class="hidden text-center py-4">
                    <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                </div>
                
                <!-- Bouton "Voir plus" -->
                <div id="loadMoreContainer" class="hidden mt-4 text-center">
                    <button id="btnLoadMore" 
                            class="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
                            data-i18n="comments.loadMore">
                        📄 Voir plus
                    </button>
                </div>
            </div>
        `;
        
        this.attachEventListeners();
        this.applyTranslations();
    }
    
    /**
     * Appliquer les traductions i18n
     */
    applyTranslations() {
        if (!window.i18n) return;
        
        const container = this.container;
        const dict = window.i18n.messages[window.i18n.getLang()] || window.i18n.messages.fr;
        
        // Text nodes
        container.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key] != null) el.textContent = String(dict[key]);
        });

        // Attribute bindings (comma-separated)
        container.querySelectorAll("[data-i18n-attr]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            const attrs = el.getAttribute("data-i18n-attr").split(",").map(s => s.trim());
            const val = dict[key];
            if (val != null) attrs.forEach(a => el.setAttribute(a, String(val)));
        });
    }
    
    /**
     * Rendu de la liste de commentaires
     */
    renderCommentsList() {
        const list = this.container.querySelector('#commentsList');
        const countBadge = this.container.querySelector('#commentsCount');
        const loadMoreContainer = this.container.querySelector('#loadMoreContainer');
        
        if (!list) return;
        
        // Mettre à jour le compteur
        if (countBadge) {
            countBadge.textContent = this.comments.length;
        }
        
        // Afficher/masquer le bouton "Voir plus"
        if (loadMoreContainer) {
            loadMoreContainer.classList.toggle('hidden', !this.nextCursor);
        }
        
        // Rendu des commentaires
        if (this.comments.length === 0) {
            list.innerHTML = `
                <p class="text-sm text-slate-400 italic text-center py-6" data-i18n="comments.noComments">
                    Aucun commentaire pour le moment. Soyez le premier à commenter !
                </p>
            `;
            this.applyTranslations();
            return;
        }
        
        list.innerHTML = this.comments.map(comment => {
            const initials = this.getInitials(comment.authorName);
            const formattedDate = this.formatDate(comment.createdAt);
            const isoDate = comment.createdAt;
            const isOptimistic = comment._isOptimistic;
            
            return `
                <div class="comment-item p-3 rounded-lg bg-ink-700/60 border border-white/10 ${isOptimistic ? 'opacity-70' : ''}" data-comment-id="${comment.id}">
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-semibold">
                            ${initials}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-baseline gap-2 mb-1">
                                <span class="font-semibold text-slate-200 text-sm">${this.escapeHtml(comment.authorName)}</span>
                                <span class="text-xs text-slate-400" title="${isoDate}">
                                    ${formattedDate}
                                </span>
                                ${isOptimistic ? '<span class="text-xs text-slate-500">(envoi en cours...)</span>' : ''}
                            </div>
                            <p class="text-sm text-slate-300 whitespace-pre-wrap break-words">${this.escapeHtml(comment.message)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Attacher les event listeners
     */
    attachEventListeners() {
        // Bouton "Ajouter"
        const btnAdd = this.container.querySelector('#btnAddComment');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                this.toggleForm(true);
                
                // Pré-remplir le nom si disponible
                const nameInput = this.container.querySelector('#commentAuthorName');
                if (nameInput && this.currentUser?.name && !nameInput.value) {
                    nameInput.value = this.currentUser.name;
                }
            });
        }
        
        // Bouton "Annuler"
        const btnCancel = this.container.querySelector('#btnCancelComment');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                this.toggleForm(false);
                this.clearForm();
            });
        }
        
        // Bouton "Envoyer"
        const btnSubmit = this.container.querySelector('#btnSubmitComment');
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const nameInput = this.container.querySelector('#commentAuthorName');
                const messageInput = this.container.querySelector('#commentMessage');
                
                if (nameInput && messageInput) {
                    this.addComment(nameInput.value, messageInput.value);
                }
            });
        }
        
        // Textarea auto-grow et compteur
        const messageInput = this.container.querySelector('#commentMessage');
        if (messageInput) {
            messageInput.addEventListener('input', (e) => {
                // Auto-grow
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
                
                // Compteur
                const charCount = this.container.querySelector('#charCount');
                if (charCount) {
                    charCount.textContent = e.target.value.length;
                }
                
                // Bouton d'envoi
                this.updateSubmitButton();
            });
            
            // Entrée = Ctrl+Enter pour envoyer
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    btnSubmit?.click();
                }
            });
        }
        
        // Bouton "Voir plus"
        const btnLoadMore = this.container.querySelector('#btnLoadMore');
        if (btnLoadMore) {
            btnLoadMore.addEventListener('click', () => {
                this.loadComments(true);
            });
        }
    }
    
    /**
     * Escape HTML pour éviter XSS
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Export pour utilisation globale
window.CommentsComponent = CommentsComponent;

