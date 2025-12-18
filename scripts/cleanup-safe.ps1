# Script de Limpeza Segura - Windows PowerShell
# Remove arquivos de debug e temporarios com seguranca

Write-Host "Limpeza Segura de Arquivos de Debug" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Criar diretorio de backup
$backupDir = ".cleanup-backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Arquivos que podem ser removidos com seguranca
$filesToRemove = @(
    "debug_data_dump.sql",
    "debug_inspect.sql",
    "errors_v2.txt",
    "errors.log",
    "errors.txt",
    "fix_phantom.sql",
    "force-link-trips-v2.sql",
    "force-link-trips.sql",
    "deployment.log",
    "lighthouse-report.json",
    "metadata.json"
)

Write-Host "Fazendo backup dos arquivos..." -ForegroundColor Yellow
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Copy-Item $file "$backupDir\$file" -ErrorAction SilentlyContinue
        Write-Host "  OK Backup: $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Removendo arquivos..." -ForegroundColor Yellow
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item $file -ErrorAction SilentlyContinue
        Write-Host "  OK Removido: $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Limpeza concluida!" -ForegroundColor Green
Write-Host "Backup salvo em: .cleanup-backup\" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para reverter, copie os arquivos de volta:" -ForegroundColor Yellow
Write-Host "   Copy-Item .cleanup-backup\* ." -ForegroundColor Gray

