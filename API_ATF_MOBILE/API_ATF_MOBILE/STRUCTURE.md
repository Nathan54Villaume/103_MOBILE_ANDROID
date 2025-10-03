# 📁 Structure du Projet API_ATF_MOBILE

## 🎯 Organisation des Dossiers

### 📂 Scripts/
Contient tous les scripts d'automatisation organisés par catégorie :

#### 🚀 Deployment/
- `deploy-fixed.ps1` - Script principal de déploiement (version corrigée)
- `deploy-quick.ps1` - Déploiement rapide pour les mises à jour fréquentes
- `deploy.bat` - Interface graphique Windows pour le déploiement
- `deploy.ps1` - Script original (conservé pour référence)
- `deploy.log` - Logs de déploiement (généré automatiquement)

#### ⚡ Startup/
- `start.bat` - Démarrage principal de l'application
- `start_8088.bat` - Démarrage sur le port 8088
- `start_local.ps1` - Démarrage en mode développement local
- `start_original.bat` - Script de démarrage original
- `start_simple.bat` - Version simplifiée du démarrage
- `push.ps1` - Script de push Git

#### 🛠️ Utilities/
- `cleanup_test_files.ps1` - Nettoyage des fichiers de test temporaires
- `proxy_server.py` - Serveur proxy pour le développement

### 📚 Documentation/
- `EVENT_VIEWER_README.md` - Guide pour l'Event Viewer
- `GUIDE_DEMARRAGE.md` - Guide de démarrage
- `VALIDATION_REPORT.md` - Rapport de validation
- `Synthese_Projets_2024_2025.docx` - Synthèse des projets

### 🧪 Tests/
- `test_functionality.html` - Tests de fonctionnalité
- `validation_scenarios.html` - Scénarios de validation

## 🏗️ Structure .NET Standard

### 📂 Controllers/
Contrôleurs API REST :
- `AuthController.cs` - Authentification
- `ServerAdminController.cs` - Administration serveur
- `AutomateController.cs` - Gestion des automates
- `EnergyController.cs` - Gestion énergétique
- `EtapesController.cs` - Gestion des étapes
- `GammesController.cs` - Gestion des gammes
- `HistoriqueController.cs` - Historique
- `PlanningController.cs` - Planning
- `ValuesController.cs` - Valeurs par défaut
- `WeatherForecastController.cs` - Prévisions météo

### 📂 Models/
Modèles de données :
- `AdminUser.cs` - Utilisateur administrateur
- `PlcConnection.cs` - Connexion PLC
- `Etape*.cs` - Modèles d'étapes
- `EnergyDtos.cs` - DTOs énergétiques

### 📂 Services/
Services métier :
- `AuthenticationService.cs` - Service d'authentification
- `PlcConnectionService.cs` - Service de connexions PLC
- `DatabaseHealthService.cs` - Santé des bases de données
- `LogReaderService.cs` - Lecture des logs
- `S7CommunicationService.cs` - Communication S7
- `S7MonitorService.cs` - Monitoring S7
- `ServerMonitorService.cs` - Monitoring serveur
- `SystemMonitorService.cs` - Monitoring système

### 📂 Middleware/
Middleware personnalisé :
- `RequestLoggingMiddleware.cs` - Logging des requêtes
- `SecurityMiddleware.cs` - Sécurité

### 📂 Data/
- `ApplicationDbContext.cs` - Contexte de base de données

### 📂 Properties/
- `launchSettings.json` - Configuration de lancement
- `PublishProfiles/` - Profils de publication

## 🌐 Structure Web (wwwroot/)

### 📂 admin/
Interface d'administration complète :
- `index.html` - Page principale
- `js/` - Scripts JavaScript modulaires
- Documentation et guides

### 📂 supervision-poste-electrique/
Interface de supervision :
- `index.html` - Interface principale
- `js/` - Scripts de supervision
- `charts/` - Composants graphiques
- Tests et démos

## 🎯 Avantages de cette Organisation

### ✅ Clarté
- Chaque type de fichier a sa place
- Structure logique et intuitive
- Séparation claire des responsabilités

### ✅ Maintenance
- Scripts organisés par fonction
- Documentation centralisée
- Tests isolés

### ✅ Développement
- Structure .NET standard respectée
- Séparation frontend/backend
- Outils de développement organisés

### ✅ Déploiement
- Scripts de déploiement centralisés
- Logs organisés
- Configuration claire

## 📝 Conventions

### Fichiers de Scripts
- Extension `.ps1` pour PowerShell
- Extension `.bat` pour batch Windows
- Extension `.py` pour Python
- Préfixe descriptif (deploy, start, cleanup)

### Documentation
- Format Markdown (.md) pour la documentation technique
- Format Word (.docx) pour les documents officiels
- Noms explicites et descriptifs

### Tests
- Préfixe `test_` pour les fichiers de test
- Extension `.html` pour les tests web
- Noms descriptifs du contenu testé

---

**Dernière mise à jour** : Octobre 2025  
**Version** : 1.0
