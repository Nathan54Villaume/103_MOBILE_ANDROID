# 🚀 Guide de Démarrage - Supervision Poste Électrique

## 📋 Prérequis

- **.NET 8.0 SDK** - [Télécharger ici](https://dotnet.microsoft.com/download)
- **Python 3.x** - [Télécharger ici](https://www.python.org/downloads/)
- **Navigateur moderne** (Chrome, Firefox, Edge)

## 🎯 Démarrage Rapide

### Option 1 : Script automatique (Recommandé)

1. **Double-cliquez** sur `start_simple.bat`
2. **Attendez** que les deux serveurs démarrent (environ 20 secondes)
3. **L'application s'ouvrira automatiquement** dans votre navigateur

### Option 2 : Démarrage manuel

#### Étape 1 : Démarrer l'API Backend
```bash
# Dans un terminal
cd API_ATF_MOBILE\API_ATF_MOBILE
dotnet run --environment Development --urls "http://localhost:5000"
```

#### Étape 2 : Démarrer le Frontend
```bash
# Dans un autre terminal
cd API_ATF_MOBILE\API_ATF_MOBILE\wwwroot\supervision-poste-electrique
python -m http.server 8088
```

#### Étape 3 : Ouvrir l'application
- **Mode développement :** http://localhost:8088/index_dev.html
- **Mode production :** http://localhost:8088/index.html
- **API Swagger :** http://localhost:5000/swagger

## 🔧 Configuration du Proxy

L'application utilise un système de proxy automatique :

- **Port 8088** : Frontend (HTML, CSS, JS)
- **Port 5000** : API Backend (.NET)
- **Proxy automatique** : Les requêtes `/api/*` sont redirigées vers le port 5000

### Fichiers de configuration :
- `proxy-config.js` : Détection automatique de l'environnement
- `api.js` : Utilisation de l'URL de base configurée

## 🌐 URLs d'Accès

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend Dev** | http://localhost:8088/index_dev.html | Mode développement avec données mock |
| **Frontend Prod** | http://localhost:8088/index.html | Mode production |
| **API Swagger** | http://localhost:5000/swagger | Documentation de l'API |
| **API Health** | http://localhost:5000/api/energy/snapshots/tr1 | Test de l'API |

## 🧪 Tests et Validation

### Tests automatiques
1. Ouvrez `test_functionality.html` dans votre navigateur
2. Cliquez sur "Tester les endpoints API"
3. Vérifiez que tous les tests passent

### Validation des scénarios
1. Ouvrez `validation_scenarios.html` dans votre navigateur
2. Cliquez sur "Lancer la validation complète"
3. Vérifiez que tous les scénarios sont validés

## 🐛 Résolution des Problèmes

### Problème : "Impossible de se connecter au serveur distant"
**Solution :** Vérifiez que le serveur .NET est démarré sur le port 5000

### Problème : "404 File not found" sur le frontend
**Solution :** Vérifiez que le serveur Python est démarré dans le bon répertoire

### Problème : "CORS error" dans la console
**Solution :** L'API est configurée pour accepter les requêtes depuis localhost:8088

### Problème : Les graphiques ne se chargent pas
**Solution :** Vérifiez que l'API répond sur http://localhost:5000/swagger

## 📊 Fonctionnalités Disponibles

### ✅ Fonctionnalités implémentées
- **Graphiques temps réel** avec Chart.js
- **Menu contextuel** pour sélection des signaux
- **Export PNG/CSV** des données
- **Vue journalière** avec navigation
- **Paramètres persistants** (localStorage)
- **Mode démonstration** avec données mock
- **Interface responsive** et accessible
- **Navigation clavier** complète

### 🎛️ Contrôles disponibles
- **Zoom/Pan** : Molette + cliquer-glisser
- **Réinitialisation** : Bouton "Reset" sur chaque graphique
- **Paramètres** : Bouton "Settings" pour configurer l'API
- **Export** : Boutons PNG/CSV sur chaque graphique
- **Vue journalière** : Section dédiée avec sélecteur de date

## 🔄 Arrêt des Serveurs

### Méthode 1 : Fermer les fenêtres de commande
- Fermez les fenêtres `cmd` ouvertes par le script

### Méthode 2 : Arrêt manuel
```bash
# Arrêter le serveur .NET
taskkill /F /IM dotnet.exe

# Arrêter le serveur Python
taskkill /F /IM python.exe
```

## 📁 Structure du Projet

```
API_ATF_MOBILE/
├── Controllers/
│   └── EnergyController.cs          # API Backend
├── wwwroot/supervision-poste-electrique/
│   ├── index.html                   # Version production
│   ├── index_dev.html              # Version développement
│   ├── proxy-config.js             # Configuration du proxy
│   ├── js/                         # Modules JavaScript
│   │   ├── main.js                 # Point d'entrée
│   │   ├── api.js                  # Gestion des API
│   │   ├── charts.js               # Graphiques
│   │   ├── settings.js             # Paramètres
│   │   └── ...                     # Autres modules
│   └── style.css                   # Styles CSS
├── start_simple.bat                # Script de démarrage
├── proxy_server.py                 # Serveur proxy Python
└── VALIDATION_REPORT.md           # Rapport de validation
```

## 🎉 Félicitations !

Votre application **Supervision Poste Électrique** est maintenant prête à être utilisée !

- ✅ **Backend API** fonctionnel
- ✅ **Frontend responsive** opérationnel  
- ✅ **Proxy automatique** configuré
- ✅ **Toutes les fonctionnalités** validées

**Bon développement !** 🚀
