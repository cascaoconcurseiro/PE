# 🔧 GUIA: Configurar Variáveis de Ambiente (.env.local)

## ⚠️ Problema
O aplicativo está mostrando o erro:
```
Supabase URL or Key is missing. Please check .env.local
```

Isso significa que o arquivo `.env.local` não existe ou está vazio.

---

## 📋 Solução Rápida

### 1️⃣ Criar o arquivo `.env.local`

Crie um arquivo chamado `.env.local` na raiz do projeto (`c:\Users\Wesley\dyad-apps\PE\.env.local`)

### 2️⃣ Adicionar as credenciais

Cole o seguinte conteúdo no arquivo:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://mlqzeihukezlozooqhko.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_AQUI

# Database Connection (for scripts)
DATABASE_URL=postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

### 3️⃣ Obter a chave ANON_KEY

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto **mlqzeihukezlozooqhko**
3. Vá em **Settings** (Configurações) no menu lateral
4. Clique em **API**
5. Copie a chave **anon** / **public**
6. Cole no lugar de `SUA_CHAVE_ANON_AQUI`

---

## 🎯 Passo a Passo Detalhado

### Opção 1: Criar via VS Code

1. No VS Code, clique com botão direito na pasta raiz
2. Selecione **New File**
3. Digite: `.env.local`
4. Cole o conteúdo acima
5. Substitua `SUA_CHAVE_ANON_AQUI` pela chave real
6. Salve o arquivo (Ctrl+S)

### Opção 2: Criar via PowerShell

```powershell
# Navegar até a pasta do projeto
cd c:\Users\Wesley\dyad-apps\PE

# Criar o arquivo
New-Item -Path ".env.local" -ItemType File -Force

# Abrir no notepad
notepad .env.local
```

Depois cole o conteúdo e salve.

---

## 🔑 Como Obter as Credenciais do Supabase

### URL do Projeto
Já temos: `https://mlqzeihukezlozooqhko.supabase.co`

### Chave ANON (Public Key)

1. **Acesse o Dashboard:**
   - https://supabase.com/dashboard/project/mlqzeihukezlozooqhko

2. **Vá em Settings → API:**
   - Menu lateral: **Settings** (ícone de engrenagem)
   - Submenu: **API**

3. **Copie a chave:**
   - Procure por **Project API keys**
   - Copie a chave **anon** / **public**
   - Ela começa com `eyJ...`

4. **Cole no .env.local:**
   ```env
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## ✅ Verificar se Funcionou

Após criar o arquivo `.env.local`:

1. **Reinicie o servidor de desenvolvimento:**
   ```powershell
   # Parar o servidor (Ctrl+C)
   # Iniciar novamente
   npm run dev
   ```

2. **Recarregue a página** (F5)

3. **Verifique o console:**
   - Não deve mais aparecer o erro
   - O app deve carregar normalmente

---

## 🔒 Segurança

- ✅ O arquivo `.env.local` está no `.gitignore`
- ✅ Nunca faça commit deste arquivo
- ✅ A chave ANON é pública (pode ser exposta no frontend)
- ⚠️ Nunca exponha a chave SERVICE_ROLE

---

## 📝 Exemplo Completo

Arquivo `.env.local` completo:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://mlqzeihukezlozooqhko.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scXplaWh1a2V6bG96b29xaGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI4MjU4NzAsImV4cCI6MjA0ODQwMTg3MH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Database Connection (for scripts)
DATABASE_URL=postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

**Importante:** Substitua os `XXXX` pela chave real do Supabase!

---

## 🆘 Problemas Comuns

### Erro persiste após criar .env.local
**Solução:** Reinicie o servidor de desenvolvimento (Ctrl+C e `npm run dev`)

### Não encontro a chave no Supabase
**Solução:** 
1. Verifique se está logado
2. Verifique se selecionou o projeto correto
3. A chave está em: Settings → API → Project API keys → anon

### Arquivo .env.local não é reconhecido
**Solução:** 
1. Certifique-se que o arquivo está na raiz do projeto
2. Certifique-se que o nome é exatamente `.env.local` (com o ponto no início)
3. Reinicie o VS Code

---

**Data:** 2025-12-04  
**Tempo estimado:** 2 minutos  
**Dificuldade:** Fácil
