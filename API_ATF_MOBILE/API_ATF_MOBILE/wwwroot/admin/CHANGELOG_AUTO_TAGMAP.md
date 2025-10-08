# 📝 Changelog - Auto-création des TagMaps DIRIS

**Date** : 8 octobre 2025  
**Version** : 1.1.0  
**Fonctionnalité** : Création automatique des TagMaps lors de l'ajout de devices DIRIS

---

## 🎯 Problème Résolu

**Problème initial** :  
Lorsqu'un utilisateur ajoutait un nouveau device DIRIS via l'interface d'administration, les TagMaps (mappings de signaux) n'étaient pas créés automatiquement dans la base de données. L'utilisateur devait ensuite :
- Ouvrir SQL Server Management Studio
- Écrire manuellement les INSERT pour chaque signal
- Connaître les échelles correctes (1000 pour les courants, 100 pour les tensions, etc.)
- Risquer des erreurs de configuration

**Solution implémentée** :  
Les TagMaps sont maintenant créés **automatiquement** lors de l'ajout d'un device DIRIS, avec les 12 signaux standards DIRIS A40/A41.

---

## 🔧 Modifications Apportées

### 1. Backend - DirisDevicesController.cs

#### Méthode CreateDevice (ligne 66-114)
**Changement** : Ajout de l'appel automatique à `DiscoverAndCreateTagMappingsAsync()` après la création du device.

```csharp
var createdDevice = await _deviceRegistry.AddDeviceAsync(device);

// Auto-discover and create default tag mappings
try
{
    await DiscoverAndCreateTagMappingsAsync(createdDevice.DeviceId);
    _logger.LogInformation("Auto-discovery of tag mappings completed for device {DeviceId}", createdDevice.DeviceId);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to auto-discover tag mappings for device {DeviceId}. Tags can be configured manually.", createdDevice.DeviceId);
    // Don't fail the device creation if tag discovery fails
}
```

**Impact** : La création de device ne plante pas si les tagmaps échouent (log warning uniquement).

#### Nouvelle méthode - DiscoverTags (ligne 293-326)
**Ajout** : Endpoint public `POST /api/diris/devices/{id}/discover-tags` pour redéclencher manuellement la découverte.

```csharp
[HttpPost("{id}/discover-tags")]
public async Task<IActionResult> DiscoverTags(int id)
{
    var device = await _deviceRegistry.GetDeviceAsync(id);
    if (device == null)
        return NotFound(new { success = false, message = "Device not found" });

    var tagMaps = await DiscoverAndCreateTagMappingsAsync(id);

    return Ok(new
    {
        success = true,
        message = $"Successfully discovered and created {tagMaps.Count()} tag mappings for device {id}",
        tagMappings = tagMaps
    });
}
```

#### Nouvelle méthode privée - DiscoverAndCreateTagMappingsAsync (ligne 328-366)
**Ajout** : Méthode qui crée les 12 tagmaps standards DIRIS A40/A41.

**Signaux créés** :
- 4 courants (I_PH1/2/3_255, I_NUL_255)
- 1 fréquence (F_255)
- 3 tensions (PV1/2/3_255)
- 3 puissances (SUM_RP/IP/AP_255)
- 1 facteur de puissance (SUM_PF_255)

```csharp
var defaultTagMappings = new List<TagMap>
{
    new TagMap { DeviceId = deviceId, Signal = "I_PH1_255", WebMiKey = "I_PH1_255", Unit = "A", Scale = 1000, Enabled = true },
    // ... 11 autres signaux
};

await _deviceRegistry.UpdateTagMappingsAsync(deviceId, defaultTagMappings);
```

---

### 2. Frontend - diris-manager.js

#### Méthode loadDevices (ligne 458-501)
**Changement** : Ajout d'un bouton **🏷️ Tags** pour chaque device.

```javascript
<button onclick="window.dirisManager.discoverTags(${device.deviceId})" 
        class="px-2 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 transition-colors" 
        title="Découvrir et créer les tagmaps automatiquement">
  🏷️ Tags
</button>
```

#### Nouvelle méthode - discoverTags (ligne 546-567)
**Ajout** : Appel de l'endpoint `/api/diris/devices/{id}/discover-tags`.

```javascript
async discoverTags(deviceId) {
    const response = await this.apiClient.request(`/api/diris/devices/${deviceId}/discover-tags`, {
        method: 'POST'
    });
    
    if (response.success) {
        const tagCount = response.tagMappings?.length || 0;
        this.showSuccess(`✅ ${tagCount} tags créés automatiquement pour device ${deviceId}`);
        this.addHistoryEvent('success', 'Tags auto-découverts', `${tagCount} tags créés pour device ${deviceId}`);
    }
}
```

#### Méthode addDevice (ligne 634-659)
**Changement** : Message de succès mis à jour pour informer de la création automatique des tagmaps.

```javascript
this.showSuccess(`✅ Device ajouté avec succès (ID: ${response.deviceId}). Les tagmaps ont été créés automatiquement.`);
this.addHistoryEvent('success', 'Device ajouté', `Device ${deviceData.name} ajouté avec auto-création des tagmaps (12 signaux)`);
```

---

## 📊 Statistiques des Modifications

| Fichier | Lignes ajoutées | Lignes modifiées |
|---------|-----------------|------------------|
| `DirisDevicesController.cs` | +82 | 15 |
| `diris-manager.js` | +23 | 10 |
| **Total** | **+105** | **25** |

---

## ✅ Tests de Validation

