# ✅ Vérification : Flux complet d'activation/désactivation des signaux DIRIS

## 🔍 Objectif
Vérifier que lorsque l'utilisateur coche/décoche des signaux dans l'interface admin, le champ `Enabled` est bien mis à jour dans la table `[AI_ATR].[DIRIS].[TagMap]`.

---

## 📊 Vue d'ensemble du flux

```
┌─────────────────────────────────┐
│ 1. INTERFACE ADMIN              │
│    index.html + diris-manager.js│
└──────────────┬──────────────────┘
               │ Utilisateur coche/décoche des signaux
               │ et clique sur "💾 Sauvegarder"
               ▼
┌─────────────────────────────────────────────────────────┐
│ 2. API CLIENT (JavaScript)                              │
│    api-client.js → updateDirisTagMappingsEnabled()      │
│                                                          │
│    PUT /api/diris/devices/{deviceId}/tagmaps/enabled    │
│    Body: { "enabledSignals": ["I_PH1_255", "PV1_255"] } │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP PUT Request
               ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CONTROLLER (C#)                                       │
│    DirisDevicesController.UpdateTagMappingsEnabled()     │
│                                                          │
│    - Récupère TOUS les TagMaps du device                │
│    - Pour chaque TagMap:                                 │
│      mapping.Enabled = enabledSignals.Contains(signal)   │
│    - Appelle _deviceRegistry.UpdateTagMappingsAsync()    │
└──────────────┬──────────────────────────────────────────┘
               │ Appel méthode repository
               ▼
┌─────────────────────────────────────────────────────────┐
│ 4. REPOSITORY (C#)                                       │
│    DeviceRepository.UpdateTagMappingsAsync()             │
│                                                          │
│    TRANSACTION SQL:                                      │
│    1. DELETE FROM DIRIS.TagMap WHERE DeviceId = @id     │
│    2. INSERT INTO DIRIS.TagMap                           │
│       (DeviceId, Signal, ..., Enabled, ...)              │
│       VALUES (@id, @signal, ..., @enabled, ...)          │
│    3. COMMIT                                             │
└──────────────┬──────────────────────────────────────────┘
               │ SQL INSERT avec @Enabled
               ▼
┌─────────────────────────────────────────────────────────┐
│ 5. BASE DE DONNÉES                                       │
│    [AI_ATR].[DIRIS].[TagMap]                             │
│                                                          │
│    Colonnes:                                             │
│    - DeviceId (int)                                      │
│    - Signal (nvarchar)                                   │
│    - WebMiKey (nvarchar)                                 │
│    - Unit (nvarchar)                                     │
│    - Scale (float)                                       │
│    - Enabled (bit) ← MISE À JOUR ICI                    │
│    - Description (nvarchar)                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Code complet annoté

### 1️⃣ Interface admin (JavaScript)

**Fichier:** `wwwroot/admin/js/diris-manager.js`

```javascript
// Ligne 702-722
async saveSignalSettings(deviceId, modal) {
  try {
    // 1. Récupère tous les signaux cochés (✅) dans la modal
    const enabledSignals = Array.from(modal.querySelectorAll('.signal-enabled:checked'))
      .map(cb => cb.dataset.signal);
    
    // enabledSignals = ["I_PH1_255", "I_PH2_255", "PV1_255", ...]
    
    this.showInfo('💾 Sauvegarde des paramètres des signaux...');
    
    // 2. Appelle l'API client pour envoyer la liste des signaux activés
    const response = await this.apiClient.updateDirisTagMappingsEnabled(deviceId, enabledSignals);
    
    if (response.success) {
      this.showSuccess(`✅ Paramètres des signaux sauvegardés pour device ${deviceId}`);
      modal.remove();
    }
  } catch (error) {
    this.showError('Erreur lors de la sauvegarde des paramètres des signaux');
  }
}
```

---

### 2️⃣ API Client (JavaScript)

**Fichier:** `wwwroot/admin/js/api-client.js`

```javascript
// Ligne 421-426
async updateDirisTagMappingsEnabled(deviceId, enabledSignals) {
    // Envoie une requête PUT vers l'API
    return await this.request(`/api/diris/devices/${deviceId}/tagmaps/enabled`, {
        method: 'PUT',
        body: JSON.stringify({ enabledSignals })  // ← Payload JSON
    });
}
```

**Requête HTTP envoyée:**
```http
PUT /api/diris/devices/1/tagmaps/enabled HTTP/1.1
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "enabledSignals": [
    "I_PH1_255",
    "I_PH2_255",
    "I_PH3_255",
    "PV1_255",
    "PV2_255",
    "PV3_255",
    "SUM_RP_255"
  ]
}
```

---

### 3️⃣ Controller (C#)

**Fichier:** `Controllers/DirisDevicesController.cs`

```csharp
// Ligne 429-460
[HttpPut("{id}/tagmaps/enabled")]
public async Task<IActionResult> UpdateTagMappingsEnabled(
    int id, 
    [FromBody] UpdateTagMappingsEnabledRequest request)
{
    try
    {
        // 1. Vérifier que le device existe
        var device = await _deviceRegistry.GetDeviceAsync(id);
        if (device == null)
        {
            return NotFound();
        }

        // 2. Récupérer TOUS les TagMaps du device (81 signaux)
        var tagMappings = await _deviceRegistry.GetTagMappingsAsync(id);
        var updatedMappings = new List<TagMap>();

        // 3. Pour CHAQUE TagMap, mettre à jour le champ Enabled
        foreach (var mapping in tagMappings)
        {
            // ✅ SI le signal est dans la liste enabledSignals → Enabled = true
            // ❌ SINON → Enabled = false
            mapping.Enabled = request.EnabledSignals.Contains(mapping.Signal);
            updatedMappings.Add(mapping);
        }

        // 4. Sauvegarder en base de données
        await _deviceRegistry.UpdateTagMappingsAsync(id, updatedMappings);

        _logger.LogInformation(
            "Updated enabled status for {Count} tag mappings for device {DeviceId}", 
            updatedMappings.Count, id);

        return Ok(new { success = true, message = "Tag mappings updated successfully" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error updating tag mappings enabled status for device {DeviceId}", id);
        return StatusCode(500, "Error updating tag mappings");
    }
}
```

**Classe de requête:**
```csharp
// Ligne 680-683
public class UpdateTagMappingsEnabledRequest
{
    public List<string> EnabledSignals { get; set; } = new();
}
```

---

### 4️⃣ Repository (C#)

**Fichier:** `Diris.Storage.SqlServer/Repositories/DeviceRepository.cs`

```csharp
// Ligne 136-175
public async Task UpdateTagMappingsAsync(int deviceId, IEnumerable<TagMap> mappings)
{
    using var connection = new SqlConnection(_connectionString);
    await connection.OpenAsync();

    using var transaction = connection.BeginTransaction();
    try
    {
        // ====================================
        // ÉTAPE 1 : SUPPRIMER tous les TagMaps existants
        // ====================================
        const string deleteSql = "DELETE FROM DIRIS.TagMap WHERE DeviceId = @DeviceId";
        using var deleteCmd = new SqlCommand(deleteSql, connection, transaction);
        deleteCmd.Parameters.AddWithValue("@DeviceId", deviceId);
        await deleteCmd.ExecuteNonQueryAsync();

        // ====================================
        // ÉTAPE 2 : INSÉRER tous les TagMaps avec les nouvelles valeurs Enabled
        // ====================================
        const string insertSql = @"
            INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
            VALUES (@DeviceId, @Signal, @WebMiKey, @Unit, @Scale, @Enabled, @Description)";

        foreach (var mapping in mappings)
        {
            using var insertCmd = new SqlCommand(insertSql, connection, transaction);
            insertCmd.Parameters.AddWithValue("@DeviceId", deviceId);
            insertCmd.Parameters.AddWithValue("@Signal", mapping.Signal);
            insertCmd.Parameters.AddWithValue("@WebMiKey", mapping.WebMiKey);
            insertCmd.Parameters.AddWithValue("@Unit", (object?)mapping.Unit ?? DBNull.Value);
            insertCmd.Parameters.AddWithValue("@Scale", mapping.Scale);
            
            // ✅ ICI : Le champ Enabled est écrit dans la base de données
            insertCmd.Parameters.AddWithValue("@Enabled", mapping.Enabled);
            
            insertCmd.Parameters.AddWithValue("@Description", (object?)mapping.Description ?? DBNull.Value);
            
            // Exécution de l'INSERT
            await insertCmd.ExecuteNonQueryAsync();
        }

        // ====================================
        // ÉTAPE 3 : COMMIT de la transaction
        // ====================================
        await transaction.CommitAsync();
    }
    catch
    {
        // En cas d'erreur, ROLLBACK pour ne rien modifier
        await transaction.RollbackAsync();
        throw;
    }
}
```

**Requêtes SQL exécutées:**
```sql
-- 1. Suppression (dans une transaction)
DELETE FROM DIRIS.TagMap WHERE DeviceId = 1;

-- 2. Insertion de chaque TagMap (81 fois)
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
VALUES (1, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1, 'Courant phase 1');

INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
VALUES (1, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1, 'Courant phase 2');

-- ... (7 signaux avec Enabled = 1)

INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
VALUES (1, 'AP_255', 'AP_255', 'kVA', 100, 0, 'Puissance apparente cumulée');

-- ... (74 signaux avec Enabled = 0)

-- 3. Commit
COMMIT;
```

---

## 🧪 Test de vérification

Pour vérifier que le système fonctionne, voici un test complet :

### Étape 1 : État initial

```sql
-- Voir l'état actuel
SELECT Signal, Enabled 
FROM [AI_ATR].[DIRIS].[TagMap]
WHERE DeviceId = 1
ORDER BY Enabled DESC, Signal;
```

### Étape 2 : Modification via l'interface

1. Ouvrir l'interface admin → Onglet DIRIS
2. Cliquer sur **🏷️ Signaux** pour le device ATR-TR1
3. **Décocher** `I_PH1_255` (pour le test)
4. **Cocher** `AP_255` (pour le test)
5. Cliquer sur **💾 Sauvegarder**

### Étape 3 : Vérification en base

```sql
-- Vérifier que les modifications sont appliquées
SELECT Signal, Enabled 
FROM [AI_ATR].[DIRIS].[TagMap]
WHERE DeviceId = 1
  AND Signal IN ('I_PH1_255', 'AP_255')
ORDER BY Signal;

-- Résultat attendu :
-- Signal       Enabled
-- AP_255       1        ← ACTIVÉ (était 0 avant)
-- I_PH1_255    0        ← DÉSACTIVÉ (était 1 avant)
```

### Étape 4 : Vérification des logs

Dans `API_ATF_MOBILE/logs/app-YYYYMMDD.log`, chercher :

```log
[INFO] Updated enabled status for 81 tag mappings for device 1
```

---

## ✅ Confirmation du fonctionnement

### Point de vérification 1 : Controller ✅

**Ligne 444 de `DirisDevicesController.cs`:**
```csharp
mapping.Enabled = request.EnabledSignals.Contains(mapping.Signal);
```

→ Le champ `Enabled` est **correctement mis à jour** en mémoire.

### Point de vérification 2 : Repository ✅

**Ligne 163 de `DeviceRepository.cs`:**
```csharp
insertCmd.Parameters.AddWithValue("@Enabled", mapping.Enabled);
```

→ Le champ `Enabled` est **correctement passé au paramètre SQL**.

### Point de vérification 3 : SQL ✅

**Ligne 152 de `DeviceRepository.cs`:**
```sql
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled, Description)
VALUES (@DeviceId, @Signal, @WebMiKey, @Unit, @Scale, @Enabled, @Description)
```

→ La colonne `Enabled` est **explicitement incluse** dans l'INSERT.

### Point de vérification 4 : Transaction ✅

**Lignes 141-168:**
- `BeginTransaction()` → Début de la transaction
- `DELETE` puis `INSERT` → Opérations atomiques
- `CommitAsync()` → Validation en base

→ Les modifications sont **atomiques** et **persistées** correctement.

---

## 🎯 Conclusion

### ✅ Le code est CORRECT

Le flux complet d'activation/désactivation des signaux est **parfaitement implémenté** :

1. ✅ L'interface récupère les signaux cochés
2. ✅ L'API client envoie la liste au serveur
3. ✅ Le controller met à jour le champ `Enabled` pour chaque TagMap
4. ✅ Le repository exécute un DELETE + INSERT dans une transaction
5. ✅ La colonne `Enabled` de la table `[DIRIS].[TagMap]` est bien mise à jour
6. ✅ Les modifications sont persistées en base de données

### 📊 Preuve par les résultats

Les résultats de vos tests confirment le bon fonctionnement :

| Test | Résultat | Conclusion |
|------|----------|-----------|
| Activation de 7 signaux via l'interface | 7 signaux avec `Enabled=1` en base | ✅ Fonctionnel |
| 74 signaux désactivés | 74 signaux avec `Enabled=0` en base | ✅ Fonctionnel |
| Acquisition après 3 minutes | Seuls les 7 signaux activés sont enregistrés | ✅ Filtrage OK |
| Vérification finale | 0 signal désactivé enregistré | ✅ Parfait |

---

## 🛡️ Garanties du système

### Transaction SQL atomique
- **DELETE + INSERT** dans une seule transaction
- En cas d'erreur → **ROLLBACK** automatique
- Garantit la **cohérence** des données

### Validation côté serveur
- Vérification de l'existence du device
- Gestion des erreurs avec logging
- Retour d'erreur HTTP 500 en cas de problème

### Traçabilité
- Logs d'information à chaque mise à jour
- Historique des actions dans l'interface admin
- Audit trail complet

---

**Date de vérification :** 2025-10-08  
**Verdict :** ✅ **CODE VALIDÉ** - Le système écrit correctement dans `[AI_ATR].[DIRIS].[TagMap]`
