# 🔧 Installation du correctif : Service d'acquisition DIRIS

## 📋 Problème corrigé

Le service d'acquisition DIRIS ne s'arrêtait pas correctement lorsqu'on cliquait sur "⏸️ Arrêter" dans l'interface admin, et redémarrait toujours automatiquement après un redémarrage du serveur.

## ✅ Correctif appliqué

- **Persistance de l'état** : L'état (démarré/arrêté) est maintenant sauvegardé dans un fichier JSON
- **Préservation après redémarrage** : Si vous arrêtez le service, il restera arrêté après un redémarrage
- **Logs améliorés** : Messages plus clairs avec émojis pour faciliter le suivi

---

## 🚀 Installation rapide

### Étape 1 : Diagnostic préalable

Avant d'appliquer le correctif, vérifiez si vous êtes vraiment affecté :

```sql
-- Exécutez cette requête dans SSMS
-- Puis cliquez sur "⏸️ Arrêter" dans l'interface
-- Et attendez 30 secondes

SELECT 
    COUNT(*) AS NouvellesMesures,
    MAX(IngestTs) AS DerniereIngestion
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE IngestTs >= DATEADD(SECOND, -35, GETUTCDATE());
```

**Si `NouvellesMesures = 0` :** Votre service fonctionne correctement, pas besoin du correctif ✅  
**Si `NouvellesMesures > 0` :** Vous êtes affecté, appliquez le correctif ❌

---

### Étape 2 : Sauvegarder l'ancien fichier

```powershell
# Dans le dossier du projet
cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE\Services

# Sauvegarder l'ancien fichier
Copy-Item DirisAcquisitionControlService.cs DirisAcquisitionControlService.cs.backup
```

---

### Étape 3 : Remplacer le fichier

```powershell
# Remplacer par la version corrigée
Copy-Item DirisAcquisitionControlService_FIXED.cs DirisAcquisitionControlService.cs -Force
```

**OU** manuellement dans Visual Studio :

1. Ouvrez `Services/DirisAcquisitionControlService.cs`
2. Ouvrez `Services/DirisAcquisitionControlService_FIXED.cs`
3. Copiez tout le contenu de `_FIXED.cs`
4. Remplacez tout le contenu de `DirisAcquisitionControlService.cs`
5. Sauvegardez (Ctrl+S)

---

### Étape 4 : Recompiler le projet

Dans Visual Studio :

```
1. Build → Rebuild Solution
2. Vérifiez qu'il n'y a pas d'erreurs
3. Les warnings sont normaux
```

OU en ligne de commande :

```powershell
cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE
dotnet build --configuration Release
```

---

### Étape 5 : Arrêter le serveur

```powershell
# Si le serveur tourne en tant que service Windows
Stop-Service "API_ATF_MOBILE"

# OU si vous l'exécutez manuellement
# Appuyez sur Ctrl+C dans la console où il tourne
```

---

### Étape 6 : Redémarrer le serveur

```powershell
# Si c'est un service Windows
Start-Service "API_ATF_MOBILE"

# OU manuellement
cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE
dotnet run --configuration Release
```

---

### Étape 7 : Vérifier les logs au démarrage

Cherchez ces lignes dans `logs/app-YYYYMMDD.log` :

```log
✅ DIRIS Acquisition Control Service initialized with state: 🟢 Running (from C:\Users\...\diris-acquisition-state.json)
📂 Loaded acquisition state from file: IsRunning=True, LastUpdate=2025-10-08T...
```

OU si c'est la première fois :

```log
📄 No state file found, creating with default state: Running=true
💾 Acquisition state saved to C:\Users\...\diris-acquisition-state.json: Running
```

---

## 🧪 Test du correctif

### Test 1 : Arrêt du service

