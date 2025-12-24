# Script para aplicar migration no Supabase
# Uso: .\aplicar-migration.ps1

Write-Host "🚀 Aplicando Migration no Supabase..." -ForegroundColor Cyan
Write-Host ""

# Copiar SQL para clipboard
$sqlFile = "supabase/migrations/20260224_fix_critical_issues.sql"

if (Test-Path $sqlFile) {
    Get-Content $sqlFile | Set-Clipboard
    Write-Host "✅ SQL copiado para clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
    Write-Host "1. Abrir: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql" -ForegroundColor White
    Write-Host "2. Colar o SQL (Ctrl+V)" -ForegroundColor White
    Write-Host "3. Clicar em 'Run' (ou Ctrl+Enter)" -ForegroundColor White
    Write-Host "4. Aguardar mensagem de sucesso" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 Abrindo dashboard no navegador..." -ForegroundColor Cyan
    Start-Process "https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql"
    Write-Host ""
    Write-Host "✅ Pronto! Cole o SQL e execute." -ForegroundColor Green
} else {
    Write-Host "❌ Erro: Arquivo $sqlFile não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar no diretório 'producao'" -ForegroundColor Yellow
}
