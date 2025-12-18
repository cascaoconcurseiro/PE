# 🚀 INSTRUÇÕES DE DEPLOY

## ✅ O QUE JÁ É AUTOMÁTICO

- ✅ **Frontend (Vercel)**: Push para GitHub → Deploy automático no Vercel
- ✅ **Código TypeScript/React**: Todas as mudanças no frontend serão deployadas automaticamente

## ⚠️ O QUE PRECISA SER FEITO MANUALMENTE

### 1. Executar Migration no Supabase

A migration SQL **NÃO é executada automaticamente** pelo GitHub/Vercel. Você precisa executá-la manualmente no Supabase.

#### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
2. Abra o arquivo: `supabase/migrations/20260127_consolidacao_final_rpc_e_balance.sql`
3. Copie todo o conteúdo
4. Cole no editor SQL do Supabase
5. Clique em **"Run"**

#### Opção B: Via Supabase CLI (Se você usa)

```bash
# Se você tem Supabase CLI configurado localmente
supabase db push
```

### 2. Verificar se Migration Foi Executada

Execute no Supabase SQL Editor:

```sql
-- Verificar se trigger existe e está ativo
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trg_update_account_balance';

-- Deve retornar: trg_update_account_balance | O (O = Enabled)
```

### 3. Sincronizar Saldos Existentes (Opcional)

A migration já executa `recalculate_all_balances()` automaticamente, mas se quiser rodar novamente:

```sql
SELECT public.recalculate_all_balances();
```

---

## 📋 CHECKLIST DE DEPLOY

### Frontend (Automático via GitHub → Vercel)
- [x] Código TypeScript modificado
- [ ] Fazer commit e push para GitHub
- [ ] Vercel fará deploy automaticamente

### Backend (Manual no Supabase)
- [ ] Executar migration `20260127_consolidacao_final_rpc_e_balance.sql` no Supabase
- [ ] Verificar se trigger está ativo
- [ ] Testar criação de transação para verificar se saldo atualiza

---

## 🧪 TESTES PÓS-DEPLOY

Após executar a migration e o deploy do frontend:

1. **Teste de Saldo:**
   - Abrir aplicação
   - Verificar se saldos aparecem corretos desde o início (sem flicker)
   - Criar uma transação
   - Verificar se saldo atualiza automaticamente

2. **Teste de Performance:**
   - Abrir console do navegador
   - Verificar se não há erros
   - Verificar se carregamento está mais rápido

3. **Teste de Consistência:**
   - Criar transação de receita
   - Verificar se saldo aumenta
   - Criar transação de despesa
   - Verificar se saldo diminui
   - Criar transferência
   - Verificar se ambas as contas atualizam

---

## ⚠️ IMPORTANTE

- A migration **deve ser executada ANTES** de usar o sistema após o deploy
- Se não executar a migration, o sistema pode ter erros ao criar/atualizar transações
- A migration é **idempotente** (pode ser executada múltiplas vezes sem problemas)

---

## 🔄 SE ALGO DER ERRADO

### Rollback da Migration

Se precisar reverter (não recomendado, mas possível):

```sql
-- Desabilitar trigger temporariamente
ALTER TABLE public.transactions DISABLE TRIGGER trg_update_account_balance;

-- Reverter para cálculo manual (se necessário)
-- Mas isso quebraria a sincronização frontend/backend
```

### Verificar Status

```sql
-- Ver todas as funções RPC
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname IN ('create_transaction', 'update_transaction')
ORDER BY proname, pronargs;

-- Ver triggers ativos
SELECT tgname, tgenabled, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE '%balance%';
```

