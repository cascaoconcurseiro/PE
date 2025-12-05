# 🚀 CONFIGURAÇÃO RÁPIDA - PRODUÇÃO (VERCEL)

## ⚡ Ação Imediata

Você está recebendo este erro em **PRODUÇÃO**:
```
Supabase URL or Key is missing
```

**Causa:** Variáveis de ambiente não configuradas no Vercel.

---

## ✅ SOLUÇÃO EM 3 PASSOS

### **PASSO 1: Acessar Vercel Dashboard**

1. Abra: **https://vercel.com/dashboard**
2. Faça login (se necessário)
3. Clique no projeto **PE** (ou o nome do seu projeto)

---

### **PASSO 2: Adicionar Variáveis de Ambiente**

1. No projeto, clique em **Settings** (topo da página)
2. No menu lateral esquerdo, clique em **Environment Variables**
3. Adicione as seguintes variáveis:

#### **Variável 1: VITE_SUPABASE_URL**

- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://mlqzeihukezlozooqhko.supabase.co`
- **Environment:** Selecione **TODOS** (Production, Preview, Development)
- Clique em **Save**

#### **Variável 2: VITE_SUPABASE_ANON_KEY**

- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Você precisa pegar do Supabase (veja abaixo)
- **Environment:** Selecione **TODOS** (Production, Preview, Development)
- Clique em **Save**

---

### **PASSO 3: Obter a Chave do Supabase**

1. Abra em outra aba: **https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api**
2. Na seção **Project API keys**, copie a chave **anon / public**
   - Ela começa com `eyJ...`
   - É uma chave longa (várias linhas)
3. Cole no campo **Value** da variável `VITE_SUPABASE_ANON_KEY` no Vercel
4. Clique em **Save**

---

### **PASSO 4: Fazer Redeploy**

1. No Vercel, vá em **Deployments** (topo da página)
2. Clique no **último deployment** (o mais recente)
3. Clique nos **3 pontinhos** (⋮) no canto superior direito
4. Clique em **Redeploy**
5. Confirme clicando em **Redeploy** novamente
6. Aguarde 1-2 minutos

---

## 🎯 Verificar se Funcionou

1. Aguarde o deploy terminar (fica verde ✅)
2. Clique em **Visit** para abrir o site
3. Abra o **DevTools** (F12)
4. Vá na aba **Console**
5. Se não houver erros de Supabase, está funcionando! 🎉

---

## 📸 Referência Visual

### Como deve ficar no Vercel:

```
Environment Variables
┌─────────────────────────────────────────────────────────────┐
│ Name: VITE_SUPABASE_URL                                     │
│ Value: https://mlqzeihukezlozooqhko.supabase.co            │
│ Environments: ☑ Production ☑ Preview ☑ Development         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Name: VITE_SUPABASE_ANON_KEY                                │
│ Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...             │
│ Environments: ☑ Production ☑ Preview ☑ Development         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Alternativa: Via CLI (Avançado)

Se preferir usar a linha de comando:

```powershell
# 1. Instalar Vercel CLI (se não tiver)
npm i -g vercel

# 2. Fazer login
vercel login

# 3. Linkar o projeto (na pasta do projeto)
cd c:\Users\Wesley\dyad-apps\PE
vercel link

# 4. Adicionar variáveis
vercel env add VITE_SUPABASE_URL production
# Quando pedir, cole: https://mlqzeihukezlozooqhko.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Quando pedir, cole a chave do Supabase

# 5. Fazer deploy
vercel --prod
```

---

## ❓ Troubleshooting

### **Erro persiste após configurar**

1. **Limpe o cache:**
   - Vercel Dashboard → Deployments
   - Clique no deployment → ⋮ → Redeploy
   - **DESMARQUE** "Use existing Build Cache"
   - Clique em Redeploy

2. **Verifique as variáveis:**
   - Settings → Environment Variables
   - Confirme que não há espaços extras
   - Confirme que selecionou "Production"

3. **Verifique os logs:**
   - Deployments → Clique no deployment
   - Veja o **Build Log**
   - Procure por erros

### **Não sei qual é meu projeto no Vercel**

1. Acesse: https://vercel.com/dashboard
2. Procure por um projeto com nome similar a:
   - `PE`
   - `pe-de-meia`
   - `dyad-apps-pe`
   - Ou o nome do seu repositório GitHub

### **Não tenho acesso ao Supabase**

Se você não tem acesso ao dashboard do Supabase:
1. Verifique se está logado com a conta correta
2. Peça acesso ao administrador do projeto
3. Ou crie um novo projeto Supabase e execute o schema

---

## 📋 Checklist Final

- [ ] Acessei o Vercel Dashboard
- [ ] Encontrei meu projeto
- [ ] Adicionei `VITE_SUPABASE_URL`
- [ ] Adicionei `VITE_SUPABASE_ANON_KEY`
- [ ] Selecionei "Production" em ambas
- [ ] Fiz Redeploy
- [ ] Aguardei o deploy terminar
- [ ] Testei o site e não há mais erros

---

## 🎉 Pronto!

Após seguir estes passos, seu aplicativo deve estar funcionando perfeitamente em produção!

**Tempo estimado:** 5 minutos  
**Dificuldade:** Fácil  

---

**Precisa de ajuda?** Verifique os logs de build no Vercel ou abra o console do navegador para mais detalhes do erro.
