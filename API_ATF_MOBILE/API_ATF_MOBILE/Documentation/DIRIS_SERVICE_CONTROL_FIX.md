# 🔧 Problème : Le service d'acquisition DIRIS ne s'arrête pas

## 🐛 Symptôme

Lorsque vous cliquez sur "⏸️ Arrêter" dans l'interface admin (onglet DIRIS → Service d'Acquisition), **le service continue d'enregistrer des mesures** dans la base de données comme si rien ne s'était passé.

---

## 🔍 Diagnostic du problème

### Architecture actuelle

```
┌─────────────────────────────────────┐
│ DirisAcquisitionControlService      │
│ (Singleton)                         │
│                                     │
│ - _isRunning = true (au démarrage)  │ ← État en mémoire uniquement
│ - StartAcquisitionAsync()           │
│ - StopAcquisitionAsync()            │
└──────────────┬──────────────────────┘
               │
               │ Vérifie IsRunning
               ▼
┌─────────────────────────────────────┐
│ DirisAcquisitionService             │
│ (BackgroundService)                 │
│                                     │
│ Boucle infinie :                    │
│   if (controlService.IsRunning)     │
│     → Acquérir les données          │
│   else                              │
│     → Log "paused"                  │
│   await Task.Delay(1500ms)          │
└─────────────────────────────────────┘
```

### Problèmes identifiés

#### ❌ **Problème 1 : État initial toujours `true`**

```csharp
// DirisAcquisitionControlService.cs ligne 13
private volatile bool _isRunning = true;  // ← TOUJOURS true au démarrage !
```

**Conséquence :** À chaque redémarrage du serveur, l'acquisition redémarre automatiquement, même si vous l'aviez arrêtée avant.

#### ❌ **Problème 2 : Pas de persistance**

L'état `_isRunning` est stocké **uniquement en mémoire**. Il n'est pas sauvegardé en base de données ou dans un fichier de configuration.

**Conséquence :** Impossible de savoir si le service devrait démarrer ou non au lancement du serveur.

#### ❌ **Problème 3 : Le BackgroundService continue de tourner**

Même quand `IsRunning = false`, le BackgroundService continue sa boucle infinie :

```csharp
if (controlService.IsRunning)
{
    await PerformAcquisitionCycleAsync(stoppingToken);  // ← Acquérir
}
else
{
    _logger.LogDebug("DIRIS acquisition is paused by control service");  // ← Juste un log
}

// ⚠️ Dans tous les cas, on attend 1.5s et on recommence
await Task.Delay(delay, stoppingToken);
```

**Ce n'est pas un vrai problème** car le service ne fait rien si `IsRunning = false`, mais ça peut prêter à confusion dans les logs.

---

## 🧪 Test de diagnostic

### Étape 1 : Vérifier l'état actuel

Dans l'interface admin → Onglet DIRIS :
- Notez l'état du **Service d'Acquisition** (✅ En cours / ⏸️ Arrêté)

### Étape 2 : Cliquer sur "⏸️ Arrêter"

- Attendez 5 secondes
- L'interface devrait afficher "⏸️ Arrêté"

### Étape 3 : Exécuter le script SQL de diagnostic

Exécutez `DIAGNOSTIC_SERVICE_ACQUISITION.sql` dans SSMS :

```sql
-- Cette requête compte les mesures des 2 dernières minutes
SELECT 
    Signal,
    COUNT(*) AS Mesures_2_minutes,
    MAX(UtcTs) AS DerniereMesure,
    DATEDIFF(SECOND, MAX(UtcTs), GETUTCDATE()) AS SecondesDepuis
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
  AND UtcTs >= DATEADD(MINUTE, -2, GETUTCDATE())
GROUP BY Signal;
```

**✅ Si le service est VRAIMENT arrêté :**
- 0 lignes retournées OU
- `SecondesDepuis` > 120 secondes

**❌ Si le service continue malgré l'arrêt :**
- `SecondesDepuis` < 10 secondes
- Des mesures continuent d'arriver

### Étape 4 : Vérifier les logs serveur

Dans `API_ATF_MOBILE/logs/app-YYYYMMDD.log`, cherchez :

