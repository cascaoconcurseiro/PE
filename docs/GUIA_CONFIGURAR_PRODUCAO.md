# 🚀 Guia: Configurar Variáveis de Ambiente em Produção

## ❌ Problema

Você está recebendo este erro em produção:
```
Supabase URL or Key is missing. Please check .env.local
supabaseUrl is required.
```

**Causa:** As variáveis de ambiente do Supabase não estão configuradas no ambiente de produção (Vercel/Netlify/etc).

---

## ✅ Solução: Configurar no Vercel

### **Passo 1: Obter suas Credenciais do Supabase**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** (exemplo: `https://mlqzeihukezlozooqhko.supabase.co`)
   - **anon/public key** (uma chave longa começando com `eyJ...`)

---

### **Passo 2: Configurar no Vercel**

#### **Opção A: Via Dashboard (Recomendado)**

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto **PE**
3. Vá em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://mlqzeihukezlozooqhko.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `sua-chave-aqui` | Production, Preview, Development |

5. Clique em **Save**
6. Vá em **Deployments** → Clique nos 3 pontinhos do último deploy → **Redeploy**

#### **Opção B: Via CLI**

```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Fazer login
vercel login

# Adicionar variáveis
vercel env add VITE_SUPABASE_URL
# Cole a URL quando solicitado
# Selecione: Production, Preview, Development

vercel env add VITE_SUPABASE_ANON_KEY
# Cole a chave quando solicitado
# Selecione: Production, Preview, Development

# Fazer redeploy
vercel --prod
```

---

### **Passo 3: Verificar se Funcionou**

1. Aguarde o deploy terminar (1-2 minutos)
2. Acesse seu site em produção
3. Abra o **DevTools** (F12) → **Console**
4. Se não houver erros de Supabase, está funcionando! ✅

---

## 🔧 Outras Plataformas

### **Netlify**

1. Acesse: https://app.netlify.com
2. Selecione seu site
3. Vá em **Site settings** → **Environment variables**
4. Adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Vá em **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

### **GitHub Pages**

⚠️ **Não recomendado** para apps com variáveis de ambiente sensíveis.

Se ainda quiser usar:
1. As variáveis precisam ser configuradas no **GitHub Actions**
2. Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

3. Adicione os secrets em **Settings** → **Secrets and variables** → **Actions**

---

## 🧪 Testar Localmente (Modo Produção)

Se quiser testar o build de produção localmente:

```bash
# 1. Criar arquivo .env.production.local
echo "VITE_SUPABASE_URL=https://mlqzeihukezlozooqhko.supabase.co" > .env.production.local
echo "VITE_SUPABASE_ANON_KEY=sua-chave-aqui" >> .env.production.local

# 2. Build
npm run build

# 3. Preview
npm run preview
```

**Nota:** O arquivo `.env.production.local` NÃO deve ser commitado no Git!

---

## 📋 Checklist

- [ ] Obtive as credenciais do Supabase
- [ ] Configurei `VITE_SUPABASE_URL` no Vercel
- [ ] Configurei `VITE_SUPABASE_ANON_KEY` no Vercel
- [ ] Fiz redeploy da aplicação
- [ ] Testei e não há mais erros de Supabase

---

## ❓ Troubleshooting

### **Erro persiste após configurar**

1. **Limpe o cache do Vercel:**
   - Dashboard → Deployments → Redeploy → ✅ Use existing Build Cache: **OFF**

2. **Verifique se as variáveis estão corretas:**
   - Dashboard → Settings → Environment Variables
   - Confirme que não há espaços extras

3. **Verifique o build log:**
   - Dashboard → Deployments → Clique no deploy → View Build Logs
   - Procure por erros relacionados a variáveis de ambiente

### **Como saber se as variáveis estão sendo carregadas?**

Adicione temporariamente no `client.ts`:

```typescript
console.log('ENV Check:', {
  hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  url: import.meta.env.VITE_SUPABASE_URL?.substring(0, 20) + '...'
});
```

Depois do deploy, abra o DevTools e veja o log.

---

## 🎯 Próximos Passos

Após configurar:

1. ✅ Teste todas as funcionalidades principais
2. ✅ Verifique se o login funciona
3. ✅ Teste criar/editar transações
4. ✅ Verifique os relatórios

---

**Configurado com sucesso?** 🎉

Seu app agora deve estar funcionando perfeitamente em produção!
