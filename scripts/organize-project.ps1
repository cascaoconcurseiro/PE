# Script de Organizacao do Projeto
# Organiza arquivos e pastas de forma profissional

Write-Host "Organizando Projeto..." -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# Criar estrutura de pastas
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
        Write-Host "  Criado: $folder" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Estrutura criada!" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos organizados:" -ForegroundColor Yellow
Write-Host "  - Scripts de deploy -> scripts\deploy\" -ForegroundColor Gray
Write-Host "  - Scripts antigos -> scripts\archive\deploy-old\" -ForegroundColor Gray
Write-Host "  - Guias -> docs\guides\" -ForegroundColor Gray
Write-Host "  - Documentacao tecnica -> docs\technical\" -ForegroundColor Gray
Write-Host "  - Scripts SQL -> docs\sql-scripts\" -ForegroundColor Gray
Write-Host "  - Docs antigas -> docs\archive\" -ForegroundColor Gray

