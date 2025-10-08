# 🔍 Diagnostic : Problème d'enregistrement de tous les signaux DIRIS

## Problème rapporté

Vous avez activé un seul device DIRIS (ATR - TR1) et n'avez coché que certains signaux dans l'interface admin, mais **TOUS les signaux sont enregistrés** dans la base de données `[AI_ATR].[DIRIS].[Measurements]`.

## Comment fonctionne le filtrage des signaux

### 1. Configuration des signaux (TagMaps)

Chaque device DIRIS possède des **TagMaps** qui définissent :
- `Signal` : Nom du signal (ex: `I_PH1_255`, `PH1_RP_255`)
- `WebMiKey` : Clé pour lire depuis le WebMI du DIRIS
- `Unit` : Unité de mesure
- `Scale` : Facteur d'échelle
- **`Enabled`** : ✅ Si `true`, le signal est lu et enregistré | ❌ Si `false`, le signal est ignoré

### 2. Flux d'acquisition

```
┌──────────────────┐
│ Interface Admin  │  ← Vous cochez/décochez des signaux
│ (diris-manager)  │
└────────┬─────────┘
         │ PUT /api/diris/devices/{id}/tagmaps/enabled
         │ Body: { "enabledSignals": ["I_PH1_255", "PH1_RP_255", ...] }
         ▼
┌────────────────────────────────────────┐
│ DirisDevicesController                 │
│ → UpdateTagMappingsEnabled()           │
│ → Met à jour la BDD TagMaps.Enabled    │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ Base de données AI_ATR.DIRIS.TagMaps  │
│ Chaque signal a : Enabled = 1 ou 0    │
└────────────────┬───────────────────────┘
                 │
                 │ Lecture lors de l'acquisition
                 ▼
┌────────────────────────────────────────┐
│ DirisAcquisitionService                │
│ → Boucle en continu si IsRunning=true │
│ → Pour chaque device enabled          │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ WebMiReaderSimple.ReadAsync()          │
│ 1. Récupère les TagMaps du device      │
│ 2. FILTRE: .Where(t => t.Enabled)     │ ← FILTRAGE ICI !
│ 3. Lit uniquement les signaux activés  │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│ IMeasurementWriter.WriteAsync()        │
│ → Enregistre SEULEMENT les mesures    │
│    des signaux Enabled=true            │
└────────────────────────────────────────┘
```

## 🔎 Diagnostic étape par étape

### Étape 1 : Vérifier l'état des TagMaps dans la base de données

Exécutez le script SQL `VERIFICATION_TAGMAPS.sql` dans SSMS :

```sql
-- Voir les TagMaps du device DIRIS ATR-TR1
SELECT 
    tm.Signal,
    tm.Enabled,  -- ← Doit être 0 pour les signaux non cochés
    tm.Description
FROM [AI_ATR].[DIRIS].[TagMaps] tm
INNER JOIN [AI_ATR].[DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE d.Name LIKE '%ATR%TR1%'
ORDER BY tm.Enabled DESC, tm.Signal;
```

**✅ Résultat attendu :**
- Les signaux que vous avez **cochés** doivent avoir `Enabled = 1`
- Les signaux que vous avez **décochés** doivent avoir `Enabled = 0`

