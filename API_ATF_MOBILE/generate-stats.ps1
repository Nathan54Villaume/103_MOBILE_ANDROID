# Script de génération automatique des statistiques du projet
# Usage: .\generate-stats.ps1
# Génère PROJECT_STATISTICS.md avec les données actuelles

param(
    [string]$OutputFile = "PROJECT_STATISTICS.md",
    [switch]$Verbose
)

Write-Host "🔍 Analyse des statistiques du projet ATF Mobile..." -ForegroundColor Cyan

# Vérifier qu'on est dans un repo Git
if (-not (Test-Path ".git")) {
    Write-Error "❌ Ce script doit être exécuté à la racine d'un repository Git"
    exit 1
}

# Obtenir les informations Git
$branch = git branch --show-current
$commit = git rev-parse --short HEAD
$date = Get-Date -Format "d MMMM yyyy"

Write-Host "📊 Branche: $branch | Commit: $commit" -ForegroundColor Green

# Analyser tous les fichiers
Write-Host "📁 Analyse des fichiers..." -ForegroundColor Yellow

$results = @()
$totalFiles = 0
$totalLines = 0

git ls-files | ForEach-Object {
    $file = $_
    $totalFiles++
    
    if ($file -match '\.([^\.]+)$') {
        $ext = $matches[1].ToLower()
        try {
            if (Test-Path $file -ErrorAction SilentlyContinue) {
                $lines = (Get-Content $file -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
                if ($lines -gt 0) {
                    $totalLines += $lines
                    $results += [PSCustomObject]@{
                        Extension = $ext
                        Lines = $lines
                        File = $file
                    }
                    
                    if ($Verbose) {
                        Write-Host "  $file ($lines lignes)" -ForegroundColor Gray
                    }
                }
            }
        } catch {
            # Ignorer les erreurs silencieusement
        }
    }
}

# Grouper par extension
$grouped = $results | Group-Object Extension | ForEach-Object {
    [PSCustomObject]@{
        Language = $_.Name
        Files = $_.Count
        TotalLines = ($_.Group.Lines | Measure-Object -Sum).Sum
        Percentage = [math]::Round(($_.Group.Lines | Measure-Object -Sum).Sum / $totalLines * 100, 1)
    }
} | Sort-Object TotalLines -Descending

Write-Host "📈 Génération du rapport..." -ForegroundColor Yellow

# Calculer les catégories
$codeLanguages = @('js', 'cs', 'py', 'ps1', 'bat')
$webLanguages = @('html', 'css')
$docLanguages = @('md', 'txt')

$codeStats = $grouped | Where-Object { $_.Language -in $codeLanguages }
$webStats = $grouped | Where-Object { $_.Language -in $webLanguages }
$docStats = $grouped | Where-Object { $_.Language -in $docLanguages }

$totalCodeLines = ($codeStats | Measure-Object -Property TotalLines -Sum).Sum
$totalWebLines = ($webStats | Measure-Object -Property TotalLines -Sum).Sum
$totalDocLines = ($docStats | Measure-Object -Property TotalLines -Sum).Sum

# Créer le contenu par parties
$content = @()

# En-tête
$content += "# 📊 Statistiques du Projet ATF Mobile"
$content += ""
$content += "> Analyse automatique de la base de code - Branche ``$branch``"
$content += "> Généré le : **$date**"
$content += ""

# Vue d'ensemble
$content += "## 🎯 Vue d'ensemble"
$content += ""
$content += "| Métrique | Valeur |"
$content += "|----------|--------|"
$content += "| **Total lignes** | $($totalLines.ToString('N0')) |"
$content += "| **Fichiers suivis** | $totalFiles |"
$content += "| **Langages** | $($grouped.Count) |"
$content += "| **Code source pur** | $($totalCodeLines.ToString('N0')) lignes |"
$content += "| **Interface web** | $($totalWebLines.ToString('N0')) lignes |"
$content += ""

# Top 10 des langages
$content += "## 📈 Répartition par langages"
$content += ""
$content += "### 🥇 Top 10 des langages"
$content += ""
$content += "| Rang | Langage | Type | Fichiers | Lignes | % du total |"
$content += "|------|---------|------|----------|--------|------------|"

$top10 = $grouped | Select-Object -First 10
for ($i = 0; $i -lt $top10.Count; $i++) {
    $lang = $top10[$i]
    $type = switch ($lang.Language) {
        { $_ -in $codeLanguages } { "Code" }
        { $_ -in $webLanguages } { "Web" }
        { $_ -in $docLanguages } { "Documentation" }
        { $_ -in @('jpg', 'png', 'svg') } { "Image" }
        { $_ -in @('docx', 'pdf') } { "Document" }
        { $_ -in @('sqlite', 'db') } { "Base de données" }
        default { "Autre" }
    }
    
    $langName = switch ($lang.Language) {
        'js' { 'JavaScript' }
        'cs' { 'C#' }
        'py' { 'Python' }
        'ps1' { 'PowerShell' }
        'html' { 'HTML' }
        'css' { 'CSS' }
        'md' { 'Markdown' }
        'json' { 'JSON' }
        'xml' { 'XML' }
        'jpg' { 'JPG' }
        'png' { 'PNG' }
        'svg' { 'SVG' }
        'docx' { 'DOCX' }
        'sqlite' { 'SQLite' }
        'bat' { 'Batch' }
        'csproj' { 'C# Project' }
        'sln' { 'Solution' }
        default { $lang.Language.ToUpper() }
    }
    
    $content += "| $($i + 1) | **$langName** | $type | $($lang.Files) | **$($lang.TotalLines.ToString('N0'))** | $($lang.Percentage)% |"
}

$content += ""

# Langages de programmation
$content += "### 🔧 Langages de programmation (code source)"
$content += ""
$content += "| Langage | Fichiers | Lignes | % du code | Description |"
$content += "|---------|----------|--------|-----------|-------------|"

$codeStats | ForEach-Object {
    $langName = switch ($_.Language) {
        'js' { 'JavaScript' }
        'cs' { 'C#' }
        'py' { 'Python' }
        'ps1' { 'PowerShell' }
        'bat' { 'Batch' }
        default { $_.Language.ToUpper() }
    }
    
    $description = switch ($_.Language) {
        'js' { 'Interface d''administration, Event Viewer, API client' }
        'cs' { 'Backend API, services, contrôleurs, middleware' }
        'py' { 'Scripts d''analyse et utilitaires' }
        'ps1' { 'Scripts de déploiement Windows' }
        'bat' { 'Scripts d''automatisation Windows' }
        default { 'Scripts et utilitaires' }
    }
    
    if ($totalCodeLines -gt 0) {
        $codePercentage = [math]::Round($_.TotalLines / $totalCodeLines * 100, 1)
    } else {
        $codePercentage = 0
    }
    
    $content += "| **$langName** | $($_.Files) | $($_.TotalLines.ToString('N0')) | $codePercentage% | $description |"
}

$content += ""
$content += "**Total code source : $($totalCodeLines.ToString('N0')) lignes**"
$content += ""

# Métadonnées finales
$content += "---"
$content += ""
$content += "## 🔍 Méthodologie"
$content += ""
$content += "Cette analyse a été générée automatiquement via :"
$content += "``````powershell"
$content += ".\generate-stats.ps1"
$content += "``````"
$content += ""
$content += "**Dernière mise à jour** : $date"
$content += "**Branche analysée** : ``$branch``"
$content += "**Commit** : ``$commit``"
$content += ""
$content += "---"
$content += ""
$content += "*📝 Ce document est généré automatiquement. Pour le mettre à jour, exécuter ``.\generate-stats.ps1``*"

# Écrire le fichier
try {
    $content | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "✅ Rapport généré avec succès : $OutputFile" -ForegroundColor Green
    Write-Host "📊 Total : $($totalLines.ToString('N0')) lignes dans $totalFiles fichiers" -ForegroundColor Cyan
    
    # Afficher un résumé
    Write-Host ""
    Write-Host "🎯 Résumé :" -ForegroundColor Yellow
    Write-Host "   Code source : $($totalCodeLines.ToString('N0')) lignes" -ForegroundColor White
    Write-Host "   Interface web : $($totalWebLines.ToString('N0')) lignes" -ForegroundColor White
    Write-Host "   Documentation : $($totalDocLines.ToString('N0')) lignes" -ForegroundColor White
    
} catch {
    Write-Error "❌ Erreur lors de l'écriture du fichier : $_"
    exit 1
}

Write-Host ""
Write-Host "🎉 Analyse terminée !" -ForegroundColor Green