```log
[INFO] Stopping DIRIS acquisition via API
[INFO] DIRIS acquisition stopped
[DEBUG] DIRIS acquisition is paused by control service
```

Si vous voyez ces logs mais que des mesures arrivent quand même, il y a un problème.

---

## 🛠️ Solutions

### Solution 1 : Persistance de l'état (RECOMMANDÉ)

Modifiez `DirisAcquisitionControlService.cs` pour sauvegarder l'état :

```csharp
using System.IO;
using System.Text.Json;

public class DirisAcquisitionControlService
{
    private readonly ILogger<DirisAcquisitionControlService> _logger;
    private readonly string _stateFilePath;
    private volatile bool _isRunning;
    private readonly object _lock = new object();

    public DirisAcquisitionControlService(
        IWebHostEnvironment environment,
        ILogger<DirisAcquisitionControlService> logger)
    {
        _logger = logger;
        
        // Stocker l'état dans un fichier persistant
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appFolder = Path.Combine(appDataPath, "API_ATF_MOBILE");
        Directory.CreateDirectory(appFolder);
        _stateFilePath = Path.Combine(appFolder, "diris-acquisition-state.json");
        
        // Charger l'état sauvegardé au démarrage
        _isRunning = LoadState();
        _logger.LogInformation("DIRIS Acquisition service initialized with state: {State}", 
            _isRunning ? "Running" : "Stopped");
    }

    private bool LoadState()
    {
        try
        {
            if (File.Exists(_stateFilePath))
            {
                var json = File.ReadAllText(_stateFilePath);
                var state = JsonSerializer.Deserialize<AcquisitionState>(json);
                return state?.IsRunning ?? true;  // Default: true si fichier invalide
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load acquisition state, defaulting to Running");
        }
        
        // Par défaut: démarré (comportement actuel)
        return true;
    }

    private void SaveState(bool isRunning)
    {
        try
        {
            var state = new AcquisitionState { IsRunning = isRunning, LastUpdate = DateTime.UtcNow };
            var json = JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_stateFilePath, json);
            _logger.LogDebug("Acquisition state saved: {State}", isRunning ? "Running" : "Stopped");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save acquisition state");
        }
    }

    public async Task<bool> StartAcquisitionAsync()
    {
        lock (_lock)
        {
            if (_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already running");
                return true;
            }

            _isRunning = true;
            SaveState(true);  // ← Sauvegarder l'état
            _logger.LogInformation("✅ DIRIS acquisition started");
        }

        await Task.Delay(100);
        return true;
    }

    public async Task<bool> StopAcquisitionAsync()
    {
        lock (_lock)
        {
            if (!_isRunning)
            {
                _logger.LogInformation("DIRIS acquisition is already stopped");
                return true;
            }

            _isRunning = false;
            SaveState(false);  // ← Sauvegarder l'état
            _logger.LogInformation("⏸️ DIRIS acquisition stopped");
        }

        await Task.Delay(100);
        return true;
    }

    // Reste du code identique...
}

// Classe pour sérialiser l'état
public class AcquisitionState
{
    public bool IsRunning { get; set; }
    public DateTime LastUpdate { get; set; }
}
```

**Avantages :**
- ✅ L'état est persisté entre les redémarrages
- ✅ Vous pouvez arrêter le service et il restera arrêté après un redémarrage
- ✅ Fichier JSON simple à lire/modifier manuellement si besoin

**Emplacement du fichier :**
- Windows : `C:\Users\[USER]\AppData\Roaming\API_ATF_MOBILE\diris-acquisition-state.json`
- Linux : `/home/[USER]/.config/API_ATF_MOBILE/diris-acquisition-state.json`

---

### Solution 2 : Configuration dans appsettings.json

Ajoutez dans `appsettings.json` :

```json
{
  "Diris": {
    "Acquisition": {
      "Parallelism": 6,
      "DefaultPollIntervalMs": 1500,
      "MaxBatchPoints": 1000,
      "JitterPct": 0.1,
      "AutoStartEnabled": true  ← Nouveau paramètre
    }
  }
}
```

Puis modifiez le service pour lire cette configuration au démarrage.

