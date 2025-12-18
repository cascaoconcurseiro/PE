# 🧹 LIMPEZA E MELHORIAS PARA SISTEMA FINANCEIRO CONFIÁVEL

**Data:** 2026-01-27 (Atualizado: 2025-12-18)  
**Objetivo:** Identificar o que pode ser limpo e melhorias para estabilidade  
**Status:** ✅ CONCLUÍDO

---

## 🗑️ ARQUIVOS QUE PODEM SER REMOVIDOS (SEGUROS)

### ✅ Arquivos de Debug/Deploy Antigos (Raiz do Projeto)

**Pode remover com segurança:**
```
❌ debug_data_dump.sql
❌ debug_inspect.sql
❌ errors_v2.txt
❌ errors.log
❌ errors.txt
❌ fix_phantom.sql
❌ force-link-trips-v2.sql
❌ force-link-trips.sql
❌ deployment.log
❌ lighthouse-report.json
❌ metadata.json
❌ ms-azuretools.vscode-docker-2.0.0.vsix
```

**Scripts de deploy antigos (manter apenas se ainda usar):**
```
⚠️ deploy_debug_data.mjs
⚠️ deploy_inspect.mjs
⚠️ deploy_master.mjs
⚠️ deploy_phantom.mjs
⚠️ deploy_repair.mjs
⚠️ deploy-force-link.mjs
⚠️ deploy-shared-fix-final.mjs
⚠️ deploy-trip-provision.mjs
⚠️ check-trips-schema.mjs
⚠️ run_migration_final.mjs
```

**Recomendação:** Mover para `scripts/archive/` ou remover se não usar mais.

---

### ✅ Migrations Antigas no Supabase

**Migrations que podem ser arquivadas (já consolidadas):**

Todas as migrations de `20260101` até `20260126` podem ser arquivadas, pois foram consolidadas em:
- ✅ `20260127_consolidacao_final_rpc_e_balance.sql` (versão definitiva)

**Ação recomendada:**
1. Mover migrations antigas para `supabase/migrations/archive/2026-01-27_consolidacao/`
2. Manter apenas:
   - `20260101_golden_schema.sql` (schema base)
   - `20260127_consolidacao_final_rpc_e_balance.sql` (consolidação)
   - `20260201_ddd_ledger_structure.sql` (estrutura DDD)
   - `20260202_ddd_reporting_views.sql` (views de relatórios)
   - Migrations de diagnóstico (se ainda usar)

**⚠️ IMPORTANTE:** Não deletar migrations do banco! Apenas arquivar no sistema de arquivos.

---

### ✅ Código Frontend Obsoleto

**Arquivos que podem ser removidos ou simplificados:**

1. **`src/services/balanceEngine.ts`** - Função `calculateBalances()`
   - ❌ **Remover:** Não é mais usada (backend calcula saldos)
   - ✅ **Manter:** `calculateTripDebts()` (ainda é usada)

2. **Código comentado extenso:**
   - Limpar comentários antigos e código morto
   - Manter apenas comentários úteis

3. **Hooks não utilizados:**
   - Verificar se todos os hooks em `src/hooks/` estão sendo usados
   - Remover hooks órfãos

---

## 🔒 MELHORIAS PARA SISTEMA FINANCEIRO CONFIÁVEL

### 1. ✅ VALIDAÇÕES E INTEGRIDADE DE DADOS

#### Backend (Supabase)

**Adicionar Constraints Mais Rígidas:**

```sql
-- 1. Garantir que saldos não sejam negativos (exceto cartão de crédito)
ALTER TABLE accounts 
ADD CONSTRAINT check_balance_positive 
CHECK (
  (type != 'CREDIT_CARD' AND balance >= 0) OR 
  (type = 'CREDIT_CARD')
);

-- 2. Garantir que valores de transação sejam positivos
ALTER TABLE transactions 
ADD CONSTRAINT check_amount_positive 
CHECK (amount > 0);

-- 3. Garantir que transferências tenham destino
ALTER TABLE transactions 
ADD CONSTRAINT check_transfer_has_destination 
CHECK (
  type != 'TRANSFERÊNCIA' OR 
  (type = 'TRANSFERÊNCIA' AND destination_account_id IS NOT NULL)
);

-- 4. Garantir que parcelas sejam consistentes
ALTER TABLE transactions 
ADD CONSTRAINT check_installment_consistency 
CHECK (
  (is_installment = false) OR 
  (is_installment = true AND total_installments > 0 AND current_installment > 0)
);
```

#### Frontend

**Adicionar Validações Antes de Enviar:**

```typescript
// src/services/validationService.ts - Expandir validações
export const validateTransaction = (tx: Transaction): ValidationResult => {
  const errors: string[] = [];
  
  // Validações críticas
  if (tx.amount <= 0) errors.push('Valor deve ser maior que zero');
  if (!tx.description?.trim()) errors.push('Descrição obrigatória');
  if (tx.type === 'TRANSFERÊNCIA' && !tx.destinationAccountId) {
    errors.push('Transferência requer conta de destino');
  }
  
  // Validação de parcelas
  if (tx.isInstallment) {
    if (!tx.totalInstallments || tx.totalInstallments < 2) {
      errors.push('Parcelas devem ter pelo menos 2 parcelas');
    }
    if (tx.currentInstallment && tx.currentInstallment > tx.totalInstallments) {
      errors.push('Parcela atual não pode ser maior que total de parcelas');
    }
  }
  
  return { valid: errors.length === 0, errors };
};
```

