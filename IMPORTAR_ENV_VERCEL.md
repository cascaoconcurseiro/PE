# ⚡ IMPORTAR .env.local PARA VERCEL

## 🎯 Solução Automática

Este script lê seu arquivo `.env.local` e configura **automaticamente** todas as variáveis no Vercel.

---

## 🚀 USO RÁPIDO

### **1. Execute o script:**

```powershell
.\import-env-to-vercel.ps1
```

### **2. O script vai:**
- ✅ Ler todas as variáveis do `.env.local`
- ✅ Fazer login no Vercel (abre navegador)
- ✅ Linkar seu projeto
- ✅ Importar todas as variáveis para Production, Preview e Development
- ✅ Perguntar se quer fazer deploy
- ✅ Fazer deploy automaticamente (se você confirmar)

### **3. Aguardar:**
- ⏳ 1-2 minutos para o deploy
- ✅ Seu app estará funcionando!

---

## 📋 Pré-requisitos

1. ✅ Arquivo `.env.local` deve existir na raiz do projeto
2. ✅ Deve conter as variáveis do Supabase:
   ```env
   VITE_SUPABASE_URL=https://mlqzeihukezlozooqhko.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-aqui
   ```

---

## 🔍 O que o script faz?

```
1. 📖 Lê .env.local
   ├─ VITE_SUPABASE_URL
   └─ VITE_SUPABASE_ANON_KEY

2. 🔐 Login no Vercel
   └─ Abre navegador para autenticação

3. 📁 Link do projeto
   └─ Conecta com seu projeto no Vercel

4. ⚙️  Importa variáveis
   ├─ Production
   ├─ Preview
   └─ Development

5. 🚀 Deploy (opcional)
   └─ Faz deploy em produção
```

---

## 💡 Exemplo de Saída

```
🚀 IMPORTAR .env.local PARA VERCEL
===================================

✅ Arquivo .env.local encontrado!

📖 Lendo variáveis do .env.local...

📋 Variáveis encontradas:
   VITE_SUPABASE_URL = https://mlqzeihukezlozooqhko.supabase.co
   VITE_SUPABASE_ANON_KEY = ***OCULTO***

✅ Vercel CLI já instalado!

🔐 Fazendo login no Vercel...
> Success! Email authentication complete

📁 Linkando projeto...
> Linked to cascaoconcurseiro/PE

⚙️  Importando variáveis para o Vercel...

📌 Configurando VITE_SUPABASE_URL...
   ✅ VITE_SUPABASE_URL (production) adicionado
   ✅ VITE_SUPABASE_URL (preview) adicionado
   ✅ VITE_SUPABASE_URL (development) adicionado

📌 Configurando VITE_SUPABASE_ANON_KEY...
   ✅ VITE_SUPABASE_ANON_KEY (production) adicionado
   ✅ VITE_SUPABASE_ANON_KEY (preview) adicionado
   ✅ VITE_SUPABASE_ANON_KEY (development) adicionado

✅ Todas as variáveis foram importadas!

Deseja fazer deploy agora? (S/N): S

🚀 Fazendo deploy em produção...

═══════════════════════════════════════════════════════════
🎉 PRONTO! SEU APP ESTÁ SENDO DEPLOYADO!
═══════════════════════════════════════════════════════════
```

---

## ❓ Troubleshooting

### **Erro: .env.local não encontrado**
- Certifique-se de que o arquivo existe na raiz do projeto
- Verifique se o nome está correto (com ponto no início)

### **Erro: Vercel CLI não instalado**
- O script instala automaticamente
- Ou instale manualmente: `npm install -g vercel`

### **Erro: Variável já existe**
- O script pula variáveis que já existem
- Para sobrescrever, delete as variáveis antigas no Vercel Dashboard primeiro

### **Erro: Login falhou**
- Certifique-se de que o navegador abriu
- Faça login manualmente: `vercel login`

---

## 🎯 Checklist

- [ ] Arquivo `.env.local` existe e está preenchido
- [ ] Executei `.\import-env-to-vercel.ps1`
- [ ] Fiz login no Vercel
- [ ] Variáveis foram importadas
- [ ] Confirmei o deploy
- [ ] Aguardei 1-2 minutos
- [ ] Testei o site
- [ ] Funciona! 🎉

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Verificar variáveis:** Settings → Environment Variables

---

**Tempo estimado:** 2 minutos  
**Dificuldade:** Muito Fácil ⭐  

🎉 **A forma mais rápida de configurar tudo!**
