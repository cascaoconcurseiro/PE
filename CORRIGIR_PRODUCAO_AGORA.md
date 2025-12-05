# ⚡ ERRO DE PRODUÇÃO - SOLUÇÃO RÁPIDA

## 🔴 Problema

```
Supabase URL or Key is missing. Please check .env.local
supabaseUrl is required.
```

**Status:** Você está em **PRODUÇÃO** (Vercel)  
**Causa:** Variáveis de ambiente não configuradas no Vercel  
**Tempo para corrigir:** 5 minutos  

---

## ✅ SOLUÇÃO MAIS RÁPIDA (Via Dashboard)

### **1. Acesse o Vercel**
👉 **https://vercel.com/dashboard**

### **2. Abra seu projeto**
- Clique no projeto **PE** (ou nome similar)

### **3. Vá em Settings → Environment Variables**
- Menu: **Settings**
- Submenu: **Environment Variables**

### **4. Adicione estas 2 variáveis:**

| Name | Value | Environments |
|------|-------|--------------|
| `VITE_SUPABASE_URL` | `https://mlqzeihukezlozooqhko.supabase.co` | ☑ Production ☑ Preview ☑ Development |
| `VITE_SUPABASE_ANON_KEY` | *Pegue do Supabase* | ☑ Production ☑ Preview ☑ Development |

### **5. Obter a chave do Supabase**
👉 **https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api**
- Copie a chave **anon / public** (começa com `eyJ...`)
- Cole no campo `VITE_SUPABASE_ANON_KEY`

### **6. Fazer Redeploy**
- Vá em **Deployments**
- Clique no último deploy → ⋮ → **Redeploy**
- Aguarde 1-2 minutos

### **7. Testar**
- Abra seu site
- Verifique se não há mais erros

---

## 🚀 SOLUÇÃO ALTERNATIVA (Via CLI)

Se preferir usar a linha de comando:

```powershell
# Execute este script
.\configure-vercel.ps1
```

Ou manualmente:

```powershell
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Adicionar variáveis
vercel env add VITE_SUPABASE_URL production
# Cole: https://mlqzeihukezlozooqhko.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Cole a chave do Supabase

# 4. Deploy
vercel --prod
```

---

## 📚 Guias Detalhados

Criamos 3 guias para você:

1. **`CONFIGURAR_VERCEL_AGORA.md`** ⭐ Guia passo a passo com imagens
2. **`GUIA_CONFIGURAR_PRODUCAO.md`** - Guia completo para todas as plataformas
3. **`configure-vercel.ps1`** - Script automatizado

---

## 🎯 Checklist Rápido

- [ ] Acessei https://vercel.com/dashboard
- [ ] Encontrei meu projeto
- [ ] Adicionei `VITE_SUPABASE_URL`
- [ ] Peguei a chave do Supabase
- [ ] Adicionei `VITE_SUPABASE_ANON_KEY`
- [ ] Fiz Redeploy
- [ ] Testei e funciona! 🎉

---

## ❓ Dúvidas Comuns

### **Onde está meu projeto no Vercel?**
- Acesse https://vercel.com/dashboard
- Procure por: `PE`, `pe-de-meia`, ou nome do repositório GitHub

### **Não tenho acesso ao Supabase?**
- Verifique se está logado na conta correta
- Ou peça acesso ao administrador do projeto

### **Erro persiste?**
1. Limpe o cache do Vercel (Redeploy sem cache)
2. Verifique os logs de build
3. Confirme que as variáveis estão corretas

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase API Keys:** https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api
- **Documentação Vercel:** https://vercel.com/docs/environment-variables

---

## 💡 Por que isso aconteceu?

O arquivo `.env.local` só funciona em **desenvolvimento local**.

Em **produção**, você precisa configurar as variáveis de ambiente diretamente na plataforma de hospedagem (Vercel, Netlify, etc).

---

**Criado em:** 2025-12-05  
**Tempo estimado:** 5 minutos  
**Dificuldade:** Fácil ⭐  

🎉 **Boa sorte! Seu app vai funcionar perfeitamente após isso!**
