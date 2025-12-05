# Script simplificado para configurar Vercel
# Execute: .\quick-vercel-setup.ps1

Write-Host ""
Write-Host "🚀 CONFIGURAÇÃO RÁPIDA - VERCEL" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Informações do Supabase
$supabaseUrl = "https://mlqzeihukezlozooqhko.supabase.co"

Write-Host "✅ URL do Supabase: $supabaseUrl" -ForegroundColor Green
Write-Host ""
Write-Host "🔑 VOCÊ PRECISA DA CHAVE ANON DO SUPABASE:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Abra este link em seu navegador:" -ForegroundColor White
Write-Host "      https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Na seção 'Project API keys', copie a chave 'anon / public'" -ForegroundColor White
Write-Host "      (Ela começa com 'eyJ...')" -ForegroundColor Gray
Write-Host ""

# Pedir a chave
$supabaseKey = Read-Host "Cole a chave ANON aqui e pressione Enter"

if ([string]::IsNullOrWhiteSpace($supabaseKey)) {
    Write-Host ""
    Write-Host "❌ Erro: Chave não fornecida." -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, execute o script novamente e cole a chave." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Chave recebida!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Verificando Vercel CLI..." -ForegroundColor Yellow

# Verificar se Vercel CLI está instalado
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "⚠️  Vercel CLI não encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "✅ Vercel CLI instalado!" -ForegroundColor Green
}
else {
    Write-Host "✅ Vercel CLI já instalado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔐 Fazendo login no Vercel..." -ForegroundColor Yellow
Write-Host "(Uma janela do navegador será aberta)" -ForegroundColor Gray
Write-Host ""

vercel login

Write-Host ""
Write-Host "📁 Linkando projeto..." -ForegroundColor Yellow
vercel link --yes

Write-Host ""
Write-Host "⚙️  Adicionando variáveis de ambiente..." -ForegroundColor Yellow
Write-Host ""

# Função para adicionar variável
function Add-VercelEnv {
    param($name, $value, $env)
    Write-Host "   Adicionando $name ($env)..." -ForegroundColor Cyan
    echo $value | vercel env add $name $env 2>&1 | Out-Null
}

# Adicionar VITE_SUPABASE_URL
Write-Host "📌 Configurando VITE_SUPABASE_URL..." -ForegroundColor White
Add-VercelEnv "VITE_SUPABASE_URL" $supabaseUrl "production"
Add-VercelEnv "VITE_SUPABASE_URL" $supabaseUrl "preview"
Add-VercelEnv "VITE_SUPABASE_URL" $supabaseUrl "development"

# Adicionar VITE_SUPABASE_ANON_KEY
Write-Host "🔑 Configurando VITE_SUPABASE_ANON_KEY..." -ForegroundColor White
Add-VercelEnv "VITE_SUPABASE_ANON_KEY" $supabaseKey "production"
Add-VercelEnv "VITE_SUPABASE_ANON_KEY" $supabaseKey "preview"
Add-VercelEnv "VITE_SUPABASE_ANON_KEY" $supabaseKey "development"

Write-Host ""
Write-Host "✅ Variáveis configuradas com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Fazendo deploy em produção..." -ForegroundColor Yellow
Write-Host ""

vercel --prod

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 PRONTO! SEU APP ESTÁ SENDO DEPLOYADO!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Acompanhe o deploy em: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ Aguarde 1-2 minutos e teste seu site!" -ForegroundColor Yellow
Write-Host ""
