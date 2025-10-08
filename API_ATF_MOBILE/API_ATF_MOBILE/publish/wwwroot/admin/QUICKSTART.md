# ⚡ Démarrage Rapide - Interface Admin

## 🚀 En 3 étapes

### 1️⃣ Démarrer le serveur

```bash
cd API_ATF_MOBILE\API_ATF_MOBILE
dotnet run --configuration Release
```

Le serveur démarre sur : `http://0.0.0.0:8088`

### 2️⃣ Ouvrir l'interface

Dans votre navigateur, allez sur :
```
http://localhost:8088/admin/
```

ou depuis le réseau :
```
http://10.250.13.4:8088/admin/
```

### 3️⃣ Se connecter

**Identifiants par défaut :**
- Utilisateur : `admin`
- Mot de passe : `admin123`

---

## 🎯 Que faire ensuite ?

### Tableau de bord
- Consultez les métriques temps réel (CPU, RAM, Uptime)
- Visualisez l'état des connexions
- Analysez les graphiques

### Bases de données
- Vérifiez la santé des connexions SQL
- Consultez les statistiques des tables
- Testez les temps de réponse

### PLC S7
- Vérifiez la connexion au S7-1500
- Testez la connectivité
- Lisez des variables en temps réel
  - Exemple : `DB2003.DBD6` pour un Float

### Logs
- Filtrez par niveau (Info, Warning, Error)
- Recherchez des mots-clés
- Analysez les exceptions

---

## ⚙️ Configuration

Les paramètres sont dans `appsettings.json` :

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=AI_ATS;...",
    "SqlAiAtr": "Server=...;Database=AI_ATR;..."
  },
  "Jwt": {
    "Secret": "VotreCleSecrète",
    "Issuer": "API_ATF_MOBILE",
    "Audience": "API_ATF_MOBILE_Admin"
  }
}
```

---

## 🔧 Dépannage express

### ❌ Ne charge pas ?
- Vérifiez que le serveur est démarré
- Testez : http://localhost:8088/swagger

### 🔐 Erreur 401 ?
- Reconnectez-vous (token expiré après 8h)
- Vérifiez les identifiants

### 📊 Dashboard vide ?
- Ouvrez F12 (console développeur)
- Vérifiez les erreurs réseau
- Testez `/api/admin/health` manuellement

---

## 📱 Support

Documentation complète : `README.md`

**Version** : 1.0.0  
**Build** : Octobre 2024

