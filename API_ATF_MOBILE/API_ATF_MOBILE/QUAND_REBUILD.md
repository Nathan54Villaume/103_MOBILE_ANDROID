# 🔍 Quand ai-je besoin de REBUILD ?

## 📋 Guide rapide pour savoir quelle commande utiliser

---

## ✅ **PAS BESOIN DE REBUILD** → `deploy-frontend-only.bat`

### Fichiers concernés :
```
wwwroot/
  ├── admin/
  │   ├── index.html          ✅ Pas de rebuild
  │   ├── js/*.js             ✅ Pas de rebuild
  │   └── css/*.css           ✅ Pas de rebuild
  ├── index.html              ✅ Pas de rebuild
  ├── app.js                  ✅ Pas de rebuild
  ├── style.css               ✅ Pas de rebuild
  └── images/*                ✅ Pas de rebuild
```

### Exemples concrets :
- ✅ Changer un texte dans l'interface
- ✅ Modifier un label ("Millisecondes" → "Secondes")
- ✅ Ajouter/modifier un tooltip
- ✅ Changer une couleur CSS
- ✅ Corriger un bug JavaScript côté client
- ✅ Modifier la largeur d'un élément
- ✅ Ajouter un badge visuel
- ✅ Réorganiser des éléments HTML
- ✅ Modifier la logique d'affichage JavaScript
- ✅ Changer une image ou un logo

### Commande :
```bash
.\Scripts\deploy-frontend-only.bat
```

### Durée : **5 secondes** ⚡

---

## 🔧 **REBUILD NÉCESSAIRE** → `dotnet build`

### Fichiers concernés :
```
API_ATF_MOBILE/
  ├── Controllers/
  │   └── *.cs                🔧 REBUILD REQUIS
  ├── Services/
  │   └── *.cs                🔧 REBUILD REQUIS
  ├── Models/
  │   └── *.cs                🔧 REBUILD REQUIS
  ├── Middleware/
  │   └── *.cs                🔧 REBUILD REQUIS
  ├── Program.cs              🔧 REBUILD REQUIS
  ├── *.csproj                🔧 REBUILD REQUIS
  └── appsettings.json        🔧 REBUILD REQUIS (si structure backend)
```

### Exemples concrets :
- 🔧 Ajouter un nouveau endpoint API
- 🔧 Modifier une requête SQL dans un controller
- 🔧 Créer un nouveau service (ex: `DirisDatabaseSizeMonitorService`)
- 🔧 Modifier la logique métier backend
- 🔧 Ajouter un paramètre dans `DataRetentionConfig`
- 🔧 Changer la configuration DI dans `Program.cs`
- 🔧 Modifier l'authentification/autorisation
- 🔧 Ajouter une méthode dans un controller
- 🔧 Modifier une requête de base de données

### Commande :
```bash
cd API_ATF_MOBILE/API_ATF_MOBILE
dotnet build
```

### Durée : **10-15 secondes** 🔨

---

## 📊 **TABLEAU DE DÉCISION RAPIDE**

| Vous modifiez... | Rebuild ? | Script à utiliser | Redémarrage API ? |
|------------------|-----------|-------------------|-------------------|
| `index.html` | ❌ Non | `deploy-frontend-only.bat` | ❌ Non |
| `diris-manager.js` | ❌ Non | `deploy-frontend-only.bat` | ❌ Non |
| `style.css` | ❌ Non | `deploy-frontend-only.bat` | ❌ Non |
| `DirisController.cs` | ✅ Oui | `dotnet build` | ✅ Oui |
| `DirisService.cs` | ✅ Oui | `dotnet build` | ✅ Oui |
| `Program.cs` | ✅ Oui | `dotnet build` | ✅ Oui |
| `appsettings.json` | ⚠️ Dépend | Voir ci-dessous | ⚠️ Dépend |

---

## ⚠️ **CAS PARTICULIER : `appsettings.json`**

### ❌ Pas de rebuild si :
- Changement de valeurs uniquement (ex: `RetentionDays: 10 → 15`)
- Modification de chaînes de connexion
- Changement de paramètres existants

### ✅ Rebuild si :
- Ajout d'une nouvelle section
- Changement de structure
- Modification utilisée dans `Program.cs` au démarrage

---

## 🎯 **MODIFICATIONS DE CETTE SESSION**

### ❌ Pas de rebuild nécessaire :
1. ✅ Ajout tooltips dans `index.html`
2. ✅ Modification labels interface
3. ✅ Changement largeur tooltips (CSS)
4. ✅ Modification affichage pourcentage (JavaScript)
5. ✅ Correction conversion UTC (JavaScript)
6. ✅ Ajout badges visuels (JavaScript)
7. ✅ Position tooltips boutons (CSS)

### 🔧 Rebuild nécessaire :
1. 🔧 Ajout `DirisDatabaseSizeMonitorService.cs`
2. 🔧 Modification `DirisCleanupController.cs` (calcul taille)
3. 🔧 Ajout `MaxDatabaseSizeMB` dans `DirisConfigController.cs`
4. 🔧 Modification `Program.cs` (enregistrement service)
5. 🔧 Ajout méthode `ParseDatabaseSize()`
6. 🔧 Modification `DirisCoherenceController.cs` (score qualité)

---

## 💡 **RÈGLE D'OR**

```
┌─────────────────────────────────────┐
│ Fichier dans wwwroot/ ?             │
│   ↓                                  │
│  OUI → deploy-frontend-only.bat (5s)│
│   ↓                                  │
│  NON → dotnet build (15s)            │
└─────────────────────────────────────┘
```

---

## 🚀 **UTILISATION DES SCRIPTS**

### 1️⃣ Déploiement frontend uniquement (local + distant)
```bash
.\Scripts\deploy-frontend-only.bat
```

### 2️⃣ Déploiement frontend local uniquement
```powershell
.\Scripts\deploy-frontend-only.ps1 -LocalOnly
```

### 3️⃣ Déploiement frontend distant uniquement
```powershell
.\Scripts\deploy-frontend-only.ps1 -RemoteOnly
```

### 4️⃣ Build complet
```bash
dotnet build
```

### 5️⃣ Publish pour production
```bash
dotnet publish -c Release -o publish
```

---

## 📝 **NOTES IMPORTANTES**

### ⚠️ Limitations deploy-frontend-only :
- Ne compile PAS le code C#
- Ne met PAS à jour les DLL
- Ne redémarre PAS l'API
- Nécessite un build initial

### ✅ Avantages :
- **3x plus rapide** (5s vs 15s)
- Pas de redémarrage API
- Parfait pour itérations UI/UX
- Supporte local + distant

---

## 🎉 **GAIN DE TEMPS**

### Scénario : 20 modifications frontend dans une session

**Avec rebuild systématique :**
- 20 × 15s = **5 minutes**

**Avec deploy-frontend-only :**
- 20 × 5s = **1 minute 40s**

**Gain : 3 minutes 20s par session !** ⚡

---

## 🆘 **EN CAS DE DOUTE**

**Si vous ne savez pas si rebuild est nécessaire :**

1. Regardez l'extension du fichier :
   - `.html`, `.js`, `.css` → ❌ Pas de rebuild
   - `.cs`, `.csproj` → ✅ Rebuild

2. Regardez le dossier :
   - `wwwroot/` → ❌ Pas de rebuild
   - Autre dossier → ✅ Rebuild

3. En cas de doute :
   - Faites `dotnet build` (sûr mais plus lent)
   - Ou demandez-moi ! 😊

---

**Créé le** : 2025-10-08
**Auteur** : Claude (AI Assistant)
**Version** : 1.0
