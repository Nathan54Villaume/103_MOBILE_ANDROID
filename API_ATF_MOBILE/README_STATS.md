# 📊 Génération automatique des statistiques

Ce dossier contient des outils pour générer automatiquement les statistiques du projet.

## 🚀 Utilisation rapide

```powershell
# Générer les statistiques
.\update-stats.ps1

# Résultat dans PROJECT_STATISTICS.md
```

## 📁 Fichiers

- **`PROJECT_STATISTICS.md`** - Rapport complet des statistiques (généré automatiquement)
- **`update-stats.ps1`** - Script PowerShell de génération (version simple et robuste)
- **`generate-stats.ps1`** - Script PowerShell avancé (version complète, peut avoir des problèmes d'encodage)

## 📈 Contenu du rapport

Le rapport généré contient :

- **Vue d'ensemble** : Total lignes, fichiers, langages
- **Top 10 des langages** : Classement par nombre de lignes
- **Langages de programmation** : Focus sur le code source
- **Métadonnées** : Branche Git, commit, date de génération

## 🔄 Mise à jour automatique

Pour maintenir les statistiques à jour :

1. **Après chaque commit important** :
   ```powershell
   .\update-stats.ps1
   git add PROJECT_STATISTICS.md
   git commit -m "docs: mise à jour des statistiques du projet"
   ```

2. **Intégration dans un script de build** :
   ```powershell
   # Dans votre script de déploiement
   .\update-stats.ps1
   ```

## 🛠️ Dépannage

### Erreurs de caractères spéciaux
Si vous voyez des erreurs comme "Caractères non conformes", c'est normal. Le script ignore ces fichiers et continue l'analyse.

### Permissions
Assurez-vous d'exécuter PowerShell avec les permissions appropriées :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Fichiers manqués
Le script analyse uniquement les fichiers suivis par Git. Pour inclure de nouveaux fichiers :
```bash
git add nouveaux-fichiers
.\update-stats.ps1
```

## 📊 Exemple de sortie

```
Analyse des statistiques du projet...
Rapport genere: PROJECT_STATISTICS.md
Total: 132 884 lignes dans 147 fichiers
```

## 🎯 Personnalisation

Pour modifier le script `update-stats.ps1` :

- **Changer les catégories de code** : Modifier `$codeLanguages`
- **Ajouter des langages** : Étendre le `switch` dans la section langages
- **Modifier le format** : Éditer la variable `$markdown`

---

*📝 Ces outils permettent de maintenir une documentation automatique et à jour des métriques du projet.*