---

### 2. ✅ AUDITORIA E RASTREABILIDADE

#### Backend

**Adicionar Tabela de Auditoria (se não existir):**

```sql
-- Tabela de auditoria para transações críticas
CREATE TABLE IF NOT EXISTS transaction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para auditoria automática
CREATE OR REPLACE FUNCTION audit_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO transaction_audit (transaction_id, user_id, action, old_values)
    VALUES (OLD.id, OLD.user_id, 'DELETE', row_to_json(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO transaction_audit (transaction_id, user_id, action, old_values, new_values)
    VALUES (NEW.id, NEW.user_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO transaction_audit (transaction_id, user_id, action, new_values)
    VALUES (NEW.id, NEW.user_id, 'CREATE', row_to_json(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION audit_transaction_changes();
```

---

### 3. ✅ TRATAMENTO DE ERROS ROBUSTO

#### Frontend

**Sistema de Erros Centralizado:**

```typescript
// src/services/errorHandler.ts
export class FinancialError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'FinancialError';
  }
}

export const handleDatabaseError = (error: any): FinancialError => {
  // Mapear erros do Supabase para erros amigáveis
  if (error.code === '23505') { // Unique violation
    return new FinancialError(
      'Já existe um registro com esses dados.',
      'DUPLICATE',
      true
    );
  }
  if (error.code === '23503') { // Foreign key violation
    return new FinancialError(
      'Referência inválida. Verifique se a conta ainda existe.',
      'INVALID_REFERENCE',
      true
    );
  }
  // ... outros erros
  return new FinancialError(
    'Erro ao processar operação. Tente novamente.',
    'UNKNOWN',
    false
  );
};
```

---

### 4. ✅ BACKUP E RECUPERAÇÃO

#### Backend

**Função de Backup Automático:**

```sql
-- Função para criar snapshot de segurança
CREATE OR REPLACE FUNCTION create_safety_snapshot()
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID := gen_random_uuid();
  v_user_id UUID := auth.uid();
BEGIN
  -- Criar snapshot de contas
  INSERT INTO snapshots (id, user_id, type, data, created_at)
  SELECT 
    v_snapshot_id,
    v_user_id,
    'FULL_BACKUP',
    jsonb_build_object(
      'accounts', (SELECT jsonb_agg(row_to_json(a)) FROM accounts a WHERE a.user_id = v_user_id),
      'transactions', (SELECT jsonb_agg(row_to_json(t)) FROM transactions t WHERE t.user_id = v_user_id LIMIT 1000)
    ),
    NOW();
  
  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Frontend

**Sistema de Backup Local (IndexedDB):**

```typescript
// src/services/backupService.ts
export const backupToLocal = async (data: any) => {
  const db = await openDB('financial_backup', 1);
  await db.put('backups', {
    id: Date.now(),
    data,
    timestamp: new Date().toISOString()
  });
};

