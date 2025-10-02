# 🔐 Interface d'Administration Serveur - API_ATF_MOBILE

Interface web moderne de gestion et monitoring du serveur API_ATF_MOBILE.

## 📋 Fonctionnalités

### 🎛️ Dashboard
- Vue d'ensemble temps réel du système
- Métriques CPU, Mémoire, Uptime
- État des connexions (BDD + PLC S7)
- Graphiques interactifs (Chart.js)
- Statistiques des logs

### 💻 Serveur
- Informations système détaillées
- Métriques de performance
- Configuration runtime
- État du processus

### 💾 Bases de Données
- Santé des connexions SQL
- Test de connexion en temps réel
- Statistiques par base :
  - Nombre de tables
  - Taille de la base
  - Compteurs d'enregistrements
- Temps de réponse

### 🔌 PLC S7
- État de connexion S7-1500
- Test de connexion
- Lecture de variables en temps réel
- Statistiques de connexion
- Configuration (IP, Rack, Slot)

### 📝 Logs
- Visualisation des logs système
- Filtrage par niveau (Info, Warning, Error, Critical)
- Recherche en temps réel
- Détails des exceptions

### ⚙️ Configuration
- Visualisation des paramètres actuels
- Chaînes de connexion (masquées)
- Variables d'environnement
- Niveau de log

### 🌐 API
- Liste des contrôleurs disponibles
- Endpoints par contrôleur
- Méthodes HTTP (GET, POST, PUT, DELETE)

## 🔐 Authentification

### Identifiants par défaut

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| `admin` | `admin123` | Admin |
| `operateur` | `oper123` | Operator |

> ⚠️ **IMPORTANT** : Changez ces identifiants en production !

### Sécurité JWT

- Authentification par token JWT
- Durée de session : 8 heures
- Token stocké en localStorage
- Auto-déconnexion en cas d'expiration

## 🚀 Accès

### URL
```
http://[SERVEUR]:8088/admin/
```

Exemples :
- Local : http://localhost:8088/admin/
- Réseau : http://10.250.13.4:8088/admin/

### Pré-requis
- Serveur API_ATF_MOBILE démarré
- Navigateur moderne (Chrome, Firefox, Edge)
- Accès réseau au serveur

## 🎨 Interface

### Design
- **Framework CSS** : Tailwind CSS
- **Thème** : Dark mode (cohérent avec dashboard-projects)
- **Police** : Inter
- **Style** : Glassmorphism
- **Charts** : Chart.js 4.4.1

### Responsive
- ✅ Desktop (optimisé)
- ✅ Tablette
- ✅ Mobile (navigation adaptée)

## 🔄 Rafraîchissement automatique

- **Dashboard** : Mise à jour automatique toutes les 5 secondes
- **Autres sections** : Rafraîchissement manuel ou via bouton 🔄

## 🛠️ Architecture Technique

### Backend (C# / ASP.NET Core 8.0)

#### Services
- `ServerMonitorService` : Métriques système (CPU, RAM)
- `DatabaseHealthService` : Santé et stats des BDD
- `S7MonitorService` : Monitoring PLC S7
- `LogReaderService` : Lecture et analyse des logs
- `AuthenticationService` : Authentification JWT

#### Contrôleurs
- `AuthController` : `/api/auth/*` - Authentification
- `ServerAdminController` : `/api/admin/*` - Administration (protégé JWT)

#### Endpoints principaux
```
POST   /api/auth/login
GET    /api/auth/validate
GET    /api/auth/me

GET    /api/admin/dashboard       # Tout en un
GET    /api/admin/status          # Statut serveur
GET    /api/admin/metrics         # Métriques
GET    /api/admin/health          # Health check global
GET    /api/admin/database/health # BDD
GET    /api/admin/s7/status       # PLC S7
POST   /api/admin/s7/test         # Test S7
POST   /api/admin/s7/read         # Lecture variable
GET    /api/admin/logs            # Logs
GET    /api/admin/config          # Configuration
GET    /api/admin/controllers     # Liste API
```

### Frontend (JavaScript ES6 Modules)

