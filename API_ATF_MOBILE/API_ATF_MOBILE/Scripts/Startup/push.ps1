# Script PowerShell : push-dev.ps1
# Usage : lancer dans un terminal PowerShell à la racine de ton projet

# Étape 1 : Ajouter tous les fichiers modifiés ou non suivis
git add .

# Étape 2 : Demander un message de commit
$message = Read-Host "Entrez le message de commit"
if (-not [string]::IsNullOrWhiteSpace($message)) {
    git commit -m "$message"
    # Étape 3 : Push sur la branche actuelle
    git push
    Write-Host "✅ Push effectué avec succès sur la branche courante." -ForegroundColor Green
} else {
    Write-Host "❌ Commit annulé : message vide." -ForegroundColor Red
}