**❌ Si tous les signaux ont `Enabled = 1` :**
→ Le problème vient de la sauvegarde des TagMaps (voir [Solution 1](#solution-1--forcer-la-mise-à-jour-des-tagmaps))

**✅ Si les signaux sont correctement configurés (Enabled 0/1) :**
→ Le problème vient de l'acquisition qui ne respecte pas le filtrage (voir [Solution 2](#solution-2--vérifier-le-filtrage-dans-le-code))

### Étape 2 : Vérifier les mesures enregistrées

```sql
-- Compter les mesures par signal (dernières 10 minutes)
SELECT 
    m.Signal,
    COUNT(*) AS NombreMesures,
    (SELECT Enabled FROM [AI_ATR].[DIRIS].[TagMaps] tm 
     WHERE tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal) AS SignalActive
FROM [AI_ATR].[DIRIS].[Measurements] m
INNER JOIN [AI_ATR].[DIRIS].[Devices] d ON m.DeviceId = d.DeviceId
WHERE d.Name LIKE '%ATR%TR1%'
  AND m.UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())
GROUP BY m.DeviceId, m.Signal
ORDER BY SignalActive DESC, NombreMesures DESC;
```

**✅ Résultat attendu :**
- Seuls les signaux avec `SignalActive = 1` doivent avoir des mesures récentes

**❌ Si des signaux avec `SignalActive = 0` ont des mesures :**
→ Le filtrage ne fonctionne pas correctement (voir [Solution 2](#solution-2--vérifier-le-filtrage-dans-le-code))

### Étape 3 : Vérifier l'état du service d'acquisition

Dans l'interface admin (onglet DIRIS) :
1. **Service d'Acquisition** : Doit être "✅ En cours d'acquisition"
2. **Métriques** : Points/seconde > 0 indique que l'acquisition fonctionne

## 🛠️ Solutions

### Solution 1 : Forcer la mise à jour des TagMaps

Si les TagMaps ne sont pas correctement sauvegardés dans la base de données :

#### Option A : Via l'interface admin

1. Accédez à l'onglet **DIRIS**
2. Sur le device ATR-TR1, cliquez sur **🏷️ Signaux**
3. Cliquez sur **❌ Tout désélectionner**
4. Cochez **UNIQUEMENT** les signaux que vous voulez enregistrer
5. Cliquez sur **💾 Sauvegarder**
6. Attendez 2-3 secondes
7. **Rafraîchissez** la page et vérifiez que les cases cochées correspondent

#### Option B : Vérification manuelle des signaux sauvegardés

Après avoir sauvegardé, ouvrez la console du navigateur (F12) et exécutez :

```javascript
// Récupérer les TagMaps du device (remplacer 1 par l'ID de votre device)
const deviceId = 1;
const response = await fetch(`/api/diris/devices/${deviceId}/tagmaps`, {
    headers: {
        'Authorization': `Bearer ${apiClient.token}`
    }
});
const tagMaps = await response.json();

// Compter les signaux activés
const enabled = tagMaps.filter(t => t.enabled);
const disabled = tagMaps.filter(t => !t.enabled);

console.log(`✅ Signaux activés: ${enabled.length}`);
console.log(`❌ Signaux désactivés: ${disabled.length}`);
console.log('Signaux activés:', enabled.map(t => t.signal));
```

#### Option C : Mise à jour manuelle via SQL (si nécessaire)

**⚠️ ATTENTION : Utilisez cette option uniquement si l'interface ne fonctionne pas**

```sql
-- Désactiver TOUS les signaux du device ATR-TR1
UPDATE [AI_ATR].[DIRIS].[TagMaps]
SET Enabled = 0
WHERE DeviceId = (
    SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] 
    WHERE Name LIKE '%ATR%TR1%'
);

-- Activer SEULEMENT les signaux souhaités (exemple : courants, tensions, puissances)
UPDATE [AI_ATR].[DIRIS].[TagMaps]
SET Enabled = 1
WHERE DeviceId = (SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
AND Signal IN (
    -- COURANTS
    'I_PH1_255',
    'I_PH2_255',
    'I_PH3_255',
    -- TENSIONS PHASE-NEUTRE
    'PV1_255',
    'PV2_255',
    'PV3_255',
    -- PUISSANCES ACTIVES
    'PH1_RP_255',
    'PH2_RP_255',
    'PH3_RP_255',
    'SUM_RP_255'
    -- Ajoutez les autres signaux souhaités ici
);

-- Vérifier le résultat
SELECT Signal, Enabled, Description
FROM [AI_ATR].[DIRIS].[TagMaps]
WHERE DeviceId = (SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
ORDER BY Enabled DESC, Signal;
```

### Solution 2 : Vérifier le filtrage dans le code

Si les TagMaps sont correctement configurés mais que tous les signaux sont quand même enregistrés, il peut y avoir un problème dans le code.

#### Vérification 1 : WebMiReaderSimple

Le fichier `Diris.Providers.WebMI\WebMiReaderSimple.cs` doit contenir (ligne 42) :

```csharp
var enabledMappings = tagMappings.Where(t => t.Enabled).ToList();
```

#### Vérification 2 : DeviceRegistry

Assurez-vous que la méthode `GetTagMappingsAsync` dans le DeviceRegistry retourne bien les TagMaps avec le bon état `Enabled`.

#### Vérification 3 : Logs de l'application

Vérifiez les logs dans `API_ATF_MOBILE/logs/app-YYYYMMDD.log` :

```bash
# Rechercher les logs d'acquisition
grep "Successfully read" app-20251008.log

# Vous devriez voir quelque chose comme :
# "Successfully read 12 measurements from device 1 in 145ms"
# Le nombre (12) doit correspondre au nombre de signaux activés
```

### Solution 3 : Nettoyer les anciennes mesures

Si vous avez résolu le problème mais que la base contient encore beaucoup d'anciennes mesures :

```sql
-- Option 1 : Supprimer TOUTES les mesures du device ATR-TR1
DELETE FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (
    SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] 
    WHERE Name LIKE '%ATR%TR1%'
);

-- Option 2 : Supprimer seulement les mesures des signaux désactivés
DELETE m
FROM [AI_ATR].[DIRIS].[Measurements] m
WHERE EXISTS (
    SELECT 1 
    FROM [AI_ATR].[DIRIS].[TagMaps] tm
    WHERE tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal
    AND tm.Enabled = 0  -- Signaux désactivés
);

-- Vérifier le résultat
SELECT COUNT(*) AS MesuresRestantes
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (
    SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] 
    WHERE Name LIKE '%ATR%TR1%'
);
```

## 🔄 Redémarrage du service d'acquisition

Après avoir corrigé les TagMaps, **redémarrez le service d'acquisition** :

### Via l'interface admin

1. Accédez à l'onglet **DIRIS**
2. Dans **Services DIRIS** → **Service d'Acquisition**
3. Cliquez sur **⏸️ Arrêter**
4. Attendez 2-3 secondes
5. Cliquez sur **▶️ Démarrer**

### Via l'API (si nécessaire)

```bash
# Arrêter
curl -X POST http://localhost:8088/api/diris/acquisition/stop \
  -H "Authorization: Bearer YOUR_TOKEN"

# Démarrer
curl -X POST http://localhost:8088/api/diris/acquisition/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ✅ Validation finale

Après avoir appliqué les solutions :

1. **Attendez 1-2 minutes** pour que le service d'acquisition effectue plusieurs cycles
2. **Exécutez la requête de vérification** :

```sql
-- Cette requête doit montrer SEULEMENT les signaux activés
SELECT 
    m.Signal,
    COUNT(*) AS NombreMesuresRecentes,
    tm.Enabled AS SignalActive,
    MAX(m.UtcTs) AS DerniereMesure
FROM [AI_ATR].[DIRIS].[Measurements] m
INNER JOIN [AI_ATR].[DIRIS].[Devices] d ON m.DeviceId = d.DeviceId
INNER JOIN [AI_ATR].[DIRIS].[TagMaps] tm ON m.DeviceId = tm.DeviceId AND m.Signal = tm.Signal
WHERE d.Name LIKE '%ATR%TR1%'
  AND m.UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE())  -- Dernières 5 minutes
GROUP BY m.Signal, tm.Enabled
ORDER BY tm.Enabled DESC, NombreMesuresRecentes DESC;
```

**✅ Résultat attendu :**
- Tous les signaux listés doivent avoir `SignalActive = 1`
- Aucun signal avec `SignalActive = 0` ne doit apparaître

3. **Vérifiez le nombre de mesures par cycle** :
   - Si vous avez coché 10 signaux et que l'intervalle de poll est de 1500ms
   - Vous devriez avoir environ **10 mesures toutes les 1.5 secondes**
   - Soit environ **400 mesures par minute**

```sql
-- Compter les mesures par minute
SELECT 
    DATEPART(HOUR, UtcTs) AS Heure,
    DATEPART(MINUTE, UtcTs) AS Minute,
    COUNT(*) AS NombreMesures
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (SELECT DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
  AND UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())
GROUP BY DATEPART(HOUR, UtcTs), DATEPART(MINUTE, UtcTs)
ORDER BY Heure DESC, Minute DESC;
```

## 📊 Monitoring continu

Pour surveiller que le problème ne revient pas :

```sql
-- Créer une vue pour surveiller facilement
CREATE OR ALTER VIEW [DIRIS].[vw_SignalUsage] AS
SELECT 
    d.DeviceId,
    d.Name AS DeviceName,
    tm.Signal,
    tm.Enabled,
    COUNT(m.Id) AS MesuresDerniereHeure
FROM [DIRIS].[Devices] d
LEFT JOIN [DIRIS].[TagMaps] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal
    AND m.UtcTs >= DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY d.DeviceId, d.Name, tm.Signal, tm.Enabled;
GO

-- Utiliser la vue pour détecter les anomalies
SELECT *
FROM [DIRIS].[vw_SignalUsage]
WHERE Enabled = 0 AND MesuresDerniereHeure > 0  -- Signaux désactivés mais avec mesures
ORDER BY MesuresDerniereHeure DESC;
```

## 🐛 Problèmes connus

### Problème 1 : Les modifications ne sont pas persistées

**Symptôme :** Après avoir coché/décoché des signaux et cliqué sur "Sauvegarder", les modifications sont perdues après rafraîchissement de la page.

**Cause possible :** Cache du navigateur ou problème de base de données.

**Solution :**
1. Ouvrez la console du navigateur (F12)
2. Videz le cache (Ctrl+Shift+Delete)
3. Rechargez la page en mode navigation privée
4. Réessayez

### Problème 2 : Le service d'acquisition ne démarre pas

**Symptôme :** Après avoir cliqué sur "▶️ Démarrer", le service reste en "⏸️ Arrêté".

**Cause possible :** Erreur dans le service en arrière-plan.

**Solution :**
1. Vérifiez les logs : `API_ATF_MOBILE/logs/app-YYYYMMDD.log`
2. Recherchez "DIRIS Acquisition" dans les logs
3. Si vous voyez des erreurs, redémarrez le serveur API complet

### Problème 3 : Trop de signaux enregistrés malgré le filtrage

**Symptôme :** La base de données contient des millions de lignes malgré le filtrage.

**Cause :** Accumulation de données anciennes.

**Solution :**
1. Utilisez le nettoyage manuel (voir [Solution 3](#solution-3--nettoyer-les-anciennes-mesures))
2. Configurez la rétention automatique (onglet DIRIS → Configuration → Rétention des données)

## 📞 Support

Si le problème persiste après avoir suivi ce guide :

1. **Récupérez les informations de diagnostic** :
   ```sql
   -- Exécutez ce script et envoyez les résultats
   SELECT 'Devices' AS TableName, COUNT(*) AS RowCount FROM [DIRIS].[Devices]
   UNION ALL
   SELECT 'TagMaps', COUNT(*) FROM [DIRIS].[TagMaps]
   UNION ALL
   SELECT 'TagMaps Enabled', COUNT(*) FROM [DIRIS].[TagMaps] WHERE Enabled = 1
   UNION ALL
   SELECT 'TagMaps Disabled', COUNT(*) FROM [DIRIS].[TagMaps] WHERE Enabled = 0
   UNION ALL
   SELECT 'Measurements Last Hour', COUNT(*) FROM [DIRIS].[Measurements] WHERE UtcTs >= DATEADD(HOUR, -1, GETUTCDATE());
   ```

2. **Vérifiez les logs récents** :
   - `API_ATF_MOBILE/logs/app-YYYYMMDD.log` (dernières 100 lignes)

3. **Capturez une requête réseau** :
   - F12 → Onglet Network
   - Effectuez une sauvegarde de signaux
   - Exportez la requête HTTP (clic droit → Copy as cURL)

---

**Dernière mise à jour :** 2025-10-08  
**Version du système DIRIS :** 1.0
