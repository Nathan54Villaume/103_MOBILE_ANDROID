# 🚀 Guide de Déploiement API_ATF_MOBILE

## 📋 Quand utiliser quel type de déploiement ?

---

## ✅ **FRONTEND UNIQUEMENT** (Rapide - 5 secondes)

### Script à utiliser :
```bash
.\Scripts\deploy-frontend-only.bat
```

**⚠️ IMPORTANT : Ce script déploie UNIQUEMENT sur le serveur distant (10.250.13.4)**
- Pas de déploiement local
- Copie directe vers `\\10.250.13.4\c$\API_ATF_MOBILE\DEPLOIEMENT_API\wwwroot`
- Pas besoin de redémarrer l'API

### Quand l'utiliser ?
Modifications de fichiers dans `wwwroot/` uniquement :

#### ✅ Fichiers HTML
- `wwwroot/admin/index.html`
- `wwwroot/index.html`
- Tous les fichiers `*.html`

#### ✅ Fichiers JavaScript
- `wwwroot/admin/js/*.js`
- `wwwroot/app.js`
- Tous les fichiers `*.js`

#### ✅ Fichiers CSS
- `wwwroot/admin/css/*.css`
- `wwwroot/style.css`
- Tous les fichiers `*.css`

#### ✅ Assets statiques
- Images (`*.png`, `*.jpg`, `*.svg`)
- Fichiers JSON de configuration frontend
- Fichiers Markdown (`*.md`)

### Exemples de modifications FRONTEND ONLY :
- ✅ Modification texte interface (labels, titres)
- ✅ Changement couleurs, styles CSS
- ✅ Ajout/modification tooltips
- ✅ Correction bugs JavaScript côté client
- ✅ Réorganisation layout HTML
- ✅ Ajout/modification graphiques Chart.js
- ✅ Modification logique frontend (validation, affichage)

---

## 🔧 **BUILD COMPLET** (Moyen - 10-15 secondes)

### Commande à utiliser :
```bash
cd API_ATF_MOBILE/API_ATF_MOBILE
dotnet build
```

### Quand l'utiliser ?
Modifications de code **C# backend** :

#### 🔧 Fichiers Controllers
- `Controllers/*.cs`
- Modification endpoints API
- Ajout/modification routes

#### 🔧 Fichiers Services
- `Services/*.cs`
- Modification logique métier
- Ajout/modification services

#### 🔧 Fichiers Models
- `Models/*.cs`
- Modification structures de données
- Ajout/modification DTOs

#### 🔧 Fichiers Configuration
- `Program.cs`
- `appsettings.json` (structure)
- Middleware

### Exemples de modifications nécessitant BUILD :
- 🔧 Ajout nouveau endpoint API
- 🔧 Modification requêtes SQL dans controllers
- 🔧 Ajout nouveau service background
- 🔧 Modification logique métier backend
- 🔧 Changement configuration DI (Dependency Injection)
- 🔧 Modification authentification/autorisation

---

## 🏗️ **PUBLISH COMPLET** (Long - 30-60 secondes)

### Commande à utiliser :
```bash
cd API_ATF_MOBILE/API_ATF_MOBILE
dotnet publish -c Release -o publish
```

### Quand l'utiliser ?
Déploiement en **PRODUCTION** ou sur **serveur distant** :

#### 🏗️ Situations
- Déploiement sur serveur de production
- Création package pour IIS
- Mise à jour version majeure
- Changement dépendances NuGet

---

## 📊 **TABLEAU RÉCAPITULATIF**

| Type de modification | Script/Commande | Durée | Déploiement | Redémarrage API ? |
|---------------------|-----------------|-------|-------------|-------------------|
| **HTML, JS, CSS** | `deploy-frontend-only.bat` | 5s | 🌐 Distant uniquement | ❌ Non (Ctrl+F5 suffit) |
| **Controllers, Services** | `dotnet build` + redémarrage | 15s | 🏠 Doit être redéployé | ✅ Oui |
| **Program.cs, Config** | `dotnet build` + redémarrage | 15s | 🏠 Doit être redéployé | ✅ Oui |
| **Production** | `dotnet publish` | 30-60s | 🌐 Distant complet | ✅ Oui |

---

## 🎯 **EXEMPLES CONCRETS DE CETTE SESSION**