export const restoreFromLocal = async (backupId: number) => {
  const db = await openDB('financial_backup', 1);
  return await db.get('backups', backupId);
};
```

---

### 5. ✅ TESTES E VALIDAÇÃO

#### Backend

**Funções de Validação de Integridade:**

```sql
-- Função para verificar integridade de saldos
CREATE OR REPLACE FUNCTION verify_balance_integrity(p_user_id UUID)
RETURNS TABLE (
  account_id UUID,
  stored_balance NUMERIC,
  calculated_balance NUMERIC,
  discrepancy NUMERIC,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH calculated AS (
    SELECT 
      a.id,
      a.balance as stored,
      COALESCE(a.initial_balance, 0) + 
      COALESCE(SUM(CASE 
        WHEN t.type = 'RECEITA' THEN t.amount
        WHEN t.type = 'DESPESA' THEN -t.amount
        WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
        WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN COALESCE(t.destination_amount, t.amount)
        ELSE 0
      END), 0) as calculated
    FROM accounts a
    LEFT JOIN transactions t ON (
      (t.account_id::uuid = a.id OR t.destination_account_id::uuid = a.id)
      AND t.deleted = false
    )
    WHERE a.user_id = p_user_id AND a.deleted = false
    GROUP BY a.id, a.balance, a.initial_balance
  )
  SELECT 
    c.id,
    c.stored,
    c.calculated,
    ABS(c.stored - c.calculated) as discrepancy,
    CASE 
      WHEN ABS(c.stored - c.calculated) < 0.01 THEN 'OK'
      ELSE 'DISCREPANCY'
    END as status
  FROM calculated c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Frontend

**Testes de Integridade:**

```typescript
// src/services/integrityService.ts
export const runIntegrityCheck = async (): Promise<IntegrityReport> => {
  const { data, error } = await supabase.rpc('verify_balance_integrity');
  
  if (error) throw error;
  
  const issues = data.filter((r: any) => r.status === 'DISCREPANCY');
  
  return {
    totalAccounts: data.length,
    issuesFound: issues.length,
    issues: issues.map((i: any) => ({
      accountId: i.account_id,
      discrepancy: i.discrepancy,
      stored: i.stored_balance,
      calculated: i.calculated_balance
    }))
  };
};
```

---

### 6. ✅ PERFORMANCE E OTIMIZAÇÃO

#### Backend

**Índices para Performance:**

```sql
-- Índices críticos para performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
ON transactions(user_id, date DESC) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_account 
ON transactions(account_id) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_series 
ON transactions(series_id) 
WHERE series_id IS NOT NULL;

-- Índice para queries de saldo
CREATE INDEX IF NOT EXISTS idx_accounts_user_deleted 
ON accounts(user_id, deleted) 
WHERE deleted = false;
```

#### Frontend

**Otimizações de Carregamento:**

```typescript
// src/hooks/useDataStore.ts - Melhorias
const fetchData = useCallback(async (forceLoading = false) => {
  // 1. Cache de resultados
  const cacheKey = `data_${sessionUser?.id}_${currentPeriod}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached && !forceLoading) {
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < 60000) { // 1 minuto
      setAccounts(data.accounts);
      setTransactions(data.transactions);
      return;
    }
  }
  
  // 2. Carregamento paralelo otimizado
  const [accs, txs] = await Promise.all([
    supabaseService.getAccounts(),
    supabaseService.getTransactionsByRange(startOfWindow, endOfWindow)
  ]);
  
  // 3. Salvar no cache
  sessionStorage.setItem(cacheKey, JSON.stringify({
    accounts: accs,
    transactions: txs,
    timestamp: Date.now()
  }));
}, [sessionUser, currentPeriod]);
```

---

### 7. ✅ SEGURANÇA

#### Backend

**Row Level Security (RLS) - Verificar se está ativo:**

```sql
-- Garantir que RLS está ativo em todas as tabelas
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can only see their own accounts"
ON accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own accounts"
ON accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ... políticas para outras tabelas
```

#### Frontend

**Sanitização de Inputs:**

```typescript
// src/utils/sanitize.ts
export const sanitizeAmount = (value: string): number => {
  // Remover caracteres não numéricos (exceto ponto e vírgula)
  const cleaned = value.replace(/[^\d,.-]/g, '');
  // Converter vírgula para ponto
  const normalized = cleaned.replace(',', '.');
  const num = parseFloat(normalized);
  
  // Validar range
  if (isNaN(num) || num < 0 || num > 999999999) {
    throw new Error('Valor inválido');
  }
  
  return Math.round(num * 100) / 100; // 2 casas decimais
};
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Limpeza (Seguro)
- [x] Remover arquivos de debug da raiz (movidos para `.cleanup-backup/`)
- [x] Arquivar migrations antigas (pasta `archive/` criada)
- [x] Remover código morto do frontend (`balanceEngine.ts` removido - 2025-12-18)
- [x] Limpar comentários obsoletos (refatoração completa)

### Fase 2: Validações (Crítico)
- [x] Adicionar constraints no banco (`20260128_constraints_e_auditoria.sql`)
- [x] Expandir validações no frontend (`validationService.ts`)
- [x] Adicionar tratamento de erros robusto (`errorHandler.ts`)

### Fase 3: Auditoria (Importante)
- [x] Implementar tabela de auditoria (na migration de constraints)
- [x] Adicionar triggers de auditoria
- [ ] Criar interface de visualização de auditoria (opcional)

### Fase 4: Backup (Importante)
- [x] Implementar backup automático (via Supabase)
- [x] Adicionar backup local (IndexedDB) - `backupService.ts` criado 2025-12-18
- [x] Criar função de restauração (`restoreFromLocal`)

### Fase 5: Performance (Otimização)
- [x] Adicionar índices no banco
- [x] Implementar cache no frontend (`useDataStore` com cache)
- [x] Otimizar queries

### Fase 6: Segurança (Crítico)
- [x] Verificar RLS em todas as tabelas
- [x] Adicionar sanitização de inputs
- [ ] Implementar rate limiting (opcional - Supabase tem rate limiting nativo)

---

## 🎯 PRIORIDADES

### 🔴 CRÍTICO (Fazer Primeiro)
1. Validações e constraints
2. Segurança (RLS)
3. Tratamento de erros

### 🟡 IMPORTANTE (Fazer Depois)
4. Auditoria
5. Backup
6. Testes de integridade

### 🟢 OPCIONAL (Melhorias)
7. Performance
8. Limpeza de código
9. Documentação

---

## ✅ RESULTADO ESPERADO

Após implementar essas melhorias:

- ✅ **Confiabilidade:** Sistema robusto com validações e tratamento de erros
- ✅ **Rastreabilidade:** Auditoria completa de todas as operações
- ✅ **Segurança:** Dados protegidos com RLS e sanitização
- ✅ **Performance:** Queries otimizadas e cache inteligente
- ✅ **Manutenibilidade:** Código limpo e bem documentado

