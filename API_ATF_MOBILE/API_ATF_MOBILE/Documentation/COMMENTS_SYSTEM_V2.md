# 💬 Système de Commentaires V2 - Documentation Technique

## Vue d'ensemble

Le système de commentaires V2 permet aux utilisateurs d'ajouter, visualiser et gérer des commentaires multi-utilisateurs pour chaque projet du dashboard. Il remplace l'ancien système mono-commentaire par un système complet avec pagination, rate-limiting et persistance robuste en fichier JSONL.

---

## 🎯 Caractéristiques principales

### ✅ Fonctionnalités
- **Multi-commentaires** : plusieurs commentaires par entité (vs un seul avant)
- **Pagination cursor-based** : chargement progressif des commentaires anciens
- **Optimistic UI** : ajout instantané avec rollback en cas d'erreur
- **Rate-limiting** : protection contre le spam (10 requêtes/5min par IP)
- **Stockage JSONL** : format robuste pour append atomique
- **Archivage automatique** : rotation des fichiers volumineux (>5 Mo)
- **Validation stricte** : sanitization anti-XSS côté serveur et client
- **Dates internationalisées** : affichage Europe/Paris, stockage UTC

### 🔐 Sécurité
- **Anti-XSS** : suppression des tags HTML à l'entrée et escape à l'affichage
- **Rate limiting** : limitation par IP (10 req/5min)
- **Validation stricte** :
  - `authorName` : 2-80 caractères, accents autorisés
  - `message` : 1-2000 caractères, trimmed
- **File locking** : verrous exclusifs pour éviter les corruptions

---

## 📁 Architecture & Stockage

### Emplacement des fichiers
```
%AppData%\API_ATF_MOBILE\comments\
├── comments-suivi-produit-ats.jsonl
├── comments-gestion-rfid-ats.jsonl
├── comments-supervision-poste-electrique.jsonl
└── comments-*-20250103_143022.jsonl.gz  (archives)
```

