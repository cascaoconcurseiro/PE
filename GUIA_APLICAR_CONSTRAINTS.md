# 🔧 GUIA: Aplicar Constraints SQL no Supabase

## ⚠️ Importante
O script automático detectou que a API RPC não está disponível. As constraints precisam ser aplicadas manualmente via SQL Editor.

---

## 📋 Passo a Passo

### 1️⃣ Abrir o SQL Editor

1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql/new
2. Faça login se necessário
3. Clique em **"New Query"** ou **"SQL Editor"**

---

### 2️⃣ Copiar o Script SQL

Copie **TODO** o conteúdo abaixo:

```sql
-- ========================================
-- CONSTRAINTS DE VALIDAÇÃO
-- ========================================

BEGIN;

-- 1. Transferências não podem ser circulares
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transfer_not_circular;
ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_not_circular
CHECK (type != 'TRANSFERÊNCIA' OR account_id IS DISTINCT FROM destination_account_id);

-- 2. Valor sempre positivo
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_amount_positive
CHECK (amount > 0);

-- 3. Destination amount positivo (se existir)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_destination_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_destination_amount_positive
CHECK (destination_amount IS NULL OR destination_amount > 0);

-- 4. Exchange rate positivo (se existir)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_exchange_rate_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_exchange_rate_positive
CHECK (exchange_rate IS NULL OR exchange_rate > 0);

-- 5. Transferências devem ter conta de destino
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transfer_has_destination;
ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_has_destination
CHECK (type != 'TRANSFERÊNCIA' OR (destination_account_id IS NOT NULL AND destination_account_id != ''));

-- 6. Despesas devem ter conta (exceto se outra pessoa pagou)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_expense_has_account;
ALTER TABLE public.transactions ADD CONSTRAINT check_expense_has_account
CHECK (type != 'DESPESA' OR (payer_id IS NOT NULL AND payer_id != 'me') OR (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL'));

-- 7. Receitas devem ter conta
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_income_has_account;
ALTER TABLE public.transactions ADD CONSTRAINT check_income_has_account
CHECK (type != 'RECEITA' OR (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL'));

COMMIT;

-- Verificar constraints criadas
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
  AND conname LIKE 'check_%'
ORDER BY conname;
```

---

### 3️⃣ Executar o Script

1. Cole o script no SQL Editor
2. Clique em **"Run"** ou pressione `Ctrl+Enter`
3. Aguarde a execução (deve levar 1-2 segundos)

---

### 4️⃣ Verificar Resultado

Você deve ver uma tabela mostrando as 7 constraints criadas:

```
constraint_name                      | definition
-------------------------------------|------------------------------------------
check_amount_positive                | CHECK (amount > 0)
check_destination_amount_positive    | CHECK (destination_amount IS NULL OR ...)
check_exchange_rate_positive         | CHECK (exchange_rate IS NULL OR ...)
check_expense_has_account            | CHECK (type != 'DESPESA' OR ...)
check_income_has_account             | CHECK (type != 'RECEITA' OR ...)
check_transfer_has_destination       | CHECK (type != 'TRANSFERÊNCIA' OR ...)
check_transfer_not_circular          | CHECK (type != 'TRANSFERÊNCIA' OR ...)
```

✅ **Se você vê 7 constraints, está tudo OK!**

---

### 5️⃣ Testar as Constraints

Vamos testar se as constraints estão funcionando:

#### Teste 1: Transferência Circular (deve FALHAR)

```sql
-- Isso deve dar ERRO
INSERT INTO public.transactions (
    id, user_id, date, amount, type, category, description, 
    account_id, destination_account_id
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM public.profiles LIMIT 1),
    CURRENT_DATE,
    100,
    'TRANSFERÊNCIA',
    'Transferência',
    'Teste transferência circular',
    'MESMA_CONTA_ID',
    'MESMA_CONTA_ID'  -- ❌ Mesmo ID da origem
);
```

**Resultado esperado:** ❌ Erro: `violates check constraint "check_transfer_not_circular"`

#### Teste 2: Valor Negativo (deve FALHAR)

```sql
-- Isso deve dar ERRO
INSERT INTO public.transactions (
    id, user_id, date, amount, type, category, description, account_id
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM public.profiles LIMIT 1),
    CURRENT_DATE,
    -100,  -- ❌ Valor negativo
    'DESPESA',
    'Alimentação',
    'Teste valor negativo',
    (SELECT id FROM public.accounts LIMIT 1)
);
```

**Resultado esperado:** ❌ Erro: `violates check constraint "check_amount_positive"`

#### Teste 3: Transação Válida (deve FUNCIONAR)

```sql
-- Isso deve FUNCIONAR
INSERT INTO public.transactions (
    id, user_id, date, amount, type, category, description, account_id
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM public.profiles LIMIT 1),
    CURRENT_DATE,
    50,  -- ✅ Valor positivo
    'DESPESA',
    'Alimentação',
    'Teste válido',
    (SELECT id FROM public.accounts LIMIT 1)
);
```

**Resultado esperado:** ✅ Sucesso: `INSERT 0 1`

---

## ✅ Checklist de Verificação

- [ ] Abri o SQL Editor do Supabase
- [ ] Copiei e executei o script de constraints
- [ ] Vi 7 constraints na tabela de resultado
- [ ] Testei transferência circular (deve falhar)
- [ ] Testei valor negativo (deve falhar)
- [ ] Testei transação válida (deve funcionar)
- [ ] Todas as constraints estão ativas

---

## 🆘 Problemas Comuns

### Erro: "permission denied"
**Solução:** Você precisa ter permissões de administrador no projeto Supabase.

### Erro: "constraint already exists"
**Solução:** Normal! O script usa `DROP IF EXISTS` para evitar duplicatas.

### Constraints não aparecem
**Solução:** 
1. Verifique que executou o `COMMIT`
2. Recarregue a página do SQL Editor
3. Execute a query de verificação novamente

---

## 📊 O que as Constraints Fazem

| Constraint | Proteção |
|------------|----------|
| `check_transfer_not_circular` | Impede A → A |
| `check_amount_positive` | Impede valores ≤ 0 |
| `check_destination_amount_positive` | Impede dest_amount ≤ 0 |
| `check_exchange_rate_positive` | Impede rate ≤ 0 |
| `check_transfer_has_destination` | Transferências têm destino |
| `check_expense_has_account` | Despesas têm conta |
| `check_income_has_account` | Receitas têm conta |

---

**Tempo estimado:** 3-5 minutos  
**Dificuldade:** Fácil  
**Impacto:** Alto - Protege contra dados inválidos
