# 🚀 API_ATF_MOBILE

API de gestion pour l'application mobile ATF avec interface d'administration complète.

## 📁 Structure du Projet

```
API_ATF_MOBILE/
├── 📁 Scripts/                    # Scripts d'automatisation
│   ├── 📁 Deployment/            # Scripts de déploiement
│   │   ├── deploy-fixed.ps1      # Script principal de déploiement
│   │   ├── deploy-quick.ps1      # Déploiement rapide
│   │   ├── deploy.bat            # Interface graphique
│   │   ├── deploy.ps1            # Script original (référence)
│   │   └── deploy.log            # Logs de déploiement
│   ├── 📁 Startup/               # Scripts de démarrage
│   │   ├── start.bat             # Démarrage principal
│   │   ├── start_8088.bat        # Démarrage sur port 8088
│   │   ├── start_local.ps1       # Démarrage local
│   │   ├── start_original.bat    # Démarrage original
│   │   ├── start_simple.bat      # Démarrage simplifié
│   │   └── push.ps1              # Script de push
│   └── 📁 Utilities/             # Utilitaires
│       ├── cleanup_test_files.ps1 # Nettoyage des fichiers de test
│       └── proxy_server.py       # Serveur proxy
├── 📁 Documentation/             # Documentation du projet
│   └── Synthese_Projets_2024_2025.docx
├── 📁 Tests/                     # Fichiers de test
│   ├── test_functionality.html   # Tests de fonctionnalité
│   └── validation_scenarios.html # Scénarios de validation
├── 📁 Controllers/               # Contrôleurs API
├── 📁 Models/                    # Modèles de données
├── 📁 Services/                  # Services métier
├── 📁 Middleware/                # Middleware personnalisé
├── 📁 Data/                      # Contexte de base de données
├── 📁 Properties/                # Configuration de publication
├── 📁 wwwroot/                   # Fichiers statiques
│   ├── 📁 admin/                 # Interface d'administration
│   └── 📁 supervision-poste-electrique/ # Interface de supervision
└── 📁 bin/ & 📁 obj/             # Fichiers de build (.NET)
```

## 🚀 Démarrage Rapide

### 1. Développement Local
```bash
# Démarrage simple
Scripts\Startup\start.bat

# Ou avec PowerShell
Scripts\Startup\start_local.ps1
```

### 2. Déploiement
```bash
# Interface graphique
Scripts\Deployment\deploy.bat

# Ou directement
Scripts\Deployment\deploy-fixed.ps1
```

## 🔧 Fonctionnalités Principales

### 🎛️ Interface d'Administration
- **Dashboard** : Vue d'ensemble temps réel
- **Serveur** : Métriques et monitoring
- **Bases de données** : Santé des connexions SQL
- **PLC S7** : Gestion des connexions S7-1500
- **Logs** : Visualisation et recherche
- **Configuration** : Paramètres système
- **API** : Documentation des endpoints

### 💬 Système de Commentaires V2 (Nouveau - 03/01/2025)
- **Multi-commentaires** : Plusieurs commentaires par projet
- **Pagination** : Chargement progressif (50 commentaires/page)
- **Optimistic UI** : Ajout instantané avec rollback
- **Rate limiting** : Protection anti-spam (10 req/5min/IP)
- **Stockage JSONL** : Format robuste avec file locking
- **Archivage auto** : Rotation des fichiers >5 Mo
- **Sécurité** : Anti-XSS, validation stricte
- **Dates** : Affichage Europe/Paris, stockage UTC

📚 **Documentation complète** : `Documentation/COMMENTS_SYSTEM_V2.md`  
🚀 **Démarrage rapide** : `Documentation/COMMENTS_V2_QUICKSTART.md`  
🧪 **Tests** : `http://localhost:8088/Tests/test-comments-v2.html`

### 🔌 Gestion PLC S7
- ✅ Ajout de connexions PLC
- ✅ **Modification de connexions** (nouveau)
- ✅ Suppression de connexions
- ✅ Test de connectivité
- ✅ Monitoring temps réel

### 📊 Monitoring
- Métriques CPU, mémoire, uptime
- Graphiques interactifs (Chart.js)
- Logs système en temps réel
- Health checks automatiques

## 🌐 Accès

- **Interface Admin** : `http://localhost:8088/admin/`
- **Dashboard Projets** : `http://localhost:8088/dashboard-projects-NV.html` (avec commentaires V2)
- **API Health** : `http://localhost:8088/api/admin/health`
- **Documentation API** : `http://localhost:8088/api/admin/controllers`
- **Tests Commentaires** : `http://localhost:8088/Tests/test-comments-v2.html`

## 🔐 Authentification

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| `admin` | `admin123` | Administrateur |
| `operateur` | `oper123` | Opérateur |

## 📝 Logs

- **Déploiement** : `Scripts\Deployment\deploy.log`
- **Application** : Interface d'administration → Section Logs
- **Système** : Event Viewer Windows

## 🛠️ Technologies

- **Backend** : .NET 8.0, ASP.NET Core
- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Charts** : Chart.js
- **Styling** : Tailwind CSS
- **Base de données** : SQL Server
- **PLC** : S7-1500 (Siemens)

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs dans l'interface d'administration
2. Vérifier les logs de déploiement
3. Tester la connectivité réseau
4. Vérifier les permissions

---

**Version** : 1.1 (Commentaires V2)  
**Dernière mise à jour** : 03/01/2025  
**Branche** : dev