1. Ouvrez l'interface admin → Onglet DIRIS
2. Cliquez sur **⏸️ Arrêter** (Service d'Acquisition)
3. Attendez 5 secondes
4. Vérifiez que le statut affiche "⏸️ Arrêté"

### Test 2 : Vérification en base de données

```sql
-- Attendre 30 secondes après l'arrêt
-- Cette requête ne devrait retourner AUCUNE ligne

SELECT 
    Signal,
    COUNT(*) AS Mesures_30_secondes,
    MAX(IngestTs) AS DerniereIngestion
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE IngestTs >= DATEADD(SECOND, -35, GETUTCDATE())
GROUP BY Signal;
```

**✅ Résultat attendu : 0 lignes**

### Test 3 : Vérification du fichier d'état

```powershell
# Windows
$statePath = "$env:APPDATA\API_ATF_MOBILE\diris-acquisition-state.json"
Get-Content $statePath

# Devrait afficher :
# {
#   "isRunning": false,
#   "lastUpdate": "2025-10-08T14:30:00Z",
#   "version": "1.0"
# }
```

### Test 4 : Persistance après redémarrage

1. **Service arrêté** (via le test précédent)
2. **Redémarrez le serveur** complètement
3. Vérifiez les logs :
   ```log
   📂 Loaded acquisition state from file: IsRunning=False, LastUpdate=...
   ✅ DIRIS Acquisition Control Service initialized with state: 🔴 Stopped
   ```
4. Vérifiez dans l'interface : le statut doit être **"⏸️ Arrêté"**
5. Vérifiez en base : **aucune nouvelle mesure**

### Test 5 : Redémarrage du service

1. Cliquez sur **▶️ Démarrer**
2. Attendez 10 secondes
3. Exécutez :
   ```sql
   SELECT COUNT(*) AS NouvellesMesures
   FROM [AI_ATR].[DIRIS].[Measurements]
   WHERE IngestTs >= DATEADD(SECOND, -15, GETUTCDATE());
   ```
4. **Résultat attendu : > 0** (le service fonctionne à nouveau)

---

## 📂 Emplacement du fichier d'état

Le fichier `diris-acquisition-state.json` est créé dans :

### Windows
```
C:\Users\[VOTRE_UTILISATEUR]\AppData\Roaming\API_ATF_MOBILE\diris-acquisition-state.json
```

### Linux
```
/home/[VOTRE_UTILISATEUR]/.config/API_ATF_MOBILE/diris-acquisition-state.json
```

### Contenu du fichier

```json
{
  "isRunning": true,
  "lastUpdate": "2025-10-08T14:30:00.123Z",
  "version": "1.0",
  "comment": null
}
```

---

## 🔧 Manipulation manuelle (avancé)

Si vous voulez changer l'état manuellement sans passer par l'interface :

### Arrêter le service manuellement

```powershell
# 1. Arrêter le serveur API
Stop-Service "API_ATF_MOBILE"

# 2. Éditer le fichier
$statePath = "$env:APPDATA\API_ATF_MOBILE\diris-acquisition-state.json"
$content = @"
{
  "isRunning": false,
  "lastUpdate": "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")",
  "version": "1.0"
}
"@
$content | Out-File -FilePath $statePath -Encoding UTF8

# 3. Redémarrer le serveur
Start-Service "API_ATF_MOBILE"
```

### Démarrer le service manuellement

Changez `"isRunning": false` en `"isRunning": true` dans le fichier.

---

## 🐛 Dépannage

### Problème 1 : Le fichier d'état n'est pas créé

**Symptôme :** Aucun fichier dans `%APPDATA%\API_ATF_MOBILE\`

**Causes possibles :**
- Permissions insuffisantes
- Problème de chemin

**Solution :**
```powershell
# Créer le dossier manuellement
New-Item -ItemType Directory -Path "$env:APPDATA\API_ATF_MOBILE" -Force

# Vérifier les permissions
Get-Acl "$env:APPDATA\API_ATF_MOBILE"
```

### Problème 2 : Le service démarre toujours même si le fichier dit "false"

**Symptôme :** `isRunning: false` dans le fichier, mais le service tourne

**Causes possibles :**
- Le fichier n'est pas lu au démarrage
- Erreur dans le JSON

**Solution :**
```powershell
# Vérifier que le JSON est valide
Get-Content "$env:APPDATA\API_ATF_MOBILE\diris-acquisition-state.json" | ConvertFrom-Json

# Si erreur : recréer le fichier
@"
{
  "isRunning": false,
  "lastUpdate": "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")",
  "version": "1.0"
}
"@ | Out-File -FilePath "$env:APPDATA\API_ATF_MOBILE\diris-acquisition-state.json" -Encoding UTF8
```

### Problème 3 : Logs d'erreur au démarrage

**Symptôme :** Logs contenant `Failed to load acquisition state`

**Solution :** Le service utilisera l'état par défaut (`Running = true`). C'est normal pour une première exécution.

---

## 🔄 Retour en arrière (rollback)

Si le correctif cause des problèmes :

```powershell
cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE\Services

# Restaurer l'ancien fichier
Copy-Item DirisAcquisitionControlService.cs.backup DirisAcquisitionControlService.cs -Force

# Recompiler
dotnet build --configuration Release

# Redémarrer le serveur
Restart-Service "API_ATF_MOBILE"
```

---

## 📊 Différences entre l'ancien et le nouveau code

### Avant (problématique)

```csharp
private volatile bool _isRunning = true;  // ← Toujours true au démarrage

public DirisAcquisitionControlService(ILogger<...> logger)
{
    _logger = logger;
    // Pas de persistance
}
```

### Après (corrigé)

```csharp
private volatile bool _isRunning;  // ← Chargé depuis le fichier

public DirisAcquisitionControlService(IWebHostEnvironment environment, ILogger<...> logger)
{
    _logger = logger;
    
    // Fichier de configuration
    _stateFilePath = Path.Combine(appDataPath, "diris-acquisition-state.json");
    
    // Charger l'état au démarrage
    _isRunning = LoadState();  // ← Lit le fichier
}

private void SaveState(bool isRunning)
{
    // Sauvegarder dans le fichier JSON
    File.WriteAllText(_stateFilePath, json);
}
```

---

## ✅ Checklist d'installation

- [ ] Diagnostic préalable effectué
- [ ] Ancien fichier sauvegardé (.backup)
- [ ] Nouveau fichier copié
- [ ] Projet recompilé sans erreur
- [ ] Serveur redémarré
- [ ] Logs vérifiés (état chargé)
- [ ] Test 1 : Arrêt du service ✅
- [ ] Test 2 : Vérification BDD (0 mesures) ✅
- [ ] Test 3 : Fichier d'état créé ✅
- [ ] Test 4 : Persistance après redémarrage ✅
- [ ] Test 5 : Redémarrage du service ✅

---

**Version du correctif :** 1.0  
**Date :** 2025-10-08  
**Testé sur :** Windows Server 2019, .NET 8.0  
**Compatibilité :** Toutes versions du projet DIRIS