**Note importante** : Les commentaires sont stockés dans le même dossier parent que les connexions PLC (`%AppData%\API_ATF_MOBILE\`), conformément aux contraintes du cahier des charges.

### Format JSONL (Newline-Delimited JSON)
Un commentaire par ligne, format JSON :
```json
{"id":"a1b2c3d4-...","entityId":"suivi-produit-ats","authorName":"Nathan Villaume","authorId":null,"message":"Excellent travail sur la traçabilité !","createdAt":"2025-01-03T14:30:22.123Z"}
{"id":"e5f6g7h8-...","entityId":"suivi-produit-ats","authorName":"Marie Dupont","authorId":"admin","message":"À améliorer : ajouter une notification email","createdAt":"2025-01-03T15:45:10.456Z"}
```

**Avantages du JSONL** :
- ✅ Append atomique (pas besoin de recharger/réécrire tout le fichier)
- ✅ Robuste aux corruptions (lignes malformées ignorées)
- ✅ Facile à lire depuis la fin (pagination efficace)
- ✅ Compatible avec `tail` et outils Unix

---

## 🔧 Implémentation Technique

### 1. Backend (C# / ASP.NET Core)

#### Modèles (`Models/Comment.cs`)
```csharp
public class Comment {
    public string Id { get; set; }              // UUID v4
    public string EntityId { get; set; }        // ID du projet
    public string AuthorName { get; set; }      // Nom (2-80 chars)
    public string? AuthorId { get; set; }       // ID utilisateur (optionnel)
    public string Message { get; set; }         // Message (1-2000 chars)
    public DateTime CreatedAt { get; set; }     // UTC, ISO-8601
}

public class CommentCreateDto {
    public string EntityId { get; set; }
    public string AuthorName { get; set; }
    public string Message { get; set; }
}

public class CommentsPaginatedResponse {
    public List<Comment> Items { get; set; }
    public string? NextCursor { get; set; }     // ISO-8601 date
    public int Total { get; set; }
}
```

#### Service (`Services/CommentsServiceV2.cs`)

**Méthodes principales** :
- `GetCommentsAsync(entityId, limit, cursor)` : récupération paginée
- `AddCommentAsync(dto, userId)` : ajout avec validation
- `GetCommentCountAsync(entityId)` : comptage
- `ArchiveOldCommentsAsync()` : rotation des fichiers

**File Locking** :
```csharp
private readonly ConcurrentDictionary<string, SemaphoreSlim> _fileLocks = new();

private async Task AppendCommentToFileAsync(Comment comment) {
    var lockObj = GetFileLock(filePath);
    await lockObj.WaitAsync();
    try {
        using var fileStream = new FileStream(filePath, FileMode.Append, 
                                             FileAccess.Write, FileShare.None);
        using var writer = new StreamWriter(fileStream, Encoding.UTF8);
        await writer.WriteLineAsync(json);
        await writer.FlushAsync();  // Flush immédiat pour atomicité
    }
    finally {
        lockObj.Release();
    }
}
```

**Gestion des corruptions** :
```csharp
foreach (var line in lines) {
    try {
        var comment = JsonSerializer.Deserialize<Comment>(line);
        if (comment != null) comments.Add(comment);
    }
    catch (JsonException ex) {
        _logger.LogWarning(ex, "⚠️ Ligne JSONL malformée ignorée");
        // Continue sans interruption
    }
}
```

#### Contrôleur (`Controllers/CommentsV2Controller.cs`)

**Endpoints disponibles** :
```
GET  /api/comments?entityId=xxx&limit=50&cursor=xxx  → Liste paginée
POST /api/comments                                   → Création
GET  /api/comments/count?entityId=xxx                → Comptage
POST /api/comments/archive                           → Archivage (admin)
```

**Exemple de requête GET** :
```http
GET /api/comments?entityId=suivi-produit-ats&limit=50
```

**Réponse** :
```json
{
  "items": [
    {
      "id": "uuid...",
      "entityId": "suivi-produit-ats",
      "authorName": "Nathan Villaume",
      "authorId": null,
      "message": "Très bon projet !",
      "createdAt": "2025-01-03T14:30:22.123Z"
    }
  ],
  "nextCursor": "2025-01-03T12:00:00.000Z",
  "total": 12
}
```

**Exemple de requête POST** :
```http
POST /api/comments
Content-Type: application/json

{
  "entityId": "suivi-produit-ats",
  "authorName": "Nathan Villaume",
  "message": "Excellent travail sur la traçabilité !"
}
```

**Rate Limiting** :
- **Limite** : 10 requêtes POST par 5 minutes par IP
- **Réponse si dépassé** : HTTP 429 (Too Many Requests)
```json
{
  "error": "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
  "retryAfter": 300
}
```

---

### 2. Frontend (JavaScript)

#### Composant (`wwwroot/assets/js/comments-component.js`)

**Classe principale** : `CommentsComponent`

**Initialisation** :
```javascript
const commentsComponent = new CommentsComponent('commentsContainer', {
    apiBaseUrl: '/api/comments',
    currentUser: window.__SESSION_USER || null,
    limit: 50
});
```

**Méthodes principales** :
- `setEntity(entityId)` : charger les commentaires d'une entité
- `loadComments(append)` : chargement avec pagination
- `addComment(name, message)` : ajout optimiste avec rollback
- `formatDate(isoDate)` : formatage Europe/Paris

**Optimistic UI** :
```javascript
// 1. Ajouter immédiatement (optimistic)
const tempComment = { id: 'temp-' + Date.now(), ..., _isOptimistic: true };
this.comments.unshift(tempComment);
this.renderCommentsList();

// 2. Envoyer au serveur
const response = await fetch('/api/comments', { method: 'POST', ... });

if (response.ok) {
    // Remplacer le commentaire temporaire par le réel
    const newComment = await response.json();
    this.comments[index] = newComment;
} else {
    // Rollback : supprimer le commentaire temporaire
    this.comments = this.comments.filter(c => c.id !== tempComment.id);
    this.showToast('Erreur lors de l\'ajout', 'error');
}
```

**Auto-grow textarea** :
```javascript
messageInput.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    
    // Compteur de caractères
    charCount.textContent = e.target.value.length;
});
```

**Formatage des dates** :
```javascript
formatDate(isoDate) {
    const date = new Date(isoDate);
    const formatter = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return formatter.format(date);  // "03/01/2025 14:30:22"
}
```

---

## 🎨 UI/UX

### Structure visuelle
```
┌─────────────────────────────────────────┐
│ 💬 Commentaires              [➕ Ajouter] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │ (Formulaire collapsé)
│ │ Nom: [____________]                 │ │
│ │ Message: [___________________]      │ │
│ │ 0 / 2000 caractères                 │ │
│ │ [💾 Envoyer]  [Annuler]             │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─ NV  Nathan Villaume                 │
│ │     03/01/2025 14:30:22               │
│ │     Excellent travail sur la          │
│ │     traçabilité !                     │
│ └───────────────────────────────────── │
│                                          │
│ ┌─ MD  Marie Dupont                    │
│ │     03/01/2025 12:15:00               │
│ │     À améliorer : ajouter une         │
│ │     notification email.               │
│ └───────────────────────────────────── │
│                                          │
│          [📄 Voir plus]                  │
└─────────────────────────────────────────┘
```

### Interactions
- **Clic sur "Ajouter"** : déploie le formulaire avec animation (250ms)
- **Focus auto** : textarea focus automatique à l'ouverture
- **Ctrl+Enter** : raccourci pour envoyer
- **"Voir plus"** : charge les 50 commentaires suivants (cursor-based)
- **Toast notifications** : confirmation/erreur (3s, fade-out)

### Accessibilité
- ✅ Focus management (piège focus dans le formulaire)
- ✅ Labels explicites
- ✅ Tooltips sur les dates (horodatage ISO complet)
- ✅ Boutons désactivés si formulaire vide
- ✅ Messages d'erreur clairs

---

## 🔄 Archivage & Rotation

### Déclenchement automatique
Quand un fichier dépasse **5 Mo**, il est automatiquement archivé :

1. **Compression** : création d'une archive `.jsonl.gz`
   ```
   comments-suivi-produit-ats-20250103_143022.jsonl.gz
   ```

2. **Conservation** : les 100 derniers commentaires sont gardés dans le fichier actif

3. **Backup temporaire** : un `.bak` est créé pendant l'opération, puis supprimé

### Archivage manuel
```http
POST /api/comments/archive
```
(Réservé aux administrateurs)

---

## 📊 Stratégie de pagination

### Cursor-based pagination (recommandé)
Utilise la date de création comme curseur :

**Requête initiale** :
```
GET /api/comments?entityId=xxx&limit=50
```

**Réponse** :
```json
{
  "items": [...],
  "nextCursor": "2025-01-01T10:00:00.000Z",
  "total": 150
}
```

**Requête suivante** :
```
GET /api/comments?entityId=xxx&limit=50&cursor=2025-01-01T10:00:00.000Z
```

**Avantages** :
- ✅ Performance constante (pas de OFFSET coûteux)
- ✅ Résultats cohérents même si nouveaux commentaires ajoutés
- ✅ Pas de doublons ou omissions

---

## 🧪 Tests & Robustesse

### Tests unitaires recommandés
1. **Validation** : rejet de noms/messages invalides
2. **Sanitization** : suppression de tags HTML `<script>`, `<img>`, etc.
3. **Formatage dates** : UTC → Europe/Paris correct
4. **Escape HTML** : affichage sécurisé de `<`, `>`, `&`

### Tests d'intégration
1. **POST réussi** : commentaire ajouté et retourné avec ID
2. **Rate limit** : 11e requête en 5min retourne HTTP 429
3. **Optimistic UI** : rollback correct en cas d'erreur réseau
4. **Pagination** : curseur fonctionne sur 100+ commentaires

### Tests de robustesse fichier
1. **Append concurrent** : 10 threads écrivent simultanément → pas de corruption
2. **Ligne malformée** : fichier avec ligne cassée → lecture continue
3. **Récupération** : interruption pendant écriture → `.bak` permet restauration

---

## 🚀 Déploiement & Configuration

### Prérequis
- **ASP.NET Core 8.0+**
- **IWebHostEnvironment** (pour résolution `ApplicationData`)
- **Permissions** : écriture dans `%AppData%\API_ATF_MOBILE\comments\`

### Enregistrement du service
```csharp
// Program.cs
builder.Services.AddSingleton<ICommentsServiceV2, CommentsServiceV2>();
```

### Configuration (optionnelle)
```json
// appsettings.json
{
  "Comments": {
    "MaxFileSize": 5242880,          // 5 Mo
    "RateLimitRequests": 10,
    "RateLimitWindowMinutes": 5,
    "ArchiveRetentionDays": 365
  }
}
```

---

## 🔍 Monitoring & Logs

### Logs importants
```
✅ Commentaire ajouté : {Id} sur {EntityId} par {Author}
⚠️ Ligne JSONL malformée ignorée : {Line}
⚠️ Rate limit dépassé pour {IP} ({Count} req/5min)
📦 Fichier archivé : {Archive} (gardé {Count} commentaires récents)
❌ Erreur lors de l'ajout du commentaire
```

### Métriques recommandées
- Nombre de commentaires par projet
- Taux d'erreur POST (rate limit, validation)
- Taille des fichiers JSONL
- Fréquence d'archivage

---

## 📝 Migration depuis l'ancien système

### Ancien système (V1)
- ❌ Un seul commentaire par projet
- ❌ Stockage JSON global `wwwroot/data/project-comments.json`
- ❌ Pas d'historique
- ❌ Écrasement à chaque modification

### Nouveau système (V2)
- ✅ Multi-commentaires
- ✅ Stockage JSONL dans `ApplicationData` (persistant)
- ✅ Historique complet avec dates
- ✅ Append atomique

### Script de migration (optionnel)
```csharp
// Lire l'ancien fichier project-comments.json
var oldComments = JsonSerializer.Deserialize<Dictionary<string, CommentResponse>>(oldJson);

