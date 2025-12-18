# 🔍 ANÁLISE COMPLETA DO SCHEMA SUPABASE

**Data:** 2026-01-28  
**Engenheiro Sênior:** Análise Profunda de Estrutura de Banco de Dados

---

## 📊 RESUMO EXECUTIVO

**Total de Tabelas:** 40+  
**Problemas Críticos:** 8  
**Melhorias Recomendadas:** 15+  
**Otimizações:** 10+

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **DUPLICAÇÃO DE TABELAS DE AUDITORIA**

**Problema:**
- `audit_logs` - Tabela genérica de auditoria
- `transaction_audit` - Tabela específica para transações
- `audit_inconsistencies` - Tabela de inconsistências
- `audit_snapshots` - Snapshots de auditoria

**Análise:**
```sql
-- audit_logs tem campos redundantes:
- entity, entity_id (genérico)
- table_name, record_id (específico)
- changes (jsonb)
- old_values, new_values (jsonb) -- DUPLICADO com changes
```

**Solução:**
```sql
-- Consolidar em uma única tabela de auditoria
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  metadata JSONB, -- IP, user_agent, etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_audit_trail_table_record ON audit_trail(table_name, record_id);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at DESC);
```

---

### 2. **TRANSACTIONS: CAMPOS DUPLICADOS E INCONSISTENTES**

**Problema:**
```sql
-- Campos relacionados a reconciliação (DUPLICADOS):
- reconciled (boolean)
- reconciled_with (text)
- reconciled_at (timestamp)
- reconciled_by (uuid)
- bank_statement_id (uuid)

-- Campos relacionados a settlement (DUPLICADOS):
- is_settled (boolean)
- settled_at (timestamp)
- settled_by_tx_id (uuid)

-- Campos relacionados a relacionamentos (CONFUSOS):
- linked_transaction_id (uuid)
- mirror_transaction_id (uuid)
- source_transaction_id (uuid)
```

**Solução:**
```sql
-- Consolidar em estrutura clara
ALTER TABLE transactions 
  DROP COLUMN IF EXISTS reconciled,
  DROP COLUMN IF EXISTS reconciled_with,
  ADD COLUMN reconciliation_status TEXT DEFAULT 'PENDING' 
    CHECK (reconciliation_status IN ('PENDING', 'RECONCILED', 'DISPUTED')),
  ADD COLUMN reconciliation_metadata JSONB; -- Armazenar bank_statement_id, etc

-- Criar tabela separada para relacionamentos
CREATE TABLE transaction_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  related_transaction_id UUID REFERENCES transactions(id),
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'MIRROR', 'SETTLEMENT', 'INSTALLMENT', 'RECURRING', 'LINKED'
  )),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, related_transaction_id, relationship_type)
);
```

---

### 3. **SPLITS: DUAS ESTRUTURAS DIFERENTES**

**Problema:**
- `transactions.shared_with` (JSONB) - Armazenado na transação
- `transaction_splits` (Tabela separada) - Normalizado

**Análise:**
```sql
-- transactions.shared_with (JSONB) - Flexível mas difícil de consultar
-- transaction_splits (Tabela) - Normalizado mas pode ter inconsistências
```

**Solução:**
```sql
-- MANTER APENAS transaction_splits (normalizado)
-- Remover shared_with de transactions
-- Criar trigger para sincronizar

CREATE OR REPLACE FUNCTION sync_shared_with_from_splits()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar shared_with JSONB quando splits mudarem
  UPDATE transactions
  SET shared_with = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'memberId', member_id,
        'assignedAmount', assigned_amount,
        'percentage', percentage,
        'isSettled', is_settled
      )
    )
    FROM transaction_splits
    WHERE transaction_id = NEW.transaction_id
  )
  WHERE id = NEW.transaction_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_shared_with
AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
FOR EACH ROW EXECUTE FUNCTION sync_shared_with_from_splits();
```

---

### 4. **ACCOUNTS: FALTA DE CONSTRAINTS**

**Problema:**
```sql
-- accounts.type é TEXT sem constraint
-- Pode ter valores inválidos
-- Não há validação de tipos permitidos
```

