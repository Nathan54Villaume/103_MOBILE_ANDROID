# Guide d'utilisation - Event Viewer

## 📋 Vue d'ensemble

Le nouveau système Event Viewer transforme la fenêtre de logs en un visualiseur avancé inspiré de l'Event Viewer Windows, offrant des fonctionnalités de filtrage, d'export, et de suivi en temps réel.

## 🎯 Fonctionnalités principales

### 1. Modes Play/Stop

#### Mode Stop (par défaut au chargement)
- ✅ Affiche les **200 derniers événements**
- ✅ Tri décroissant (plus récent en haut)
- ✅ Navigation et filtrage libres
- ✅ Aucune mise à jour automatique

**Utilisation:** Cliquez sur **⏸️ Stop** pour geler l'affichage et analyser les logs.

#### Mode Play (flux live)
- ✅ Nouveaux logs ajoutés automatiquement (polling toutes les 2 secondes)
- ✅ Tail mode: append en bas
- ✅ Scroll automatique si en bas de page
- ✅ Facettes mises à jour en temps réel

**Utilisation:** Cliquez sur **▶️ Play** pour démarrer le flux live.

---

### 2. Affichage type journal Windows

#### Structure des colonnes

| Colonne | Description |
|---------|-------------|
| 🟢🟡🔴 | Icône de sévérité (Info/Warn/Error) |
| Time | Timestamp au format `hh:mm:ss.SSS` |
| Source | Origine du log (API, System, PLC, DB, Worker) |
| HTTP | Méthode → Status (ex: `GET → 200`) |
| Message | Message principal du log |
| Duration | Durée en millisecondes |

#### Détails extensibles
- **Cliquez sur une ligne** pour afficher les détails complets
- Contenu des détails :
  - Exception (si présente)
  - Détails HTTP (méthode, URL, status, durée)
  - Payload de la requête (sanitized)
  - Payload de la réponse (sanitized)
  - Headers (Authorization masqué)

**Bouton 📋 Copier JSON** : Copie tous les détails au format JSON dans le presse-papier.

---

### 3. Filtres dynamiques

#### Recherche plein texte
- **Champ de recherche** : Filtre sur le message + détails
- **Option Regex** : Active la recherche par expression régulière
- **Debounce** : 300ms de délai pour optimiser les performances

#### Filtres par facettes (futurs)
Les facettes suivantes sont calculées automatiquement :
- **Severity** : Info, Warn, Error
- **Source** : API, System, PLC, DB, Worker
- **Method** : GET, POST, PUT, DELETE, etc.
- **Status** : 2xx, 3xx, 4xx, 5xx
- **Endpoint** : Liste des endpoints appelés
- **HasError** : Avec/sans erreur

**Réinitialiser les filtres** : Bouton 🔄 pour effacer tous les filtres actifs.

---

### 4. Export des logs

#### CSV
- **Bouton 📊 CSV** : Exporte les logs **filtrés** au format CSV
- Colonnes : Timestamp, Severity, Source, Message, Method, URL, Status, Duration, Exception

#### JSON
- **Bouton 📄 JSON** : Exporte les logs **filtrés** au format JSON
- Structure complète avec tous les détails

**Note** : Seuls les logs **actuellement affichés** (après filtres) sont exportés.

---

### 5. Compteurs en temps réel

Le compteur `N affichés / M buffer` indique :
- **N** : Nombre de logs affichés après filtres
- **M** : Nombre total de logs dans le buffer mémoire

---

### 6. Performance et ring buffer

#### Buffer mémoire
- **Taille par défaut** : 10 000 entrées
- **Minimum** : 5 000 entrées
- **Maximum recommandé** : 50 000 entrées

#### Configuration du buffer
```javascript
// Via l'API backend
POST /api/admin/logs/buffer-size
Body: { "size": 15000 }

// Via le frontend (futur)
logService.setBufferSize(15000);
```

#### Virtualisation
- Affichage optimisé des **500 premiers logs** visibles
- Scroll fluide même avec 10 000+ entrées
- Performance cible : < 16ms/frame

---

## 🛠️ Comment publier un log

### Backend (C#)