// Convertir en nouveaux commentaires
foreach (var (projectId, oldComment) in oldComments) {
    var newComment = new Comment {
        Id = Guid.NewGuid().ToString(),
        EntityId = projectId,
        AuthorName = oldComment.Author,
        Message = oldComment.Comment,
        CreatedAt = oldComment.CreatedAt
    };
    await commentsServiceV2.AddCommentAsync(newComment);
}
```

---

## ❓ FAQ

### Q : Pourquoi JSONL et pas une base SQL ?
**R** : Contrainte du cahier des charges. JSONL offre :
- Simplicité (pas de serveur DB)
- Performance (append direct, pas de parsing complet)
- Robustesse (corruptions isolées)

### Q : Que se passe-t-il si 2 utilisateurs ajoutent un commentaire simultanément ?
**R** : Le `SemaphoreSlim` garantit un accès exclusif au fichier. Les requêtes sont sérialisées automatiquement.

### Q : Comment restaurer un fichier corrompu ?
**R** : Le fichier `.bak` (créé pendant l'archivage) peut être restauré manuellement. Les lignes malformées sont ignorées lors de la lecture.

### Q : Peut-on supprimer un commentaire ?
**R** : Actuellement non implémenté (contrainte cahier des charges). Ajout possible via un champ `deleted: true` (soft delete).

### Q : Comment changer le fuseau horaire d'affichage ?
**R** : Modifier `timeZone: 'Europe/Paris'` dans `formatDate()` du composant JS.

---

## 🔗 Ressources

- **Fichiers principaux** :
  - `Models/Comment.cs`
  - `Services/CommentsServiceV2.cs`
  - `Controllers/CommentsV2Controller.cs`
  - `wwwroot/assets/js/comments-component.js`
  - `wwwroot/dashboard-projects-NV.html`

- **Standards** :
  - [RFC 4627 - JSON](https://tools.ietf.org/html/rfc4627)
  - [NDJSON Specification](http://ndjson.org/)
  - [ISO 8601 - Date/Time Format](https://en.wikipedia.org/wiki/ISO_8601)

---

## ✅ Checklist de validation

- [x] Stockage dans `ApplicationData/API_ATF_MOBILE/comments/`
- [x] Format JSONL avec un commentaire par ligne
- [x] Pagination cursor-based fonctionnelle
- [x] Rate limiting (10 req/5min par IP)
- [x] Validation stricte (2-80 chars nom, 1-2000 chars message)
- [x] Sanitization anti-XSS (strip tags + escape affichage)
- [x] Optimistic UI avec rollback
- [x] Auto-grow textarea + compteur caractères
- [x] Formatage dates Europe/Paris (affichage) + UTC (stockage)
- [x] File locking pour concurrence
- [x] Archivage automatique (>5 Mo)
- [x] Gestion des lignes corrompues (skip + log)
- [x] Toast notifications (succès/erreur)
- [x] `dashboard-projects-NV.html` non déplacé ✅
- [x] Documentation complète

---

**Auteur** : Système généré pour API_ATF_MOBILE  
**Version** : 2.0  
**Date** : 03/01/2025  
**Licence** : Projet interne RIVA

