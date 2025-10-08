# 📋 Règles et Préférences du Projet API_ATF_MOBILE

**Créé le** : 2025-10-08  
**Dernière mise à jour** : 2025-10-08

---

## 🚀 **DÉPLOIEMENT**

### ✅ Règle #1 : Déploiement DISTANT UNIQUEMENT
- **JAMAIS de déploiement local**
- Toujours déployer sur le serveur distant : `10.250.13.4`
- Chemin distant : `\\10.250.13.4\c$\API_ATF_MOBILE\DEPLOIEMENT_API`

### ✅ Règle #2 : Scripts de déploiement
- **Frontend uniquement** : `Scripts\deploy-frontend-only.bat`
  - Modifications HTML, JS, CSS
  - Pas de rebuild
  - Durée : 5 secondes
- **Backend (C#)** : `dotnet build` + script complet
  - Modifications Controllers, Services, Models
  - Rebuild nécessaire
  - Durée : 15 secondes

---

## 🔧 **DÉVELOPPEMENT**

### ✅ Règle #3 : Quand rebuild est nécessaire

**❌ PAS de rebuild :**
- Fichiers dans `wwwroot/` (HTML, JS, CSS)
- Modifications visuelles uniquement
- Tooltips, labels, textes
- Styles, couleurs, layout

**✅ REBUILD obligatoire :**
- Fichiers `.cs` (Controllers, Services, Models)
- `Program.cs`
- Nouveaux services background
- Modifications API endpoints
- Modifications requêtes SQL backend

### ✅ Règle #4 : Workflow de développement
1. Modifier les fichiers
2. Si `wwwroot/` → `deploy-frontend-only.bat`
3. Si `.cs` → `dotnet build` + redéploiement complet
4. Tester
5. Commit + Push

---

## 💾 **BASE DE DONNÉES**

### ✅ Règle #5 : Connexions BDD
- **AI_ATR** : Base principale DIRIS
  - Connection string : `SqlAiAtr`
  - Tables : `DIRIS.Measurements`, `DIRIS.Devices`, `DIRIS.TagMap`
- **AI_ATS** : Base secondaire
  - Connection string : `DefaultConnection`

### ✅ Règle #6 : Taille maximale BDD DIRIS
- **Défaut** : 1024 MB (1 GB)
- **Monitoring automatique** : Toutes les 5 minutes
- **Seuils** :
  - 75-89% : Avertissement
  - 90-94% : Alerte critique
  - 95-97% : Nettoyage automatique (données > 7 jours)
  - 98-100% : Arrêt acquisition (protection ultime)

---

## 🕐 **GESTION DES TIMESTAMPS**

### ✅ Règle #7 : Conversion UTC vers heure locale
- **Backend** : Toujours stocker en UTC dans la BDD
- **Frontend** : Toujours afficher en heure locale (UTC+2)
- **Méthode** : Ajouter `'Z'` au timestamp avant `new Date()`
  ```javascript
  new Date(data.timestamp + 'Z').toLocaleString('fr-FR')
  ```

---

## 🎨 **INTERFACE UTILISATEUR**

### ✅ Règle #8 : Tooltips
- **Largeur** : `max-width: 550px` (large et confortable)
- **Classe** : `config-info-icon` pour les icônes "ℹ️"
- **Position** :
  - Icônes "ℹ️" : Au-dessus
  - Boutons : En dessous (éviter coupure par barre titre)
- **Contenu** : Descriptions détaillées et professionnelles

### ✅ Règle #9 : Organisation onglet DIRIS
- **Sous-onglets** : Vue d'ensemble, Devices, Cohérence, Configuration, Historique
- **Ordre** : Vue d'ensemble en premier, puis Devices
- **Graphiques** : Dans Vue d'ensemble, sous "Base de données DIRIS"

### ✅ Règle #10 : Codes couleurs
- **Vert** : OK, normal (0-49%)
- **Jaune** : Attention (50-74%)
- **Orange** : Avertissement (75-89%)
- **Rouge** : Critique (90-100%)

---

## 📊 **SYSTÈME DE COHÉRENCE**

### ✅ Règle #11 : Score de cohérence
- **Calcul** : Qualité (40) + Régularité (30) + Gaps (30) = 100
- **Réinitialisation** : Utilise paramètre `since` pour ignorer historique
- **Seuil données insuffisantes** : < 20 mesures = score parfait par défaut

### ✅ Règle #12 : Paramètre `since`
- Utilisé pour filtrer les données depuis un timestamp
- Stocké dans `localStorage` : `dirisCoherenceStartTime`
- Appliqué à toutes les requêtes de cohérence (stats + score)

---

## 🔄 **ACQUISITION DIRIS**

### ✅ Règle #13 : Contrôle acquisition
- **Persistance** : État sauvegardé dans `acquisition-state.json`
- **Par défaut** : Démarrage automatique au lancement
- **CPU** : Délai de 5s quand arrêté (économie ressources)

### ✅ Règle #14 : Écriture par lots
- **SqlBulkCopy** : Écriture efficace par paquets
- **Raison** : Performance et réduction charge BDD
- **Taille lots** : Configurable (défaut 1000)

---

## 📝 **LOGS ET MONITORING**

### ✅ Règle #15 : Logs détaillés
- Toujours logger les actions importantes
- Utiliser emojis pour clarté (🚀, ✅, ❌, ⚠️, 🔴)
- Niveaux : Debug, Info, Warning, Error, Critical

### ✅ Règle #16 : Graphiques temps réel
- **Destruction** : Toujours détruire avant recréation (éviter "Canvas already in use")
- **Initialisation** : Lors de navigation vers onglet DIRIS
- **Logs** : Afficher succès/échec de chaque canvas

---

## 🎯 **BONNES PRATIQUES**

### ✅ Règle #17 : Validation des champs
- Validation en temps réel (bordure rouge si invalide)
- Messages d'erreur clairs dans tooltip
- Plages de valeurs documentées

### ✅ Règle #18 : Gestion des erreurs
- Toujours utiliser try-catch
- Logger les erreurs avec contexte
- Afficher messages utilisateur clairs
- Conseils de résolution si possible

### ✅ Règle #19 : Commit et Push
- Commits fréquents avec messages descriptifs
- Push après chaque fonctionnalité complète
- Messages sans emojis (problèmes encodage PowerShell)

---

## 🛠️ **OUTILS ET SCRIPTS**

### ✅ Règle #20 : Scripts disponibles
- `deploy-frontend-only.bat` : Déploiement rapide frontend (5s)
- `deploy-fixed.ps1` : Déploiement complet avec build
- `GUIDE_DEPLOIEMENT.md` : Guide complet
- `QUAND_REBUILD.md` : Arbre de décision

---

## 🎨 **STYLE ET CONVENTIONS**

### ✅ Règle #21 : Nommage
- **Français** : Labels, tooltips, messages utilisateur
- **Anglais** : Code, variables, fonctions
- **Clarté** : Noms descriptifs et explicites

### ✅ Règle #22 : Interface
- **Design** : Moderne, professionnel, épuré
- **Tailwind CSS** : Framework CSS utilisé (CDN en dev)
- **Responsive** : Support mobile et desktop
- **Accessibilité** : Tooltips, labels clairs, contrastes

---

## 📐 **ARCHITECTURE**

### ✅ Règle #23 : Services background
- Utiliser `IHostedService` ou `BackgroundService`
- Enregistrer dans `Program.cs` avec `AddHostedService`
- Gestion propre du `CancellationToken`
- Logs au démarrage et arrêt

### ✅ Règle #24 : Dependency Injection
- Services en Singleton pour état partagé
- Scoped pour opérations BDD
- Transient pour services légers

---

## 🔐 **SÉCURITÉ**

### ✅ Règle #25 : Authentification
- JWT Bearer tokens
- `[Authorize]` sur endpoints sensibles
- Timeout session approprié

---

## 📊 **MÉTRIQUES ET MONITORING**

### ✅ Règle #26 : Fréquence d'acquisition
- **Affichage** : En secondes (pas millisecondes)
- **Calcul** : Intervalle moyen entre mesures
- **Cible** : 1-3 secondes stable

### ✅ Règle #27 : Statistiques temps réel
- Rafraîchissement automatique toutes les 5 secondes
- Graphiques avec Chart.js
- Données des dernières heures (pas tout l'historique)

---

## 🐛 **DEBUGGING**

### ✅ Règle #28 : Logs de debug
- Utiliser `console.log` avec emojis pour clarté
- Préfixes : 🎯, ✅, ❌, 📊, 🔄
- Logs détaillés pour investigation
- Supprimer après résolution

---

## 💡 **PRÉFÉRENCES PERSONNELLES**

### ✅ Règle #29 : Communication
- Réponses concises et structurées
- Utilisation d'emojis pour clarté visuelle
- Tableaux et listes pour synthèse
- Exemples concrets

### ✅ Règle #30 : Workflow
- Corrections immédiates sans demander confirmation
- Commit et push automatiques après chaque fonctionnalité
- Tests de build systématiques
- Documentation au fur et à mesure

---

## 📚 **DOCUMENTATION**

### Fichiers de référence :
- `GUIDE_DEPLOIEMENT.md` - Guide de déploiement complet
- `QUAND_REBUILD.md` - Arbre de décision rebuild
- `REGLES_PROJET.md` - Ce fichier (règles et préférences)
- `GUIDE_DEMARRAGE.md` - Guide de démarrage
- `STRUCTURE.md` - Structure du projet

---

## 🎯 **OBJECTIFS DU PROJET**

1. **Système d'acquisition DIRIS** stable et performant
2. **Interface d'administration** moderne et intuitive
3. **Monitoring temps réel** avec alertes intelligentes
4. **Gestion automatique** de la taille BDD
5. **Documentation complète** et à jour

---

## 📝 **NOTES IMPORTANTES**

- Le serveur de production est sur `10.250.13.4:8088`
- L'utilisateur travaille en UTC+2
- Le projet utilise .NET 8.0
- Base de données SQL Server
- Architecture modulaire avec services découplés

---

**Ce fichier sera mis à jour au fil des sessions pour refléter les nouvelles règles et préférences.**