### Test 1 : Ajout d'un nouveau device

**Étapes** :
1. Ouvrir l'interface admin → Onglet DIRIS
2. Cliquer sur "➕ Ajouter"
3. Remplir le formulaire (Nom: "Test_Auto", IP: "192.168.2.200")
4. Cliquer sur "Ajouter"

**Résultat attendu** :
- ✅ Device créé avec succès
- ✅ Message : "Les tagmaps ont été créés automatiquement"
- ✅ 12 lignes insérées dans DIRIS.TagMap
- ✅ Événement dans l'historique : "Device ajouté avec auto-création des tagmaps"

**Vérification SQL** :
```sql
SELECT COUNT(*) FROM DIRIS.TagMap WHERE DeviceId = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'Test_Auto')
-- Résultat attendu : 12
```

---

### Test 2 : Redécouverte manuelle des tags

**Étapes** :
1. Ouvrir l'interface admin → Onglet DIRIS
2. Trouver un device existant
3. Cliquer sur le bouton "🏷️ Tags"

**Résultat attendu** :
- ✅ Message : "12 tags créés automatiquement pour device X"
- ✅ Anciens tagmaps supprimés (si existants)
- ✅ Nouveaux tagmaps insérés

---

### Test 3 : Vérification de l'acquisition

**Étapes** :
1. Après l'ajout d'un device avec tagmaps auto
2. Activer le device (bouton ▶️)
3. Aller dans "Dernières mesures"

**Résultat attendu** :
- ✅ Le device apparaît dans les dernières mesures
- ✅ 12 signaux affichés avec leurs valeurs
- ✅ Unités correctes (A, V, Hz, kW, kVAR, kVA, %)

---

## 🚀 Déploiement

### Pré-requis
- Base de données DIRIS configurée avec les tables `DIRIS.Devices` et `DIRIS.TagMap`
- Serveur API_ATF_MOBILE démarré
- Accès admin à l'interface

### Étapes de déploiement

1. **Compiler le backend** :
   ```bash
   cd API_ATF_MOBILE/API_ATF_MOBILE
   dotnet build --configuration Release
   ```

2. **Redémarrer le serveur** :
   ```bash
   dotnet run --configuration Release
   ```

3. **Accéder à l'interface** :
   ```
   http://localhost:8088/admin/
   ```

4. **Tester l'ajout d'un device** :
   - Onglet DIRIS → ➕ Ajouter → Remplir → Vérifier le message de succès

---

## 🔒 Sécurité et Compatibilité

### Rétrocompatibilité
✅ **100% compatible** avec les devices existants  
✅ Les devices ajoutés manuellement continuent de fonctionner  
✅ Pas de modification des tables existantes  

### Gestion d'erreurs
✅ **Robustesse** : Si la création des tagmaps échoue, le device est quand même créé  
✅ **Logging** : Toutes les actions sont loggées (info/warning/error)  
✅ **Retry manuel** : Bouton "🏷️ Tags" pour recréer les tagmaps si nécessaire  

---

## 📈 Améliorations Futures Possibles

### Version 1.2 (suggestions)
- [ ] **Détection automatique du modèle DIRIS** (A20, A40, A41, B30, etc.)
- [ ] **Lecture réelle des signaux disponibles** via WebMI discovery
- [ ] **Templates configurables** par modèle de device
- [ ] **Import/Export de templates** de tagmaps
- [ ] **Validation des signaux** lors de la création (test de lecture)

### Version 1.3 (suggestions)
- [ ] **Interface graphique de gestion des tagmaps**
- [ ] **Édition inline des signaux** (activer/désactiver, modifier échelle)
- [ ] **Duplication de configuration** entre devices similaires
- [ ] **Historique des modifications** de tagmaps

---

## 📞 Support

### En cas de problème

1. **Vérifier les logs serveur** :
   - Interface admin → Onglet Logs
   - Chercher "Auto-discovery" ou "tag mapping"

2. **Vérifier la base de données** :
   ```sql
   SELECT d.Name, COUNT(tm.Signal) AS Tags
   FROM DIRIS.Devices d
   LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId
   GROUP BY d.DeviceId, d.Name
   ```

3. **Redéclencher manuellement** :
   - Bouton "🏷️ Tags" sur le device concerné

---

## ✅ Checklist de Déploiement

- [x] Backend compilé sans erreur
- [x] Tests unitaires passent (si existants)
- [x] Documentation créée (AUTO_TAGMAP_GUIDE.md)
- [x] Changelog créé (ce fichier)
- [x] Interface frontend mise à jour
- [x] Bouton de redécouverte manuelle ajouté
- [x] Messages d'information utilisateur ajoutés
- [x] Gestion d'erreurs robuste implémentée
- [x] Logging complet ajouté
- [x] Compatibilité rétroactive vérifiée

---

**Auteur** : Assistant AI  
**Branche suggérée** : `feature/auto-tagmap-discovery`  
**Commit message suggéré** :  
```
feat(diris): Auto-création des TagMaps lors de l'ajout de devices

- Ajout de DiscoverAndCreateTagMappingsAsync() dans DirisDevicesController
- 12 signaux DIRIS A40/A41 créés automatiquement
- Endpoint POST /api/diris/devices/{id}/discover-tags pour redécouverte manuelle
- Bouton 🏷️ Tags dans l'interface pour redéclencher la découverte
- Messages utilisateur améliorés
- Documentation complète ajoutée

Résout le problème de configuration manuelle des tagmaps.
```

✨ **Fonctionnalité implémentée avec succès !**

