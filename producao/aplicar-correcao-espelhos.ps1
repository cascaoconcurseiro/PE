# ============================================
# SCRIPT PARA APLICAR CORREÇÃO DE ESPELHOS
# Data: 2024-12-25
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CORREÇÃO: Parcelas Compartilhadas Invisíveis" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Problema:" -ForegroundColor Yellow
Write-Host "- Parcelas compartilhadas não aparecem para o usuário atribuído" -ForegroundColor White
Write-Host "- Trigger de sincronização foi removido acidentalmente" -ForegroundColor White
Write-Host ""

Write-Host "Solução:" -ForegroundColor Green
Write-Host "1. Restaurar trigger de sincronização automática" -ForegroundColor White
Write-Host "2. Criar espelhos para transações existentes" -ForegroundColor White
Write-Host ""

# Verificar se está no diretório correto
if (-not (Test-Path "supabase/migrations")) {
    Write-Host "ERRO: Execute este script do diretório 'producao'" -ForegroundColor Red
    exit 1
}

# Verificar se as migrations existem
$migration1 = "supabase/migrations/20241225_restore_shared_sync_trigger.sql"
$migration2 = "supabase/migrations/20241225_backfill_missing_mirrors.sql"

if (-not (Test-Path $migration1)) {
    Write-Host "ERRO: Migration não encontrada: $migration1" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $migration2)) {
    Write-Host "ERRO: Migration não encontrada: $migration2" -ForegroundColor Red
    exit 1
}

Write-Host "Migrations encontradas:" -ForegroundColor Green
Write-Host "✓ $migration1" -ForegroundColor White
Write-Host "✓ $migration2" -ForegroundColor White
Write-Host ""

# Perguntar confirmação
Write-Host "Deseja aplicar as migrations? (S/N): " -ForegroundColor Yellow -NoNewline
$resposta = Read-Host

if ($resposta -ne "S" -and $resposta -ne "s") {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Aplicando migrations..." -ForegroundColor Cyan
Write-Host ""

# Aplicar via Supabase CLI
try {
    Write-Host "Executando: supabase db push" -ForegroundColor White
    supabase db push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "SUCESSO!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Próximos passos:" -ForegroundColor Yellow
        Write-Host "1. Teste criando uma nova parcela compartilhada" -ForegroundColor White
        Write-Host "2. Verifique se aparece para ambos os usuários" -ForegroundColor White
        Write-Host "3. Verifique se as parcelas antigas agora aparecem" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERRO ao aplicar migrations!" -ForegroundColor Red
        Write-Host "Verifique os logs acima para mais detalhes." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "ERRO: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Pressione qualquer tecla para sair..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
