# 🚀 Guide de Lancement DIRIS Server

## Fichiers de Lancement Disponibles

### 1. `launch-chrome-simple.bat` (Recommandé pour débuter)
**Le plus simple** - Lance le serveur et ouvre Chrome sur la page d'accueil.

```bash
# Double-clic ou exécution en ligne de commande
launch-chrome-simple.bat
```

**Ce que ça fait :**
- ✅ Démarre le serveur DIRIS
- ✅ Attend 3 secondes
- ✅ Ouvre Chrome sur `http://localhost:5001`
- ✅ Garde la fenêtre ouverte pour arrêter le serveur

---

### 2. `launch-chrome.bat` (Version complète)
**Version avancée** - Lance le serveur et ouvre toutes les interfaces.

```bash
# Double-clic ou exécution en ligne de commande
launch-chrome.bat
```

**Ce que ça fait :**
- ✅ Vérifie si le serveur est déjà en cours
- ✅ Vérifie l'existence des fichiers nécessaires
- ✅ Démarre le serveur en arrière-plan
- ✅ Vérifie que le serveur répond
- ✅ Ouvre Chrome avec **4 onglets** :
  - Page d'accueil (`/`)
  - Tableau de bord (`/dashboard.html`)
  - Courbes (`/charts.html`)
  - Health check (`/health`)

---

### 3. `launch-chrome.ps1` (PowerShell)
**Version PowerShell** - Même fonctionnalités que la version .bat mais en PowerShell.

```powershell
# Exécution PowerShell
.\launch-chrome.ps1
```

**Avantages :**
- ✅ Meilleure gestion des erreurs
- ✅ Couleurs dans la console
- ✅ Vérifications plus robustes
- ✅ Arrêt propre du serveur

---

## 🎯 Utilisation Recommandée

### Pour un test rapide :
```bash
launch-chrome-simple.bat
```

### Pour explorer toutes les fonctionnalités :
```bash
launch-chrome.bat
```

### Si vous préférez PowerShell :
```powershell
.\launch-chrome.ps1
```

---

## 🔧 Prérequis

1. **Serveur compilé** :
   ```bash
   dotnet publish src/Diris.Server -c Release -o dist
   ```

2. **Chrome installé** (ou modifier les scripts pour votre navigateur)

3. **Port 5001 libre** (ou modifier dans `appsettings.json`)

---

## 📱 Pages Disponibles

Une fois lancé, vous aurez accès à :

- **`http://localhost:5001`** - Page d'accueil avec métriques système
- **`http://localhost:5001/dashboard.html`** - Tableau de bord détaillé
- **`http://localhost:5001/charts.html`** - Courbes interactives
- **`http://localhost:5001/health`** - État de santé du serveur
- **`http://localhost:5001/api`** - API REST (voir documentation)

---

## 🛑 Arrêt du Serveur

- **Version simple** : Fermez la fenêtre de commande
- **Version complète** : Fermez la fenêtre de commande ou Ctrl+C
- **PowerShell** : Appuyez sur Entrée dans la console

---

## 🐛 Dépannage

### Le serveur ne démarre pas :
1. Vérifiez que le dossier `dist` existe
2. Vérifiez que `Diris.Server.exe` est présent
3. Compilez avec : `dotnet publish src/Diris.Server -c Release -o dist`

### Chrome ne s'ouvre pas :
1. Vérifiez que Chrome est installé
2. Modifiez les scripts pour utiliser votre navigateur préféré

### Port 5001 occupé :
1. Modifiez le port dans `appsettings.json`
2. Ou arrêtez l'autre processus utilisant le port 5001

---

## 📊 Fonctionnalités à Tester

Une fois lancé, testez :

1. **Interface Web** :
   - Navigation entre les pages
   - Actualisation automatique des métriques
   - Filtres dans les courbes

2. **API REST** :
   - `GET http://localhost:5001/api/metrics/system`
   - `GET http://localhost:5001/api/devices`
   - `GET http://localhost:5001/health`

3. **Monitoring** :
   - Logs dans le dossier `logs/`
   - Métriques en temps réel
   - Health checks

---

**Bon test ! 🎉**
