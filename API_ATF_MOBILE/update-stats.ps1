# Script simple de mise à jour des statistiques
param([string]$OutputFile = "PROJECT_STATISTICS.md")

Write-Host "Analyse des statistiques du projet..." -ForegroundColor Green

# Obtenir les informations Git
$branch = git branch --show-current
$commit = git rev-parse --short HEAD
$date = Get-Date -Format "dd/MM/yyyy"

# Analyser les fichiers
$results = @()
$totalFiles = 0
$totalLines = 0

git ls-files | ForEach-Object {
    $file = $_
    $totalFiles++
    
    $ext = [System.IO.Path]::GetExtension($file).ToLower().TrimStart('.')
    if ($ext -and (Test-Path $file)) {
        try {
            $lines = (Get-Content $file -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
            if ($lines -gt 0) {
                $totalLines += $lines
                $results += [PSCustomObject]@{
                    Extension = $ext
                    Lines = $lines
                    File = $file
                }
            }
        } catch {
            # Ignorer les erreurs
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

# Calculer les catégories
$codeLanguages = @('js', 'cs', 'py', 'ps1', 'bat')
$codeStats = $grouped | Where-Object { $_.Language -in $codeLanguages }
$totalCodeLines = ($codeStats | Measure-Object -Property TotalLines -Sum).Sum

# Générer le contenu
$markdown = @"
# Statistiques du Projet ATF Mobile

> Analyse automatique - Branche: $branch | Commit: $commit | Date: $date

## Vue d'ensemble

| Metrique | Valeur |
|----------|--------|
| Total lignes | $($totalLines.ToString("N0")) |
| Fichiers suivis | $totalFiles |
| Langages | $($grouped.Count) |
| Code source pur | $($totalCodeLines.ToString("N0")) lignes |

## Top 10 des langages

| Rang | Langage | Fichiers | Lignes | Pourcentage |
|------|---------|----------|--------|-------------|
"@

# Ajouter le top 10
$top10 = $grouped | Select-Object -First 10
for ($i = 0; $i -lt $top10.Count; $i++) {
    $lang = $top10[$i]
    $langName = switch ($lang.Language) {
        'js' { 'JavaScript' }
        'cs' { 'C#' }
        'py' { 'Python' }
        'ps1' { 'PowerShell' }
        'html' { 'HTML' }
        'css' { 'CSS' }
        'md' { 'Markdown' }
        'json' { 'JSON' }
        'jpg' { 'JPG' }
        'png' { 'PNG' }
        'docx' { 'DOCX' }
        'sqlite' { 'SQLite' }
        'bat' { 'Batch' }
        default { $lang.Language.ToUpper() }
    }
    
    $markdown += "`n| $($i + 1) | $langName | $($lang.Files) | $($lang.TotalLines.ToString('N0')) | $($lang.Percentage)% |"
}

$markdown += @"


## Langages de programmation

| Langage | Fichiers | Lignes | Pourcentage du code |
|---------|----------|--------|---------------------|
"@

# Ajouter les langages de code
$codeStats | ForEach-Object {
    $langName = switch ($_.Language) {
        'js' { 'JavaScript' }
        'cs' { 'C#' }
        'py' { 'Python' }
        'ps1' { 'PowerShell' }
        'bat' { 'Batch' }
        default { $_.Language.ToUpper() }
    }
    
    $codePercentage = if ($totalCodeLines -gt 0) { 
        [math]::Round($_.TotalLines / $totalCodeLines * 100, 1) 
    } else { 0 }
    
    $markdown += "`n| $langName | $($_.Files) | $($_.TotalLines.ToString('N0')) | $codePercentage% |"
}

$markdown += @"


**Total code source: $($totalCodeLines.ToString("N0")) lignes**

---

*Genere automatiquement le $date - Branche: $branch - Commit: $commit*

Pour mettre a jour: ``.\update-stats.ps1``
"@

# Écrire le fichier
$markdown | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "Rapport genere: $OutputFile" -ForegroundColor Green
Write-Host "Total: $($totalLines.ToString('N0')) lignes dans $totalFiles fichiers" -ForegroundColor Cyan