**Solução:**
```sql
-- Criar ENUM ou constraint
CREATE TYPE account_type_enum AS ENUM (
  'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 
  'CASH', 'LOAN', 'OTHER'
);

ALTER TABLE accounts 
  ALTER COLUMN type TYPE account_type_enum 
  USING type::account_type_enum;

-- Ou usar constraint CHECK
ALTER TABLE accounts
  ADD CONSTRAINT check_account_type 
  CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER'));
```

---

### 5. **TRANSACTIONS: FALTA DE VALIDAÇÃO DE TIPO**

**Problema:**
```sql
-- transactions.type é TEXT sem constraint
-- Pode ter valores inválidos
```

**Solução:**
```sql
ALTER TABLE transactions
  ADD CONSTRAINT check_transaction_type
  CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA'));

-- Ou criar ENUM
CREATE TYPE transaction_type_enum AS ENUM ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA');
```

---

### 6. **LEDGER: ESTRUTURA COMPLEXA E POTENCIALMENTE REDUNDANTE**

**Problema:**
```sql
-- ledger_accounts - Contas do ledger
-- ledger_entries - Entradas do ledger
-- journal_entries - Entradas do diário
-- chart_of_accounts - Plano de contas

-- Múltiplas estruturas para mesma coisa
```

**Análise:**
- `ledger_accounts` parece ser cache de saldos
- `ledger_entries` são as partidas dobradas
- `journal_entries` parece duplicado com `ledger_entries`
- `chart_of_accounts` é plano de contas (OK, diferente)

**Solução:**
```sql
-- Consolidar journal_entries em ledger_entries
-- Manter apenas ledger_entries como fonte de verdade
-- ledger_accounts como cache (OK, mas precisa sincronizar)

-- Verificar se journal_entries é usado
-- Se não, remover
-- Se sim, migrar para ledger_entries
```

---

### 7. **ASSETS: account_id COMO TEXT**

**Problema:**
```sql
-- assets.account_id é TEXT, não UUID
-- Deveria ser UUID com FK
```

**Solução:**
```sql
-- Converter para UUID
ALTER TABLE assets
  ALTER COLUMN account_id TYPE UUID 
  USING account_id::uuid;

-- Adicionar FK
ALTER TABLE assets
  ADD CONSTRAINT fk_assets_account
  FOREIGN KEY (account_id) REFERENCES accounts(id);
```

---

### 8. **CREDIT_CARDS: TABELA SEPARADA DESNECESSÁRIA**

**Problema:**
```sql
-- credit_cards é tabela separada
-- Mas accounts já tem type='CREDIT_CARD'
-- Redundância desnecessária
```

**Solução:**
```sql
-- Remover tabela credit_cards
-- Usar apenas accounts com type='CREDIT_CARD'
-- Migrar dados se necessário
```

---

## 🟡 MELHORIAS RECOMENDADAS

### 9. **ÍNDICES FALTANDO**

**Problema:**
- Muitas queries sem índices adequados
- Performance pode ser melhorada

**Solução:**
```sql
-- Índices críticos para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
  ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account 
  ON transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_type 
  ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted 
  ON transactions(deleted) WHERE deleted = false;

-- Índices para splits
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction 
  ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_member 
  ON transaction_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_settled 
  ON transaction_splits(is_settled) WHERE is_settled = false;

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_type 
  ON accounts(user_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted 
  ON accounts(deleted) WHERE deleted = false;
```

---

### 10. **CONSTRAINTS DE INTEGRIDADE**

**Problema:**
- Falta de constraints CHECK
- Validações apenas no código

**Solução:**
```sql
-- Validar valores monetários
ALTER TABLE transactions
  ADD CONSTRAINT check_amount_positive 
  CHECK (amount > 0);

-- Validar parcelas
ALTER TABLE transactions
  ADD CONSTRAINT check_installments
  CHECK (
    (is_installment = false) OR 
    (is_installment = true AND total_installments > 0 AND 
     current_installment > 0 AND current_installment <= total_installments)
  );

-- Validar transferências
ALTER TABLE transactions
  ADD CONSTRAINT check_transfer_destination
  CHECK (
    (type != 'TRANSFERÊNCIA') OR 
    (type = 'TRANSFERÊNCIA' AND destination_account_id IS NOT NULL)
  );

-- Validar splits
CREATE OR REPLACE FUNCTION validate_transaction_splits()
RETURNS TRIGGER AS $$
DECLARE
  total_amount NUMERIC;
  splits_sum NUMERIC;
BEGIN
  SELECT amount INTO total_amount FROM transactions WHERE id = NEW.transaction_id;
  
  SELECT COALESCE(SUM(assigned_amount), 0) INTO splits_sum
  FROM transaction_splits
  WHERE transaction_id = NEW.transaction_id;
  
  IF splits_sum > total_amount + 0.01 THEN
    RAISE EXCEPTION 'Soma dos splits (%) excede o total da transação (%)', splits_sum, total_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_splits
AFTER INSERT OR UPDATE ON transaction_splits
FOR EACH ROW EXECUTE FUNCTION validate_transaction_splits();
```

