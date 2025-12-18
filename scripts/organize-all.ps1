# Script de Organização Completa do Projeto
# Executa todas as tarefas de organização

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ORGANIZAÇÃO COMPLETA DO PROJETO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Criar estrutura de pastas
Write-Host "[1/5] Criando estrutura de pastas..." -ForegroundColor Yellow
$folders = @(
    "scripts\archive\deploy-old",
    "scripts\deploy",
    "docs\guides",
    "docs\technical",
    "docs\sql-scripts",
    "docs\archive\old-docs",
    "docs\archive\old-reports"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
}
Write-Host "  ✓ Estrutura criada" -ForegroundColor Green

# 2. Mover scripts de deploy antigos
Write-Host "`n[2/5] Movendo scripts de deploy antigos..." -ForegroundColor Yellow
$deployFiles = @(
    "deploy_phantom.mjs",
    "deploy_debug_data.mjs",
    "deploy_inspect.mjs",
    "deploy_repair.mjs",
    "deploy_master.mjs",
    "deploy-trip-provision.mjs",
    "deploy-force-link.mjs",
    "deploy-shared-fix-final.mjs",
    "check-trips-schema.mjs",
    "run_migration_final.mjs"
)

$moved = 0
foreach ($file in $deployFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "scripts\archive\deploy-old\" -Force -ErrorAction SilentlyContinue
        $moved++
    }
}
Write-Host "  ✓ $moved arquivos movidos" -ForegroundColor Green

# 3. Mover scripts de deploy ativos
Write-Host "`n[3/5] Organizando scripts de deploy..." -ForegroundColor Yellow
$activeDeploy = @(
    "configure-vercel.ps1",
    "import-env-to-vercel.ps1",
    "quick-vercel-setup.ps1"
)

$moved = 0
foreach ($file in $activeDeploy) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "scripts\deploy\" -Force -ErrorAction SilentlyContinue
        $moved++
    }
}
Write-Host "  ✓ $moved arquivos organizados" -ForegroundColor Green

# 4. Mover SQL scripts
Write-Host "`n[4/5] Organizando scripts SQL..." -ForegroundColor Yellow
$sqlFiles = Get-ChildItem -Path "docs" -Filter "*.sql" -ErrorAction SilentlyContinue
$moved = 0
foreach ($file in $sqlFiles) {
    Move-Item -Path $file.FullName -Destination "docs\sql-scripts\" -Force -ErrorAction SilentlyContinue
    $moved++
}
Write-Host "  ✓ $moved arquivos SQL organizados" -ForegroundColor Green

# 5. Resumo
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ORGANIZAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Estrutura criada:" -ForegroundColor Yellow
Write-Host "  • Scripts antigos → scripts\archive\deploy-old\" -ForegroundColor Gray
Write-Host "  • Scripts deploy → scripts\deploy\" -ForegroundColor Gray
Write-Host "  • Guias → docs\guides\" -ForegroundColor Gray
Write-Host "  • Técnico → docs\technical\" -ForegroundColor Gray
Write-Host "  • SQL → docs\sql-scripts\" -ForegroundColor Gray
Write-Host "  • Arquivo → docs\archive\" -ForegroundColor Gray

Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "  1. Organizar documentação manualmente (guides/technical)" -ForegroundColor Gray
Write-Host "  2. Revisar arquivos em archive/" -ForegroundColor Gray
Write-Host "  3. Verificar se tudo funciona`n" -ForegroundColor Gray