#### Méthode simple (compatibilité)
```csharp
// Signature originale maintenue
_logReader.AddLog("Information", "Mon message");
_logReader.AddLog("Error", "Erreur", "Stack trace");
```

#### Méthode enrichie (Event Viewer)
```csharp
// Avec détails HTTP et source
var httpDetails = new HttpLogDetails
{
    Method = "POST",
    Url = "/api/data",
    StatusCode = 201,
    DurationMs = 45,
    RequestSize = 1024,
    ResponseSize = 512
};

_logReader.AddLog(
    level: "Information",
    message: "Données créées",
    exception: null,
    httpDetails: httpDetails,
    source: "API"
);
```

#### Sources disponibles
- `API` : Requêtes HTTP
- `System` : Système/démarrage
- `PLC` : Automates Siemens
- `DB` : Bases de données
- `Worker` : Tâches de fond

### Frontend (JavaScript)

#### Via api-client.js
Les requêtes HTTP sont automatiquement loguées avec détails enrichis :
```javascript
// Appel standard, logging automatique
const data = await apiClient.getDashboard();

// L'interceptor capture :
// - Method, URL, Status, Duration
// - Request body (sanitized)
// - Response body (sanitized)
// - Headers (Authorization masqué)
```

#### Log manuel
```javascript
import logService from './log-service.js';

// Ajouter un log côté client
logService.addClientLog({
    severity: 'warn',
    source: 'UI',
    message: 'Validation échouée',
    details: { field: 'email', error: 'Format invalide' }
});
```

---

## 🔒 Sécurité - Sanitization

### Secrets automatiquement masqués

Le système masque automatiquement les données sensibles :

#### Backend (regex)
- `token` → `****`
- `password` → `****`
- `bearer [...]` → `bearer ****`
- `api-key` → `****`
- `secret` → `****`
- `authorization` → `****`

#### Frontend (keys)
- `password` → `****`
- `token` → `****`
- `authorization` → `Bearer ****`
- `apiKey` → `****`
- `secret` → `****`

**Exemple** :
```json
// Avant sanitization
{
  "username": "admin",
  "password": "SuperSecret123",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Après sanitization
{
  "username": "admin",
  "password": "****",
  "token": "****"
}
```

---

## 📊 Tests et validation

### Critères d'acceptation

#### ✅ Chargement initial
- [x] Bouton Stop actif par défaut
- [x] 200 derniers logs affichés
- [x] Filtres vides
- [x] Compteur `200 / 200` (si buffer plein)

#### ✅ Mode Play
- [x] Nouveaux logs s'ajoutent automatiquement
- [x] Facettes se régénèrent
- [x] UI reste fluide (pas de freeze)
- [x] Scroll maintenu si l'utilisateur a scrollé

#### ✅ Mode Stop
- [x] Plus d'append automatique
- [x] Navigation/filtres utilisables
- [x] État figé

#### ✅ Filtres
- [x] Recherche plein texte fonctionnelle
- [x] Regex optionnelle
- [x] Compteur mis à jour `N / M`
- [x] Export respecte les filtres

#### ✅ Export
- [x] CSV conforme aux filtres actifs
- [x] JSON conforme aux filtres actifs
- [x] Téléchargement automatique

#### ✅ Performance
- [x] 10 000 événements : scroll fluide
- [x] Pas de freeze perceptible
- [x] Ring buffer fonctionnel

#### ✅ Sanitization
- [x] Secrets masqués dans details
- [x] Authorization masquée dans headers

---

## 🧪 Tests manuels

### Test 1 : Chargement initial
1. Ouvrir l'interface admin
2. Naviguer vers l'onglet **Logs**
3. **Vérifier** :
   - Bouton Stop actif (grisé)
   - Bouton Play actif
   - 200 logs affichés maximum
   - Compteur `N / M`

