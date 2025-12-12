# Script para configurar variáveis de ambiente no Vercel
# Execute: .\configure-vercel.ps1

Write-Host "🚀 Configurando Variáveis de Ambiente no Vercel" -ForegroundColor Cyan
Write-Host ""

# Verificar se Vercel CLI está instalado
Write-Host "📦 Verificando Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI não encontrado. Instalando..." -ForegroundColor Red
    npm install -g vercel
    Write-Host "✅ Vercel CLI instalado!" -ForegroundColor Green
}
else {
    Write-Host "✅ Vercel CLI já instalado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔐 Configurando variáveis de ambiente..." -ForegroundColor Yellow
Write-Host ""

# Supabase URL
$supabaseUrl = "https://mlqzeihukezlozooqhko.supabase.co"
Write-Host "📌 VITE_SUPABASE_URL = $supabaseUrl" -ForegroundColor Cyan

# Pedir a chave do Supabase
Write-Host ""
Write-Host "🔑 Você precisa da chave ANON do Supabase:" -ForegroundColor Yellow
Write-Host "   1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api" -ForegroundColor Gray
Write-Host "   2. Copie a chave 'anon / public' (começa com eyJ...)" -ForegroundColor Gray
Write-Host ""
$supabaseKey = Read-Host "Cole a chave ANON aqui"

if ([string]::IsNullOrWhiteSpace($supabaseKey)) {
    Write-Host "❌ Chave não fornecida. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔗 Fazendo login no Vercel..." -ForegroundColor Yellow
vercel login

Write-Host ""
Write-Host "📁 Linkando projeto..." -ForegroundColor Yellow
vercel link

Write-Host ""
Write-Host "⚙️ Adicionando variáveis de ambiente..." -ForegroundColor Yellow

# Adicionar VITE_SUPABASE_URL
Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_URL..." -ForegroundColor Cyan
Write-Output $supabaseUrl | vercel env add VITE_SUPABASE_URL production

Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_URL (Preview)..." -ForegroundColor Cyan
Write-Output $supabaseUrl | vercel env add VITE_SUPABASE_URL preview

Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_URL (Development)..." -ForegroundColor Cyan
Write-Output $supabaseUrl | vercel env add VITE_SUPABASE_URL development

# Adicionar VITE_SUPABASE_ANON_KEY
Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_ANON_KEY..." -ForegroundColor Cyan
Write-Output $supabaseKey | vercel env add VITE_SUPABASE_ANON_KEY production

Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_ANON_KEY (Preview)..." -ForegroundColor Cyan
Write-Output $supabaseKey | vercel env add VITE_SUPABASE_ANON_KEY preview

Write-Host ""
Write-Host "Adicionando VITE_SUPABASE_ANON_KEY (Development)..." -ForegroundColor Cyan
Write-Output $supabaseKey | vercel env add VITE_SUPABASE_ANON_KEY development

Write-Host ""
Write-Host "✅ Variáveis configuradas com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Fazendo deploy..." -ForegroundColor Yellow
vercel --prod

Write-Host ""
Write-Host "🎉 Pronto! Seu app está sendo deployado com as variáveis corretas!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Acompanhe o deploy em: https://vercel.com/dashboard" -ForegroundColor Cyan