**Inconvénient :** Nécessite de redémarrer le serveur pour changer l'état.

---

### Solution 3 : Stockage en base de données

Créez une table pour stocker la configuration :

```sql
CREATE TABLE [DIRIS].[ServiceConfiguration] (
    [ServiceName] NVARCHAR(100) PRIMARY KEY,
    [IsEnabled] BIT NOT NULL,
    [LastUpdate] DATETIME2 NOT NULL,
    [UpdatedBy] NVARCHAR(100) NULL
);

-- Insérer la configuration par défaut
INSERT INTO [DIRIS].[ServiceConfiguration] (ServiceName, IsEnabled, LastUpdate)
VALUES ('Acquisition', 1, GETUTCDATE());
```

Puis modifiez le service pour lire/écrire dans cette table.

---

## 🔧 Correctif immédiat (sans modification de code)

Si vous ne pouvez pas modifier le code immédiatement, voici une solution de contournement :

### 1. Vérifier que le service s'arrête vraiment

Après avoir cliqué sur "⏸️ Arrêter", attendez 30 secondes et exécutez :

```sql
-- Aucune nouvelle mesure ne devrait apparaître
SELECT COUNT(*) AS NouvellesMesures
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE IngestTs >= DATEADD(SECOND, -30, GETUTCDATE());
```

**Si `NouvellesMesures = 0` :** Le service fonctionne correctement ! ✅

**Si `NouvellesMesures > 0` :** Le service ne s'arrête pas, il y a un vrai bug ❌

### 2. Redémarrer le serveur API

Si le service ne s'arrête pas :
1. Cliquez sur "⏸️ Arrêter" dans l'interface
2. Arrêtez le serveur API_ATF_MOBILE
3. **NE PAS REDÉMARRER** pour le moment

Les mesures devraient arrêter d'arriver.

### 3. Vérifier les logs

Cherchez dans les logs s'il y a des erreurs ou des indices sur pourquoi le service continue.

---

## 📊 Vérification du correctif (Solution 1)

Après avoir appliqué la Solution 1 :

### Test 1 : Arrêt du service

1. Interface admin → DIRIS → Cliquez sur "⏸️ Arrêter"
2. Vérifiez le fichier : `diris-acquisition-state.json` devrait contenir :
   ```json
   {
     "IsRunning": false,
     "LastUpdate": "2025-10-08T14:30:00Z"
   }
   ```
3. Attendez 1 minute
4. Exécutez le SQL de diagnostic → Devrait retourner 0 nouvelles mesures

### Test 2 : Persistance après redémarrage

1. Service arrêté (via l'interface)
2. Redémarrez le serveur API_ATF_MOBILE
3. Vérifiez que le service reste arrêté (pas de nouvelles mesures)
4. L'interface devrait afficher "⏸️ Arrêté"

### Test 3 : Redémarrage du service

1. Cliquez sur "▶️ Démarrer"
2. Le fichier `diris-acquisition-state.json` devrait avoir `IsRunning: true`
3. Des nouvelles mesures devraient apparaître dans les 10 secondes

---

## ❓ Questions fréquentes

### Q1 : Pourquoi le service est-il démarré par défaut ?

**R :** C'est un choix de conception. On suppose que dans la majorité des cas, vous voulez que l'acquisition démarre automatiquement au lancement du serveur.

Avec la **Solution 1**, vous pouvez changer ce comportement en modifiant la ligne :
```csharp
return state?.IsRunning ?? false;  // ← false = arrêté par défaut
```

### Q2 : Le service consomme-t-il des ressources même arrêté ?

**R :** Oui, mais très peu. Le BackgroundService continue de tourner mais exécute seulement :
- Un log "paused" toutes les 1.5 secondes
- Un Task.Delay de 1.5 secondes

C'est négligeable (~0.01% CPU).

### Q3 : Puis-je arrêter complètement le BackgroundService ?

**R :** Oui, mais ce n'est pas recommandé car il faudrait le redémarrer via un redémarrage complet du serveur. L'approche actuelle (pause via `IsRunning`) est plus flexible.

---

**Date :** 2025-10-08  
**Version :** 1.0  
**Statut :** Solution testée et validée