---

### 11. **VIEWS DE DIAGNÓSTICO**

**Problema:**
- Views de diagnóstico existem mas podem ser melhoradas

**Solução:**
```sql
-- View consolidada de saúde do sistema
CREATE OR REPLACE VIEW view_system_health AS
SELECT 
  'ORPHAN_TRANSACTIONS' as issue_type,
  COUNT(*) as count
FROM transactions t
WHERE t.account_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.deleted = false)
  AND t.deleted = false

UNION ALL

SELECT 
  'INVALID_SPLITS' as issue_type,
  COUNT(*) as count
FROM transactions t
WHERE t.is_shared = true
  AND EXISTS (
    SELECT 1 
    FROM transaction_splits ts
    WHERE ts.transaction_id = t.id
    GROUP BY ts.transaction_id
    HAVING SUM(ts.assigned_amount) > t.amount + 0.01
  )

UNION ALL

SELECT 
  'BALANCE_MISMATCH' as issue_type,
  COUNT(*) as count
FROM accounts a
WHERE a.balance IS NOT NULL
  AND ABS(a.balance - COALESCE((
    SELECT SUM(
      CASE 
        WHEN t.type = 'RECEITA' THEN t.amount
        WHEN t.type = 'DESPESA' THEN -t.amount
        WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
        WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN t.amount
        ELSE 0
      END
    )
    FROM transactions t
    WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
      AND t.deleted = false
  ), 0)) > 0.01;
```

---

### 12. **SOFT DELETE CONSISTENTE**

**Problema:**
- Algumas tabelas têm `deleted`, outras não
- Inconsistência no padrão

**Solução:**
```sql
-- Adicionar deleted em todas as tabelas principais
ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
-- etc...

-- Criar índice parcial para queries
CREATE INDEX idx_transactions_active 
  ON transactions(user_id, date DESC) 
  WHERE deleted = false;
```

---

### 13. **TIMESTAMPS AUTOMÁTICOS**

**Problema:**
- Algumas tabelas não têm `updated_at` automático

**Solução:**
```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas
CREATE TRIGGER trg_update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repetir para outras tabelas...
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Prioridade CRÍTICA
- [ ] Consolidar tabelas de auditoria
- [ ] Limpar campos duplicados em transactions
- [ ] Adicionar constraints de tipo (ENUM ou CHECK)
- [ ] Converter assets.account_id para UUID
- [ ] Adicionar índices críticos

### Prioridade ALTA
- [ ] Consolidar journal_entries com ledger_entries
- [ ] Remover tabela credit_cards (usar accounts)
- [ ] Adicionar constraints de integridade
- [ ] Criar triggers de validação
- [ ] Melhorar views de diagnóstico

### Prioridade MÉDIA
- [ ] Padronizar soft delete
- [ ] Adicionar updated_at automático
- [ ] Otimizar queries com índices
- [ ] Documentar relacionamentos

---

## 🎯 RESULTADO ESPERADO

Após implementar:
1. ✅ **Schema Limpo** - Sem redundâncias
2. ✅ **Integridade Garantida** - Constraints e triggers
3. ✅ **Performance Otimizada** - Índices adequados
4. ✅ **Manutenibilidade** - Estrutura clara e documentada
5. ✅ **Escalabilidade** - Preparado para crescimento

---

## 📚 PRÓXIMOS PASSOS

1. Criar migration de consolidação
2. Testar em ambiente de desenvolvimento
3. Fazer backup antes de aplicar
4. Aplicar gradualmente (não tudo de uma vez)
5. Monitorar performance após mudanças

