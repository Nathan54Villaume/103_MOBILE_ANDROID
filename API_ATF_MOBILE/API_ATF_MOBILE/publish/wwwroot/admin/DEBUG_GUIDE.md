# 🐛 Guide de Debug - Event Viewer

## Problème : Affichage figé, boutons non fonctionnels

### 🔍 Étapes de diagnostic

#### 1. Ouvrir la Console Développeur
- Appuyer sur **F12**
- Aller dans l'onglet **Console**
- Rafraîchir la page (F5)

#### 2. Vérifier les messages de debug
Vous devriez voir :
```
📝 Initialisation du module Event Viewer
🎮 Initialisation des contrôles...
✅ Bouton Play trouvé
✅ Bouton Stop trouvé
✅ Bouton Clear trouvé
🔄 Chargement des logs initiaux...
```

#### 3. Si vous voyez des erreurs

**❌ Bouton XXX non trouvé**
- Problème : Les IDs HTML ne correspondent pas
- Solution : Vérifier que `index.html` contient les bons IDs

**❌ Erreur lors du chargement initial**
- Problème : API ne répond pas ou retourne une erreur
- Solution : Le système créera des logs de test automatiquement

**❌ Container logsList non trouvé**
- Problème : L'élément HTML n'existe pas
- Solution : Vérifier l'ID dans `index.html`

### 🧪 Page de test

Ouvrir : `http://localhost:8088/admin/debug-logs.html`

Cette page permet de :
- Tester l'API directement
- Tester le service de logs
- Voir tous les messages console
- Tester Play/Stop/Reset

### 🔧 Solutions rapides

#### Solution 1 : Logs de test
Si l'API ne retourne rien, le système crée automatiquement 3 logs de test.

#### Solution 2 : Forcer le rechargement
```javascript
// Dans la console F12
logService.createTestLogs();
```

#### Solution 3 : Vérifier l'état
```javascript
// Dans la console F12
console.log('État:', logService.getState());
console.log('Logs:', logService.getDisplayedLogs());
```

#### Solution 4 : Test manuel des boutons
```javascript
// Dans la console F12
logService.start();    // Équivalent à Play
logService.stop();     // Équivalent à Stop
logService.clearLocal(); // Équivalent à Clear
```

### 📊 Messages de debug ajoutés

Le système affiche maintenant des messages détaillés :

- 🎮 Initialisation des contrôles
- 📥 Chargement des logs
- 🖼️ Rendu des logs
- ▶️ Actions utilisateur (Play/Stop/Clear)
- 📊 Nombre de logs à chaque étape

### 🎯 Test rapide

1. **Ouvrir F12 → Console**
2. **Rafraîchir la page**
3. **Aller dans Logs**
4. **Vérifier les messages console**
5. **Cliquer sur Play** → doit afficher "▶️ Clic sur Play"
6. **Cliquer sur Stop** → doit afficher "⏸️ Clic sur Stop"

Si tout fonctionne, vous verrez des logs s'afficher et les boutons réagir.

### 🚨 Si rien ne fonctionne

1. **Vérifier que vous êtes connecté** (login admin)
2. **Vérifier l'URL** : `http://localhost:8088/admin`
3. **Vider le cache** : Ctrl+F5
4. **Tester la page debug** : `/admin/debug-logs.html`

---

**Date :** 2 octobre 2025  
**Version :** Debug 1.0
