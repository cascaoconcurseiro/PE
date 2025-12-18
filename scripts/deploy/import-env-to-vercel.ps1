# Script para importar variáveis do .env.local para o Vercel
# Execute: .\import-env-to-vercel.ps1

Write-Host ""
Write-Host "IMPORTAR .env.local PARA VERCEL" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se .env.local existe
$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "Erro: Arquivo .env.local nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, certifique-se de que o arquivo .env.local existe na raiz do projeto." -ForegroundColor Yellow
    exit 1
}

Write-Host "Arquivo .env.local encontrado!" -ForegroundColor Green
Write-Host ""

# Ler variáveis do .env.local
Write-Host "Lendo variaveis do .env.local..." -ForegroundColor Yellow
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    # Ignorar linhas vazias e comentários
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            # Remover aspas se existirem
            $value = $value.Trim('"').Trim("'")
            $envVars[$key] = $value
        }
    }
}

Write-Host ""
Write-Host "Variaveis encontradas:" -ForegroundColor Cyan
foreach ($key in $envVars.Keys) {
    if ($key -like "*KEY*" -or $key -like "*SECRET*" -or $key -like "*PASSWORD*") {
        Write-Host "   $key = ***OCULTO***" -ForegroundColor Gray
    }
    else {
        Write-Host "   $key = $($envVars[$key])" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Verificando Vercel CLI..." -ForegroundColor Yellow

# Verificar se Vercel CLI está instalado
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "Vercel CLI nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "Vercel CLI instalado!" -ForegroundColor Green
}
else {
    Write-Host "Vercel CLI ja instalado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Fazendo login no Vercel..." -ForegroundColor Yellow
Write-Host "(Uma janela do navegador sera aberta)" -ForegroundColor Gray
Write-Host ""

vercel login

Write-Host ""
Write-Host "Linkando projeto..." -ForegroundColor Yellow
vercel link --yes

Write-Host ""
Write-Host "Importando variaveis para o Vercel..." -ForegroundColor Yellow
Write-Host ""

# Função para adicionar variável no Vercel
function Add-VercelEnv {
    param($name, $value, $env)
    
    try {
        # Tentar adicionar a variável
        $output = echo $value | vercel env add $name $env 2>&1
        
        # Verificar se já existe
        if ($output -match "already exists") {
            Write-Host "   $name ($env) ja existe - pulando" -ForegroundColor Yellow
        }
        else {
            Write-Host "   $name ($env) adicionado" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   Erro ao adicionar $name ($env)" -ForegroundColor Red
    }
}

# Adicionar cada variável para todos os ambientes
$environments = @("production", "preview", "development")

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    
    Write-Host "Configurando $key..." -ForegroundColor White
    
    foreach ($env in $environments) {
        Add-VercelEnv $key $value $env
    }
    
    Write-Host ""
}

Write-Host ""
Write-Host "Todas as variaveis foram importadas!" -ForegroundColor Green
Write-Host ""

# Perguntar se quer fazer deploy
$deploy = Read-Host "Deseja fazer deploy agora? (S/N)"

if ($deploy -eq "S" -or $deploy -eq "s" -or $deploy -eq "Y" -or $deploy -eq "y") {
    Write-Host ""
    Write-Host "Fazendo deploy em producao..." -ForegroundColor Yellow
    Write-Host ""
    
    vercel --prod
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "PRONTO! SEU APP ESTA SENDO DEPLOYADO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "Variaveis importadas com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para fazer deploy manualmente, execute:" -ForegroundColor Yellow
    Write-Host "   vercel --prod" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Acompanhe seus deployments em: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
