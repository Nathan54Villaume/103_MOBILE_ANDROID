# 🚀 Système de Commentaires V2 - Guide de Démarrage Rapide

## 📦 Installation & Démarrage

Le système de commentaires V2 est **automatiquement activé** au démarrage du serveur. Aucune configuration supplémentaire n'est requise.

### Vérification
Au démarrage, vous devriez voir dans les logs :
```
💬 Service de commentaires V2 initialisé : C:\Users\...\AppData\Roaming\API_ATF_MOBILE\comments
```

---

## 🎯 Utilisation

### 1. Accéder au Dashboard
```
http://localhost:8088/dashboard-projects-NV.html
```

### 2. Ouvrir un projet
Cliquez sur "Voir" sur n'importe quelle carte de projet.

### 3. Ajouter un commentaire
1. Cliquez sur le bouton **"➕ Ajouter"** en haut de la section Commentaires
2. Entrez votre nom (2-80 caractères)
3. Écrivez votre message (1-2000 caractères)
4. Cliquez sur **"💾 Envoyer"** (ou Ctrl+Enter)

### 4. Voir les anciens commentaires
Si plus de 50 commentaires existent, cliquez sur **"📄 Voir plus"** en bas de la liste.

---

## 🔌 API REST

### Récupérer les commentaires d'un projet
```http
GET /api/comments?entityId=suivi-produit-ats&limit=50
```

**Réponse** :
```json
{
  "items": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "entityId": "suivi-produit-ats",
      "authorName": "Nathan Villaume",
      "authorId": null,
      "message": "Excellent travail !",
      "createdAt": "2025-01-03T14:30:22.123Z"
    }
  ],
  "nextCursor": "2025-01-03T12:00:00.000Z",
  "total": 5
}
```

### Ajouter un commentaire
```http
POST /api/comments
Content-Type: application/json

{
  "entityId": "suivi-produit-ats",
  "authorName": "Nathan Villaume",
  "message": "Très bon projet de traçabilité"
}
```

**Réponse** :
```json
{
  "id": "...",
  "entityId": "suivi-produit-ats",
  "authorName": "Nathan Villaume",
  "authorId": null,
  "message": "Très bon projet de traçabilité",
  "createdAt": "2025-01-03T14:30:22.123Z"
}
```

### Compter les commentaires
```http
GET /api/comments/count?entityId=suivi-produit-ats
```

**Réponse** :
```json
{
  "entityId": "suivi-produit-ats",
  "count": 5
}
```

---

## 📁 Structure des Fichiers

```
%AppData%\API_ATF_MOBILE\
├── plc-connections.json              (Connexions PLC - existant)
└── comments\                          (Nouveau dossier)
    ├── comments-suivi-produit-ats.jsonl
    ├── comments-gestion-rfid-ats.jsonl
    ├── comments-supervision-poste-electrique.jsonl
    └── comments-*-20250103_143022.jsonl.gz  (archives auto)
```

### Format JSONL
Chaque ligne = un commentaire JSON :
```jsonl
{"id":"...","entityId":"suivi-produit-ats","authorName":"Nathan","message":"Test","createdAt":"2025-01-03T14:30:22Z"}
{"id":"...","entityId":"suivi-produit-ats","authorName":"Marie","message":"Super !","createdAt":"2025-01-03T15:00:00Z"}
```

---

## ⚙️ Configuration (Optionnelle)

Par défaut, aucune configuration n'est nécessaire. Pour personnaliser :

```csharp
// Services/CommentsServiceV2.cs

// Changer la limite de taille avant archivage (défaut: 5 Mo)
private readonly long _maxFileSize = 10 * 1024 * 1024; // 10 Mo

// Changer le rate limiting (défaut: 10 req/5min)
private readonly int _maxRequestsPer5Min = 20;
```

---

## 🛠️ Maintenance

### Archivage manuel
Pour déclencher manuellement l'archivage :
```http
POST /api/comments/archive
```

Ceci compresse les fichiers volumineux en `.jsonl.gz` et conserve les 100 derniers commentaires dans le fichier actif.

### Restauration d'urgence
En cas de corruption, restaurer depuis le backup :
```powershell
cd %AppData%\API_ATF_MOBILE\comments
copy comments-xxx.jsonl.bak comments-xxx.jsonl
```

### Nettoyage des archives
Les fichiers `.jsonl.gz` peuvent être supprimés manuellement après X jours si nécessaire.

---

## 🔐 Sécurité

### Protection XSS
- ✅ **Côté serveur** : suppression automatique des tags HTML (`<script>`, etc.)
- ✅ **Côté client** : escape HTML à l'affichage

### Rate Limiting
- ✅ **Limite** : 10 commentaires par 5 minutes par adresse IP
- ✅ **Erreur HTTP 429** si dépassé

### Validation
- ✅ Nom : 2-80 caractères (accents autorisés)
- ✅ Message : 1-2000 caractères
- ✅ Trimming automatique

---

## 🐛 Dépannage

### "Erreur 429: Trop de requêtes"
**Cause** : Rate limit dépassé (>10 commentaires en 5 minutes)  
**Solution** : Attendre 5 minutes ou contacter l'administrateur

### "Erreur lors du chargement des commentaires"
**Cause** : Serveur API non démarré ou problème réseau  
**Solution** : Vérifier que `http://localhost:8088` est accessible

### "Commentaire non sauvegardé"
**Cause** : Validation échouée (nom/message trop court/long)  
**Solution** : Vérifier les contraintes (2-80 chars nom, 1-2000 chars message)

### Fichier JSONL corrompu
**Cause** : Interruption pendant écriture (rare)  
**Solution** : Les lignes malformées sont automatiquement ignorées. Vérifier les logs pour `⚠️ Ligne JSONL malformée`

---

## 📊 Différences avec V1

| Caractéristique | V1 (ancien) | V2 (nouveau) |
|-----------------|-------------|--------------|
| **Commentaires par projet** | 1 seul | Illimités |
| **Stockage** | `wwwroot/data/` | `%AppData%/` |
| **Format** | JSON global | JSONL par projet |
| **Historique** | ❌ Non | ✅ Oui (dates) |
| **Pagination** | ❌ Non | ✅ Oui (cursor) |
| **Multi-utilisateurs** | ❌ Non | ✅ Oui |
| **Rate limiting** | ❌ Non | ✅ Oui |
| **Archivage** | ❌ Non | ✅ Auto (>5 Mo) |
| **Optimistic UI** | ❌ Non | ✅ Oui |

---

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs du serveur : `Logs/api-atf-mobile-YYYYMMDD.log`
2. Consulter la documentation complète : `Documentation/COMMENTS_SYSTEM_V2.md`
3. Contacter l'équipe de développement

---

## ✅ Checklist Post-Installation

- [ ] Serveur démarré et logs OK
- [ ] Dashboard accessible sur `http://localhost:8088/dashboard-projects-NV.html`
- [ ] Ouverture d'un projet → section Commentaires visible
- [ ] Ajout d'un commentaire test → succès
- [ ] Commentaire visible dans la liste
- [ ] Fichier créé : `%AppData%\API_ATF_MOBILE\comments\comments-*.jsonl`

---

**Version** : 2.0  
**Dernière mise à jour** : 03/01/2025  
**Auteur** : Équipe API_ATF_MOBILE