### Test 2 : Mode Play
1. Cliquer sur **▶️ Play**
2. Générer quelques requêtes API (naviguer dans l'interface)
3. **Vérifier** :
   - Nouveaux logs apparaissent automatiquement (toutes les 2s)
   - Compteur se met à jour
   - Bouton Stop maintenant actif

### Test 3 : Filtres
1. Entrer "error" dans la recherche
2. **Vérifier** :
   - Seuls les logs contenant "error" s'affichent
   - Compteur `N / M` indique le filtrage
3. Activer **Regex** et entrer `GET.*200`
4. **Vérifier** :
   - Seuls les logs matchant le regex s'affichent

### Test 4 : Détails extensibles
1. Cliquer sur une ligne de log
2. **Vérifier** :
   - Détails s'affichent sous la ligne
   - Exception visible (si présente)
   - HTTP details visibles
   - Payloads req/resp visibles
3. Cliquer sur **📋 Copier JSON**
4. **Vérifier** :
   - JSON copié dans le presse-papier
   - Secrets masqués

### Test 5 : Export
1. Appliquer un filtre (ex: severity=error)
2. Cliquer sur **📊 CSV**
3. **Vérifier** :
   - Fichier `logs_YYYYMMDD_HHMMSS.csv` téléchargé
   - Contient uniquement les logs filtrés
4. Cliquer sur **📄 JSON**
5. **Vérifier** :
   - Fichier `logs_YYYYMMDD_HHMMSS.json` téléchargé
   - Structure JSON complète

### Test 6 : Performance (optionnel)
1. Configurer le buffer à 10 000 :
   ```bash
   POST /api/admin/logs/buffer-size
   Body: { "size": 10000 }
   ```
2. Générer ~10 000 logs (via script)
3. **Vérifier** :
   - Scroll fluide
   - Pas de freeze
   - Filtres réactifs

---

## 🚀 Intégration

### Fichiers modifiés (extensions)

#### Backend
- ✅ `Services/LogReaderService.cs` : Ring buffer, événements, sanitization
- ✅ `Middleware/RequestLoggingMiddleware.cs` : Capture HTTP enrichie
- ✅ `Controllers/ServerAdminController.cs` : Endpoints export CSV/JSON

#### Frontend
- ✅ `wwwroot/admin/js/log-service.js` : Service centralisé (nouveau)
- ✅ `wwwroot/admin/js/logs-viewer.js` : Interface Event Viewer
- ✅ `wwwroot/admin/js/api-client.js` : Interceptor enrichi
- ✅ `wwwroot/admin/index.html` : UI Event Viewer

### Compatibilité

**Aucune rupture de compatibilité** :
- Les anciennes signatures (`AddLog(level, message, exception)`) fonctionnent toujours
- Les imports existants (`import { updateLogs } from './logs-viewer.js'`) maintenus
- Pas de renommage de composants publics

---

## 📞 Support

### FAQ

**Q: Comment augmenter la taille du buffer ?**  
A: Via API `POST /api/admin/logs/buffer-size` avec `{ "size": 15000 }`

**Q: Les logs sont-ils persistés ?**  
A: Non, le ring buffer est en mémoire (RAMonly). Redémarrage = perte des logs.

**Q: Puis-je voir les requêtes vers d'autres services ?**  
A: Oui, tous les appels HTTP via `api-client.js` sont loggués automatiquement.

**Q: Comment masquer plus de secrets ?**  
A: Modifier les regex dans `LogReaderService.cs` (backend) ou `sanitizeData()` dans `api-client.js` (frontend).

**Q: La virtualisation supporte combien de logs ?**  
A: Actuellement 500 visibles, fluide jusqu'à 10 000+ dans le buffer.

---

## 📝 Changelog

### Version 1.0 (2025-10-02)
- ✨ Ajout mode Play/Stop
- ✨ Affichage Event Viewer (colonnes, icônes)
- ✨ Détails extensibles avec bouton Copier
- ✨ Filtres dynamiques (recherche, regex)
- ✨ Export CSV/JSON
- ✨ Ring buffer configurable (5k-50k)
- ✨ Sanitization automatique des secrets
- ✨ Capture HTTP enrichie (payload, headers, sizes)
- ✨ Virtualisation basique (500 visibles)

---

## 🎓 Ressources

- **Code source** : `API_ATF_MOBILE/API_ATF_MOBILE/`
- **Tests** : `tests/LogService.test.js`
- **API Docs** : `/swagger` (si activé)

---

**Auteur** : Agent Développeur  
**Date** : 2 octobre 2025  
**Version** : 1.0

