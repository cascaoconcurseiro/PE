# ⚡ CONFIGURAÇÃO RÁPIDA - COPIAR E COLAR

## 🎯 Variáveis para Adicionar no Vercel

Acesse: **https://vercel.com/dashboard**
→ Seu projeto **PE**
→ **Settings** → **Environment Variables**

---

## ✅ ADICIONE ESTAS 2 VARIÁVEIS:

### **Variável 1: VITE_SUPABASE_URL**

```
Name: VITE_SUPABASE_URL
Value: https://mlqzeihukezlozooqhko.supabase.co
Environments: ☑ Production ☑ Preview ☑ Development
```

### **Variável 2: VITE_SUPABASE_ANON_KEY**

```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scXplaWh1a2V6bG96b29xaGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NDUzNTIsImV4cCI6MjA3ODUyMTM1Mn0.a5c7KqOcW3PVG8HpSoRXXkTX2x1ziHlTW0fmlatWGZg
Environments: ☑ Production ☑ Preview ☑ Development
```

---

## 🚀 DEPOIS DE ADICIONAR:

1. Vá em **Deployments**
2. Clique no último deployment
3. Clique nos **3 pontinhos** (⋮)
4. Clique **Redeploy**
5. Aguarde 1-2 minutos
6. **PRONTO!** 🎉

---

## 📋 Passo a Passo Visual:

### **1. Abrir Vercel Dashboard**
```
https://vercel.com/dashboard
```

### **2. Clicar no projeto PE**
(ou nome similar do seu projeto)

### **3. Ir em Settings**
(Menu superior)

### **4. Clicar em Environment Variables**
(Menu lateral esquerdo)

### **5. Clicar em "Add New"**

### **6. Preencher primeira variável:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://mlqzeihukezlozooqhko.supabase.co`
- Marcar: Production, Preview, Development
- Clicar **Save**

### **7. Clicar em "Add New" novamente**

### **8. Preencher segunda variável:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scXplaWh1a2V6bG96b29xaGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NDUzNTIsImV4cCI6MjA3ODUyMTM1Mn0.a5c7KqOcW3PVG8HpSoRXXkTX2x1ziHlTW0fmlatWGZg`
- Marcar: Production, Preview, Development
- Clicar **Save**

### **9. Fazer Redeploy:**
- Clicar em **Deployments** (menu superior)
- Clicar no deployment mais recente
- Clicar nos **3 pontinhos** (⋮)
- Clicar **Redeploy**
- Confirmar

### **10. Aguardar e Testar:**
- Aguardar 1-2 minutos
- Acessar seu site
- Verificar se não há mais erros
- **FUNCIONA!** 🎉

---

## ⚠️ IMPORTANTE:

**Seu projeto usa VITE, não Next.js!**

- ✅ Use: `VITE_SUPABASE_URL`
- ✅ Use: `VITE_SUPABASE_ANON_KEY`
- ❌ NÃO use: `NEXT_PUBLIC_SUPABASE_URL`
- ❌ NÃO use: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 📝 Arquivo .env.local Atualizado

Também criei um arquivo `.env.local.vite` com as variáveis corretas.

Para usar localmente:
```powershell
# Renomear o arquivo
mv .env.local.vite .env.local

# Ou copiar o conteúdo
code .env.local.vite
```

---

**Tempo estimado:** 3 minutos  
**Dificuldade:** Muito Fácil ⭐  

🎯 **FAÇA AGORA E SEU APP VAI FUNCIONAR!**
