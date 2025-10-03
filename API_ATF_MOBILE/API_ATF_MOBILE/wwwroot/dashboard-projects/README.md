# Dashboard Projets 2025 - Structure Modulaire

## 📁 Organisation des fichiers

Cette nouvelle structure modulaire remplace le fichier monolithique `dashboard-projects-NV.html` pour faciliter la maintenance et l'évolution de la fonctionnalité "ajouter un projet".

### Structure des répertoires

```
dashboard-projects/
├── index.html                 # Point d'entrée principal
├── README.md                  # Documentation
├── css/
│   └── dashboard.css          # Styles CSS personnalisés
├── js/
│   ├── dashboard.js           # Application principale
│   ├── i18n.js               # Système de traduction
│   ├── utils.js              # Fonctions utilitaires
│   └── skills-lexicon.js     # Lexique des compétences
├── components/
│   ├── Drawer.js             # Composant drawer pour les détails
│   ├── ImageModal.js         # Modal pour les images
│   ├── AuthModal.js          # Modal d'authentification
│   └── ShareModal.js         # Modal de partage
└── data/
    └── projects.json         # Données des projets
```

## 🚀 Avantages de la nouvelle structure

### ✅ Maintenabilité
- **Séparation des responsabilités** : Chaque fichier a un rôle spécifique
- **Code modulaire** : Facile à comprendre et modifier
- **Réutilisabilité** : Les composants peuvent être réutilisés

### ✅ Évolutivité
- **Ajout de fonctionnalités** : Facile d'ajouter de nouveaux composants
- **Modification des données** : Les projets sont dans un fichier JSON séparé
- **Extension des traductions** : Système i18n centralisé

### ✅ Performance
- **Chargement optimisé** : Scripts chargés de manière asynchrone
- **Cache navigateur** : Chaque module peut être mis en cache séparément
- **Code splitting** : Possibilité de charger seulement les modules nécessaires

## 🔧 Modules principaux

### `dashboard.js` - Application principale
- Orchestre tous les composants
- Gère le chargement des données
- Initialise les event listeners
- Contrôle le rendu des cartes et KPIs

### `i18n.js` - Système de traduction
- Gère les traductions français/italien
- Support des attributs et contenu dynamique
- Persistance de la langue choisie
- Mise à jour automatique du contenu

### `utils.js` - Fonctions utilitaires
- Fonctions communes (chip, uniq, copyToClipboard, etc.)
- Gestion des notifications
- Validation des mots de passe
- Utilitaires de formatage

### Composants UI

#### `Drawer.js`
- Affichage des détails des projets
- Gestion du lexique des compétences
- Rendu des images et médias
- Intégration avec le système de commentaires

#### `ImageModal.js`
- Affichage des images en grand format
- Navigation au clavier (Escape)
- Gestion des événements de clic

#### `AuthModal.js`
- Authentification pour ajouter des projets
- Validation des mots de passe
- Gestion des erreurs
- Callbacks de succès/échec

#### `ShareModal.js`
- Partage via Teams, Outlook
- Copie de lien dans le presse-papiers
- Génération de messages dynamiques
- Notifications de succès/erreur

## 📊 Données

### `projects.json`
Structure JSON des projets avec :
- Informations de base (id, title, area, status)
- Contenu (objective, real, results)
- Métadonnées (skills, images, media)
- Filtres et catégories

## 🎨 Styles

### `dashboard.css`
- Variables CSS pour la cohérence
- Composants de base (cards, chips, modals)
- Animations et transitions
- Styles responsifs
- Thème sombre avec effets glassmorphism

## 🔄 Migration depuis l'ancienne version

L'ancien fichier `dashboard-projects-NV.html` redirige automatiquement vers la nouvelle structure. Toutes les fonctionnalités existantes sont préservées :

- ✅ Affichage des projets
- ✅ Système de filtres
- ✅ Traductions FR/IT
- ✅ Drawer de détails
- ✅ Modal d'images
- ✅ Système de commentaires
- ✅ Partage (Teams, Outlook)
- ✅ Authentification admin

## 🚧 Évolution future - Ajouter un projet

Cette structure modulaire facilite l'ajout de la fonctionnalité "ajouter un projet" :

### Étapes suivantes
1. **Créer `ProjectForm.js`** - Formulaire de création/édition
2. **Étendre `AuthModal.js`** - Gestion des permissions
3. **Ajouter API endpoints** - Sauvegarde des nouveaux projets
4. **Mettre à jour `projects.json`** - Structure pour les nouveaux projets
5. **Tests et validation** - Assurer la cohérence des données

### Avantages pour l'évolution
- **Isolation des fonctionnalités** : Chaque composant peut être modifié indépendamment
- **Tests unitaires** : Possibilité de tester chaque module séparément
- **Documentation** : Code auto-documenté avec des classes et méthodes claires
- **Extensibilité** : Facile d'ajouter de nouvelles fonctionnalités sans impacter l'existant

## 🛠️ Développement

### Commandes utiles
```bash
# Vérifier la structure
ls -la dashboard-projects/

# Tester en local
python -m http.server 8000
# Puis ouvrir http://localhost:8000/dashboard-projects/
```

### Débogage
- Ouvrir les outils de développement (F12)
- Vérifier la console pour les erreurs de chargement
- Tester les fonctionnalités une par une
- Vérifier les appels API dans l'onglet Network

## 📝 Notes techniques

- **Compatibilité** : Fonctionne avec tous les navigateurs modernes
- **Performance** : Chargement optimisé des ressources
- **Accessibilité** : Support des lecteurs d'écran et navigation clavier
- **SEO** : Métadonnées et structure HTML sémantique
- **Mobile** : Design responsive pour tous les écrans
