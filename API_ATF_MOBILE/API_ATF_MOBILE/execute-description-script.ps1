# ========================================
# Script PowerShell pour exécuter le script SQL
# d'ajout des descriptions dans la table TagMap
# ========================================

param(
    [string]$ServerInstance = "localhost",
    [string]$Database = "AI_ATR",
    [string]$SqlScriptPath = "add-description-column.sql"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Execution du script SQL pour les descriptions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SqlScriptPath)) {
    Write-Host "ERREUR: Le fichier SQL '$SqlScriptPath' n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier SQL trouve: $SqlScriptPath" -ForegroundColor Green
Write-Host "Serveur: $ServerInstance" -ForegroundColor Yellow
Write-Host "Base de donnees: $Database" -ForegroundColor Yellow
Write-Host ""

try {
    # Lire le contenu du script SQL
    $sqlContent = Get-Content -Path $SqlScriptPath -Raw -Encoding UTF8
    
    Write-Host "Contenu du script SQL lu ($($sqlContent.Length) caracteres)" -ForegroundColor Green
    
    # Exécuter le script SQL
    Write-Host "Execution du script SQL..." -ForegroundColor Yellow
    
    # Utiliser sqlcmd pour exécuter le script
    $result = & sqlcmd -S $ServerInstance -d $Database -i $SqlScriptPath -o "sql-output.txt" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script SQL execute avec succes!" -ForegroundColor Green
        
        # Afficher la sortie
        if (Test-Path "sql-output.txt") {
            Write-Host ""
            Write-Host "Sortie du script SQL:" -ForegroundColor Cyan
            Write-Host "----------------------------------------" -ForegroundColor Gray
            Get-Content "sql-output.txt" | ForEach-Object { Write-Host $_ -ForegroundColor White }
            Write-Host "----------------------------------------" -ForegroundColor Gray
            
            # Nettoyer le fichier temporaire
            Remove-Item "sql-output.txt" -Force
        }
        
        Write-Host ""
        Write-Host "Les descriptions ont ete ajoutees avec succes!" -ForegroundColor Green
        Write-Host "Vous pouvez maintenant rafraichir l'interface web pour voir les descriptions." -ForegroundColor Yellow
        
    } else {
        Write-Host "ERREUR lors de l'execution du script SQL (Code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Sortie d'erreur:" -ForegroundColor Red
        $result | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        exit 1
    }
    
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Script termine avec succes!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
