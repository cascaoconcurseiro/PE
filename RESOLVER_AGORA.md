# ⚡ RESOLVER AGORA - 3 MINUTOS

## 🔴 Erro Atual

```
supabaseUrl is required
```

**Significado:** Variáveis de ambiente não configuradas no Vercel.

---

## ✅ SOLUÇÃO EM 3 PASSOS

### **PASSO 1: Abrir Vercel**
👉 **https://vercel.com/dashboard**

### **PASSO 2: Configurar Variáveis**

1. Clique no seu projeto **PE**
2. Clique em **Settings** (topo)
3. Clique em **Environment Variables** (menu lateral)
4. Clique em **Add New**

**Adicione estas 2 variáveis:**

#### Variável 1:
```
Name: VITE_SUPABASE_URL
Value: https://mlqzeihukezlozooqhko.supabase.co
Environments: ☑ Production ☑ Preview ☑ Development
```
Clique **Save**

#### Variável 2:
```
Name: VITE_SUPABASE_ANON_KEY
Value: [PEGUE DO SUPABASE - VEJA ABAIXO]
Environments: ☑ Production ☑ Preview ☑ Development
```
Clique **Save**

### **PASSO 3: Pegar Chave do Supabase**

1. Abra em outra aba: 👉 **https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api**
2. Procure por **"Project API keys"**
3. Copie a chave **anon / public** (começa com `eyJ...`)
4. Cole no campo **Value** da Variável 2 acima
5. Clique **Save**

### **PASSO 4: Redeploy**

1. No Vercel, clique em **Deployments** (topo)
2. Clique no último deployment
3. Clique nos **3 pontinhos** (⋮) no canto
4. Clique em **Redeploy**
5. Confirme clicando **Redeploy** novamente

### **PASSO 5: Aguardar**

⏳ Aguarde 1-2 minutos

✅ Acesse seu site e teste!

---

## 🤖 ALTERNATIVA: Script Automático

Se preferir usar script:

```powershell
.\quick-vercel-setup.ps1
```

Ele vai:
1. Pedir a chave do Supabase
2. Configurar tudo automaticamente
3. Fazer deploy

---

## 📋 Checklist

- [ ] Acessei https://vercel.com/dashboard
- [ ] Encontrei meu projeto
- [ ] Adicionei `VITE_SUPABASE_URL`
- [ ] Peguei chave do Supabase
- [ ] Adicionei `VITE_SUPABASE_ANON_KEY`
- [ ] Fiz Redeploy
- [ ] Aguardei 1-2 minutos
- [ ] Testei o site
- [ ] Funciona! 🎉

---

## 🆘 Precisa de Ajuda?

**Não encontra o projeto no Vercel?**
- Procure por: PE, pe-de-meia, ou nome do repositório

**Não consegue acessar o Supabase?**
- Verifique se está logado na conta correta
- URL direta: https://supabase.com/dashboard

**Erro persiste após configurar?**
- Limpe o cache: Redeploy sem "Use existing Build Cache"
- Verifique se as variáveis foram salvas corretamente

---

**Tempo estimado:** 3 minutos  
**Dificuldade:** Muito Fácil ⭐  

🎯 **FAÇA AGORA!** Seu app vai funcionar perfeitamente após isso!
