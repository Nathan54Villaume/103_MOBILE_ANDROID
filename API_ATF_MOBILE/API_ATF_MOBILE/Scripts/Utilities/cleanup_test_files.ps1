# Script de nettoyage des fichiers de test temporaires
# À exécuter après validation complète

Write-Host "🧹 Nettoyage des fichiers de test temporaires..." -ForegroundColor Yellow

$testFiles = @(
    "test_functionality.html",
    "validation_scenarios.html",
    "cleanup_test_files.ps1"
)

foreach ($file in $testFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "✅ Supprimé: $file" -ForegroundColor Green
    }
}

Write-Host "🎉 Nettoyage terminé !" -ForegroundColor Green
Write-Host "📋 Le rapport de validation est conservé dans VALIDATION_REPORT.md" -ForegroundColor Cyan