### ✅ FRONTEND ONLY (pas de rebuild nécessaire) :
- Ajout tooltips dans `index.html`
- Modification labels ("Millisecondes" → "Secondes")
- Changement largeur tooltips (CSS)
- Modification affichage pourcentage BDD (JavaScript)
- Correction conversion UTC → Local (JavaScript)
- Ajout badges visuels (JavaScript)

### 🔧 BUILD REQUIS (rebuild nécessaire) :
- Ajout `DirisDatabaseSizeMonitorService.cs` ← **NOUVEAU SERVICE**
- Modification `DirisCleanupController.cs` (calcul taille BDD)
- Ajout `MaxDatabaseSizeMB` dans `DirisConfigController.cs`
- Modification `Program.cs` (enregistrement service)
- Ajout méthode `ParseDatabaseSize()` dans controller

---

## 💡 **RÈGLE SIMPLE**

```
Modification dans wwwroot/ ?
   ↓
  OUI → deploy-frontend-only.bat (5s)
   ↓
  NON → dotnet build (15s)
```

---

## 🔄 **WORKFLOW RECOMMANDÉ**

### Développement actif (modifications fréquentes) :
1. Modifiez vos fichiers
2. Si `wwwroot/` → `deploy-frontend-only.bat`
3. Si `*.cs` → `dotnet build` + redémarrage API
4. Testez dans navigateur (Ctrl+F5)
5. Répétez

### Avant commit/push :
1. `dotnet build` (vérifier compilation)
2. Tester toutes les fonctionnalités
3. `git add` + `git commit` + `git push`

---

## 📝 **NOTES IMPORTANTES**

### ⚠️ Limitations du déploiement frontend :
- Ne met PAS à jour le code C# backend
- Ne recompile PAS les DLL
- Ne met PAS à jour les services en arrière-plan
- Nécessite que l'API soit déjà compilée au moins une fois

### ✅ Avantages :
- **Ultra rapide** (5s vs 15s)
- Pas besoin de redémarrer l'API
- Parfait pour ajustements visuels
- Idéal pour itérations rapides UI/UX

---

## 🎯 **UTILISATION**

### Option 1 : Double-clic
```
Double-cliquez sur: Scripts\deploy-frontend-only.bat
```

### Option 2 : PowerShell
```powershell
cd API_ATF_MOBILE\API_ATF_MOBILE
.\Scripts\deploy-frontend-only.ps1
```

### Option 3 : Avec chemin personnalisé
```powershell
.\Scripts\deploy-frontend-only.ps1 -TargetPath "C:\MonServeur\API"
```

---

## 🔍 **COMMENT SAVOIR SI REBUILD NÉCESSAIRE ?**

### ❌ PAS de rebuild si vous modifiez :
- ✅ `wwwroot/**/*.html`
- ✅ `wwwroot/**/*.js`
- ✅ `wwwroot/**/*.css`
- ✅ `wwwroot/**/*.md`
- ✅ Images, SVG, assets

### ✅ REBUILD OBLIGATOIRE si vous modifiez :
- 🔧 `Controllers/**/*.cs`
- 🔧 `Services/**/*.cs`
- 🔧 `Models/**/*.cs`
- 🔧 `Middleware/**/*.cs`
- 🔧 `Program.cs`
- 🔧 `*.csproj`
- 🔧 `appsettings.json` (structure backend)

---

## 📞 **AIDE RAPIDE**

**Question** : J'ai modifié `index.html`, rebuild nécessaire ?
**Réponse** : ❌ Non → `deploy-frontend-only.bat`

**Question** : J'ai modifié `DirisController.cs`, rebuild nécessaire ?
**Réponse** : ✅ Oui → `dotnet build` + redémarrage

**Question** : J'ai modifié `diris-manager.js`, rebuild nécessaire ?
**Réponse** : ❌ Non → `deploy-frontend-only.bat`

**Question** : J'ai ajouté un nouveau service, rebuild nécessaire ?
**Réponse** : ✅ Oui → `dotnet build` + redémarrage

---

## 🎉 **GAIN DE TEMPS**

Pour 10 modifications frontend dans une session :
- **Avec rebuild** : 10 × 15s = 2min 30s
- **Sans rebuild** : 10 × 5s = 50s
- **Gain** : 1min 40s par session !

---

**Créé le** : 2025-10-08
**Version** : 1.0
