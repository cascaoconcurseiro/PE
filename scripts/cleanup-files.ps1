# Script de Limpeza de Arquivos Desnecessários
# Remove arquivos de debug, logs e temporários da raiz do projeto

Write-Host "🧹 Iniciando limpeza de arquivos desnecessários..." -ForegroundColor Cyan

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

$removedCount = 0
$notFoundCount = 0

$rootPath = Split-Path -Parent $PSScriptRoot

foreach ($file in $filesToRemove) {
    $filePath = Join-Path $rootPath $file
    
    if (Test-Path $filePath) {
        try {
            Remove-Item $filePath -Force
            Write-Host "  ✅ Removido: $file" -ForegroundColor Green
            $removedCount++
        } catch {
            Write-Host "  ❌ Erro ao remover $file : $_" -ForegroundColor Red
        }
    } else {
        $notFoundCount++
    }
}

Write-Host "`n📊 Resumo:" -ForegroundColor Cyan
Write-Host "   ✅ Arquivos removidos: $removedCount" -ForegroundColor Green
Write-Host "   ℹ️  Arquivos não encontrados: $notFoundCount" -ForegroundColor Yellow
Write-Host "`n✅ Limpeza concluída!" -ForegroundColor Green

