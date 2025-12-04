# 🔄 RESETAR BANCO VIA LINHA DE COMANDO

## 📋 Opções para Resetar

Você tem a string de conexão:
```
postgresql://postgres:[YOUR_PASSWORD]@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres
```

---

## ✅ Opção 1: Via SQL Editor (MAIS FÁCIL)

### Passo a Passo:

1. **Abra o SQL Editor** (já está aberto):
   - https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql/new

2. **Copie e cole** este script:

```sql
BEGIN;

DELETE FROM public.snapshots;
DELETE FROM public.custom_categories;
DELETE FROM public.family_members;
DELETE FROM public.goals;
DELETE FROM public.budgets;
DELETE FROM public.assets;
DELETE FROM public.trips;
DELETE FROM public.transactions;
DELETE FROM public.accounts;
DELETE FROM public.profiles;

SELECT 
    'profiles' as tabela, COUNT(*) as registros FROM public.profiles
UNION ALL
SELECT 'accounts', COUNT(*) FROM public.accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'trips', COUNT(*) FROM public.trips
UNION ALL
SELECT 'assets', COUNT(*) FROM public.assets
UNION ALL
SELECT 'budgets', COUNT(*) FROM public.budgets
UNION ALL
SELECT 'goals', COUNT(*) FROM public.goals
UNION ALL
SELECT 'family_members', COUNT(*) FROM public.family_members
UNION ALL
SELECT 'custom_categories', COUNT(*) FROM public.custom_categories
UNION ALL
SELECT 'snapshots', COUNT(*) FROM public.snapshots;

COMMIT;
```

3. **Clique em "Run"** ou pressione `Ctrl+Enter`

4. **Verifique** que todas as tabelas têm 0 registros

---

## 🔧 Opção 2: Via psql (Linha de Comando)

### Pré-requisitos:
- PostgreSQL instalado
- Ter a senha do banco

### Comando:

```powershell
# Substitua [YOUR_PASSWORD] pela senha real
psql "postgresql://postgres:[YOUR_PASSWORD]@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres" -f reset-simple.sql
```

### Exemplo:
```powershell
psql "postgresql://postgres:MinhaSenh@123@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres" -f reset-simple.sql
```

---

## 🌐 Opção 3: Via Node.js

### Criar arquivo `reset-db.js`:

```javascript
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:[YOUR_PASSWORD]@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres';

async function resetDatabase() {
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao banco de dados');
        
        // Deletar dados
        await client.query('DELETE FROM public.snapshots');
        await client.query('DELETE FROM public.custom_categories');
        await client.query('DELETE FROM public.family_members');
        await client.query('DELETE FROM public.goals');
        await client.query('DELETE FROM public.budgets');
        await client.query('DELETE FROM public.assets');
        await client.query('DELETE FROM public.trips');
        await client.query('DELETE FROM public.transactions');
        await client.query('DELETE FROM public.accounts');
        await client.query('DELETE FROM public.profiles');
        
        console.log('✅ Todos os dados foram deletados');
        
        // Verificar
        const result = await client.query(`
            SELECT 'profiles' as tabela, COUNT(*) as registros FROM public.profiles
            UNION ALL SELECT 'accounts', COUNT(*) FROM public.accounts
            UNION ALL SELECT 'transactions', COUNT(*) FROM public.transactions
            UNION ALL SELECT 'trips', COUNT(*) FROM public.trips
            UNION ALL SELECT 'assets', COUNT(*) FROM public.assets
            UNION ALL SELECT 'budgets', COUNT(*) FROM public.budgets
            UNION ALL SELECT 'goals', COUNT(*) FROM public.goals
            UNION ALL SELECT 'family_members', COUNT(*) FROM public.family_members
            UNION ALL SELECT 'custom_categories', COUNT(*) FROM public.custom_categories
            UNION ALL SELECT 'snapshots', COUNT(*) FROM public.snapshots
        `);
        
        console.log('\n📊 Resultado:');
        console.table(result.rows);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

resetDatabase();
```

### Executar:
```powershell
node reset-db.js
```

---

## 🔑 Como Obter a Senha

1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/database
2. Vá em **Settings** → **Database**
3. A senha está em **Database Password**
4. Se esqueceu, pode resetar a senha lá mesmo

---

## ✅ Resultado Esperado

Após executar qualquer opção, você deve ver:

```
tabela              | registros
--------------------|----------
profiles            | 0
accounts            | 0
transactions        | 0
trips               | 0
assets              | 0
budgets             | 0
goals               | 0
family_members      | 0
custom_categories   | 0
snapshots           | 0
```

---

## 🎯 Recomendação

**Use a Opção 1 (SQL Editor)** - é a mais fácil e não precisa instalar nada!

1. Já está no SQL Editor
2. Copie o script acima
3. Cole no editor
4. Clique em "Run"
5. Pronto! ✅

---

**Tempo estimado:** 1 minuto  
**Dificuldade:** Fácil