#### Modules
- `admin.js` : Point d'entrée, orchestration
- `api-client.js` : Client HTTP avec gestion JWT
- `server-monitor.js` : Dashboard serveur
- `database-manager.js` : Gestion BDD
- `s7-manager.js` : Gestion PLC S7
- `logs-viewer.js` : Visualisation logs
- `config-viewer.js` : Affichage config
- `api-viewer.js` : Liste contrôleurs

#### État global
```javascript
{
  currentSection: 'dashboard',
  pollingInterval: null,
  refreshRate: 5000,
  charts: {}
}
```

## 📊 Graphiques

### CPU & Mémoire
- Type : Bar chart
- Données : Utilisation en pourcentage
- Mise à jour : En temps réel

### Logs
- Type : Doughnut chart
- Données : Répartition par niveau
- Légende : Position droite

## 🔧 Configuration

### Modifier le taux de rafraîchissement

Dans `admin.js` :
```javascript
const state = {
    refreshRate: 5000  // 5 secondes (millisecondes)
};
```

### Ajouter des utilisateurs

Dans `Services/AuthenticationService.cs` :
```csharp
_users = new List<AdminUser>
{
    new AdminUser
    {
        Username = "nouveauuser",
        PasswordHash = HashPassword("motdepasse"),
        Role = "Admin"
    }
};
```

> 💡 Pour une vraie application, utilisez une base de données !

### Personnaliser le JWT

Dans `appsettings.json` :
```json
{
  "Jwt": {
    "Secret": "VotreCleSecreteTresLongue",
    "Issuer": "API_ATF_MOBILE",
    "Audience": "API_ATF_MOBILE_Admin"
  }
}
```

## 🐛 Dépannage

### Erreur 401 Unauthorized
- Vérifiez que vous êtes connecté
- Le token JWT a peut-être expiré (8h)
- Reconnectez-vous

### Dashboard ne charge pas
- Vérifiez que le serveur est démarré
- Ouvrez la console (F12) pour voir les erreurs
- Vérifiez l'URL de l'API

### Connexion S7 échoue
- Vérifiez l'adresse IP du PLC (10.250.13.10)
- Vérifiez la connectivité réseau
- Vérifiez que le PLC est allumé

### BDD ne se connecte pas
- Vérifiez les chaînes de connexion dans `appsettings.json`
- Vérifiez que SQL Server est accessible
- Testez la connexion manuellement

## 📝 Notes de développement

### Ajout d'un nouvel endpoint

1. **Backend** : Ajouter la méthode dans `ServerAdminController`
```csharp
[HttpGet("nouveau")]
public async Task<ActionResult<Data>> GetNouveau()
{
    // Votre code
}
```

2. **Frontend** : Ajouter la méthode dans `api-client.js`
```javascript
async getNouveau() {
    return await this.request('/api/admin/nouveau');
}
```

3. **UI** : Utiliser dans le module approprié
```javascript
const data = await apiClient.getNouveau();
```

### Ajout d'une nouvelle section

1. Créer la section dans `index.html`
2. Créer le module JS correspondant
3. Ajouter dans la navigation
4. Importer et initialiser dans `admin.js`

## 🔒 Sécurité

### Recommandations Production

- [ ] Changer tous les mots de passe par défaut
- [ ] Utiliser une vraie base de données pour les utilisateurs
- [ ] Utiliser bcrypt au lieu de SHA256 pour les mots de passe
- [ ] Configurer HTTPS
- [ ] Implémenter rate limiting
- [ ] Ajouter des logs d'audit
- [ ] Configurer CORS correctement
- [ ] Utiliser des secrets management (Azure Key Vault, etc.)
- [ ] Implémenter 2FA
- [ ] Ajouter captcha sur login

## 📜 License

© 2024-2025 API_ATF_MOBILE - Usage interne uniquement

## 👤 Auteur

VILLAUME Nathan - Développement full-stack

## 📞 Support

Pour toute question ou problème, contactez l'administrateur système.

---

**Version** : 1.0.0  
**Dernière mise à jour** : Octobre 2024

