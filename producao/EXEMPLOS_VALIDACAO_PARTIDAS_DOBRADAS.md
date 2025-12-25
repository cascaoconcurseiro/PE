# 💡 EXEMPLOS PRÁTICOS: VALIDAÇÃO DE PARTIDAS DOBRADAS

**Data:** 25 de Dezembro de 2024  
**Objetivo:** Demonstrar como os dados devem bater no sistema

---

## 📚 CONCEITOS BÁSICOS

### O que são Partidas Dobradas?

Partidas dobradas é um sistema contábil onde **toda transação afeta pelo menos duas contas**:
- Uma conta é **DEBITADA** (recebe valor)
- Outra conta é **CREDITADA** (perde valor)

**Regra de Ouro:** DÉBITOS = CRÉDITOS (sempre!)

---

## 💰 EXEMPLO 1: RECEITA (Salário)

### Cenário
João recebe salário de R$ 5.000,00 na conta corrente.

### Transação
```json
{
  "type": "RECEITA",
  "description": "Salário Dezembro",
  "amount": 5000.00,
  "category": "Salário",
  "accountId": "conta-corrente-id",
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Conta Corrente (ASSET)     +R$ 5.000,00
Crédito: Salário (REVENUE)          +R$ 5.000,00
```

### Ledger Entry
```sql
INSERT INTO ledger_entries (
    transaction_id,
    debit_account_id,   -- Conta Corrente
    credit_account_id,  -- Categoria Salário
    amount,
    occurred_at
) VALUES (
    'tx-123',
    'chart-conta-corrente',
    'chart-salario',
    5000.00,
    '2024-12-25'
);
```

### Validação
```sql
-- Verificar se débito = crédito
SELECT 
    SUM(amount) FILTER (WHERE debit_account_id = 'chart-conta-corrente') as debits,
    SUM(amount) FILTER (WHERE credit_account_id = 'chart-salario') as credits
FROM ledger_entries
WHERE transaction_id = 'tx-123';

-- Resultado esperado:
-- debits: 5000.00
-- credits: 5000.00
-- ✅ BALANCEADO
```

### Impacto no Saldo
```
Conta Corrente ANTES: R$ 1.000,00
Conta Corrente DEPOIS: R$ 6.000,00 (+R$ 5.000,00) ✅
```

---

## 🛒 EXEMPLO 2: DESPESA (Supermercado)

### Cenário
João gasta R$ 300,00 no supermercado usando cartão de débito.

### Transação
```json
{
  "type": "DESPESA",
  "description": "Supermercado",
  "amount": 300.00,
  "category": "Alimentação",
  "accountId": "conta-corrente-id",
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Alimentação (EXPENSE)      +R$ 300,00
Crédito: Conta Corrente (ASSET)     -R$ 300,00
```

### Ledger Entry
```sql
INSERT INTO ledger_entries (
    transaction_id,
    debit_account_id,   -- Categoria Alimentação
    credit_account_id,  -- Conta Corrente
    amount,
    occurred_at
) VALUES (
    'tx-124',
    'chart-alimentacao',
    'chart-conta-corrente',
    300.00,
    '2024-12-25'
);
```

### Validação
```sql
SELECT 
    SUM(amount) FILTER (WHERE debit_account_id = 'chart-alimentacao') as debits,
    SUM(amount) FILTER (WHERE credit_account_id = 'chart-conta-corrente') as credits
FROM ledger_entries
WHERE transaction_id = 'tx-124';

-- Resultado esperado:
-- debits: 300.00
-- credits: 300.00
-- ✅ BALANCEADO
```

### Impacto no Saldo
```
Conta Corrente ANTES: R$ 6.000,00
Conta Corrente DEPOIS: R$ 5.700,00 (-R$ 300,00) ✅
```

---

## 💳 EXEMPLO 3: DESPESA NO CARTÃO DE CRÉDITO

### Cenário
João compra um celular de R$ 2.000,00 no cartão de crédito.

### Transação
```json
{
  "type": "DESPESA",
  "description": "Celular",
  "amount": 2000.00,
  "category": "Eletrônicos",
  "accountId": "cartao-credito-id",
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Eletrônicos (EXPENSE)      +R$ 2.000,00
Crédito: Cartão de Crédito (LIABILITY) -R$ 2.000,00
```

### Ledger Entry
```sql
INSERT INTO ledger_entries (
    transaction_id,
    debit_account_id,   -- Categoria Eletrônicos
    credit_account_id,  -- Cartão de Crédito
    amount,
    occurred_at
) VALUES (
    'tx-125',
    'chart-eletronicos',
    'chart-cartao-credito',
    2000.00,
    '2024-12-25'
);
```

### Impacto no Saldo
```
Cartão de Crédito ANTES: -R$ 500,00 (dívida)
Cartão de Crédito DEPOIS: -R$ 2.500,00 (dívida aumentou) ✅
```

**Nota:** Cartão de crédito é um PASSIVO (LIABILITY), então o saldo é negativo.

---

## 🔄 EXEMPLO 4: TRANSFERÊNCIA ENTRE CONTAS

### Cenário
João transfere R$ 1.000,00 da conta corrente para a poupança.

### Transação
```json
{
  "type": "TRANSFERÊNCIA",
  "description": "Transferência para Poupança",
  "amount": 1000.00,
  "accountId": "conta-corrente-id",
  "destinationAccountId": "poupanca-id",
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Poupança (ASSET)           +R$ 1.000,00
Crédito: Conta Corrente (ASSET)     -R$ 1.000,00
```

### Ledger Entry
```sql
INSERT INTO ledger_entries (
    transaction_id,
    debit_account_id,   -- Poupança (destino)
    credit_account_id,  -- Conta Corrente (origem)
    amount,
    occurred_at
) VALUES (
    'tx-126',
    'chart-poupanca',
    'chart-conta-corrente',
    1000.00,
    '2024-12-25'
);
```

### Impacto nos Saldos
```
Conta Corrente ANTES: R$ 5.700,00
Conta Corrente DEPOIS: R$ 4.700,00 (-R$ 1.000,00) ✅

Poupança ANTES: R$ 2.000,00
Poupança DEPOIS: R$ 3.000,00 (+R$ 1.000,00) ✅

TOTAL ANTES: R$ 7.700,00
TOTAL DEPOIS: R$ 7.700,00 (sem mudança) ✅
```

**Importante:** Em transferências, o total de ativos não muda!

---

## 🌍 EXEMPLO 5: TRANSFERÊNCIA MULTI-MOEDA

### Cenário
João transfere USD 100 da conta em dólar para conta em reais.
Taxa de câmbio: 1 USD = 5.00 BRL

### Transação
```json
{
  "type": "TRANSFERÊNCIA",
  "description": "Conversão USD → BRL",
  "amount": 100.00,
  "currency": "USD",
  "destinationAmount": 500.00,
  "exchangeRate": 5.00,
  "accountId": "conta-usd-id",
  "destinationAccountId": "conta-brl-id",
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Conta BRL (ASSET)          +R$ 500,00
Crédito: Conta USD (ASSET)          -USD 100,00
```

### Ledger Entry
```sql
-- Entrada em USD (origem)
INSERT INTO ledger_entries (
    transaction_id,
    debit_account_id,   -- Conta BRL
    credit_account_id,  -- Conta USD
    amount,
    occurred_at
) VALUES (
    'tx-127',
    'chart-conta-brl',
    'chart-conta-usd',
    100.00, -- Valor em USD
    '2024-12-25'
);
```

### Impacto nos Saldos
```
Conta USD ANTES: USD 500,00
Conta USD DEPOIS: USD 400,00 (-USD 100,00) ✅

Conta BRL ANTES: R$ 4.700,00
Conta BRL DEPOIS: R$ 5.200,00 (+R$ 500,00) ✅
```

**Nota:** O sistema armazena o valor de origem (USD) no ledger e o valor de destino (BRL) na transação.

---

## 👥 EXEMPLO 6: DESPESA COMPARTILHADA (Eu Paguei)

### Cenário
João paga jantar de R$ 150,00 e divide com Maria (R$ 50,00) e Pedro (R$ 50,00).
João fica com R$ 50,00.

### Transação
```json
{
  "type": "DESPESA",
  "description": "Jantar",
  "amount": 150.00,
  "category": "Alimentação",
  "accountId": "conta-corrente-id",
  "isShared": true,
  "payerId": "me",
  "sharedWith": [
    { "memberId": "maria-id", "assignedAmount": 50.00, "isSettled": false },
    { "memberId": "pedro-id", "assignedAmount": 50.00, "isSettled": false }
  ],
  "date": "2024-12-25"
}
```

### Partidas Dobradas
```
Débito:  Alimentação (EXPENSE)      +R$ 150,00
Crédito: Conta Corrente (ASSET)     -R$ 150,00
```

### Valor Efetivo para João
```typescript
// calculateEffectiveTransactionValue()
const splitsTotal = 50.00 + 50.00; // R$ 100,00
const effectiveValue = 150.00 - 100.00; // R$ 50,00

// João gastou efetivamente R$ 50,00
// Maria deve R$ 50,00 para João
// Pedro deve R$ 50,00 para João
```

### Impacto no Saldo
```
Conta Corrente ANTES: R$ 5.200,00
Conta Corrente DEPOIS: R$ 5.050,00 (-R$ 150,00) ✅

Mas João tem R$ 100,00 a receber:
Saldo Real: R$ 5.050,00
Saldo Efetivo: R$ 5.150,00 (R$ 5.050,00 + R$ 100,00 a receber) ✅
```

### Validação de Splits
```typescript
// Verificar se splits não excedem o total
const total = 150.00;
const splits = [50.00, 50.00];
const splitsTotal = splits.reduce((sum, s) => sum + s, 0); // 100.00

if (splitsTotal > total + 0.01) {
    console.error('❌ Splits excedem o total!');
} else {
    console.log('✅ Splits válidos');
}
```

---

## 👥 EXEMPLO 7: DESPESA COMPARTILHADA (Outro Pagou)

### Cenário
Maria paga almoço de R$ 120,00 e divide com João (R$ 40,00) e Pedro (R$ 40,00).
Maria fica com R$ 40,00.

### Transação (na conta de João)
```json
{
  "type": "DESPESA",
  "description": "Almoço (Pago por Maria)",
  "amount": 120.00,
  "category": "Alimentação",
  "isShared": true,
  "payerId": "maria-user-id",
  "sharedWith": [
    { "memberId": "joao-id", "assignedAmount": 40.00, "isSettled": false },
    { "memberId": "pedro-id", "assignedAmount": 40.00, "isSettled": false }
  ],
  "date": "2024-12-25"
}
```

### Partidas Dobradas (para João)
```
Débito:  Alimentação (EXPENSE)      +R$ 40,00
Crédito: Contas a Pagar (LIABILITY) -R$ 40,00
```

**Nota:** Como João não pagou, não afeta sua conta bancária ainda.

### Valor Efetivo para João
```typescript
// calculateEffectiveTransactionValue()
const splitsTotal = 40.00 + 40.00; // R$ 80,00 (outros)
const myShare = 120.00 - 80.00; // R$ 40,00

// João deve R$ 40,00 para Maria
```

### Impacto no Saldo
```
Conta Corrente: SEM MUDANÇA (João não pagou ainda)
Dívidas: +R$ 40,00 (João deve para Maria)
```

### Quando João Pagar
```json
{
  "type": "DESPESA",
  "description": "Pagamento para Maria (Almoço)",
  "amount": 40.00,
  "category": "Transferência",
  "accountId": "conta-corrente-id",
  "isSettled": true,
  "settledByTxId": "tx-original-id",
  "date": "2024-12-26"
}
```

Aí sim a conta corrente de João será debitada em R$ 40,00.

---

## 📊 EXEMPLO 8: VALIDAÇÃO COMPLETA DE UM DIA

### Cenário: Movimentações de João em 25/12/2024

```
Saldo Inicial: R$ 5.000,00

1. Recebe salário: +R$ 5.000,00
2. Paga supermercado: -R$ 300,00
3. Compra celular no cartão: -R$ 2.000,00 (cartão)
4. Transfere para poupança: -R$ 1.000,00 (corrente) +R$ 1.000,00 (poupança)
5. Paga jantar compartilhado: -R$ 150,00 (mas recebe R$ 100,00 de volta)
```

### Cálculo do Saldo Final

**Conta Corrente:**
```
Inicial:     R$ 5.000,00
+ Salário:   R$ 5.000,00
- Mercado:   R$   300,00
- Transfer:  R$ 1.000,00
- Jantar:    R$   150,00
= Final:     R$ 8.550,00 ✅
```

**Cartão de Crédito:**
```
Inicial:     -R$   500,00
- Celular:   -R$ 2.000,00
= Final:     -R$ 2.500,00 ✅
```

**Poupança:**
```
Inicial:     R$ 2.000,00
+ Transfer:  R$ 1.000,00
= Final:     R$ 3.000,00 ✅
```

**Total de Ativos:**
```
Conta Corrente: R$ 8.550,00
Poupança:       R$ 3.000,00
Cartão:        -R$ 2.500,00
A Receber:      R$   100,00 (jantar)
= Total:        R$ 9.150,00 ✅
```

### Validação de Partidas Dobradas

```sql
-- Verificar se débitos = créditos para o dia
SELECT 
    DATE(occurred_at) as date,
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) as total_debits,
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL) as total_credits,
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL) as difference
FROM ledger_entries
WHERE user_id = 'joao-id'
AND DATE(occurred_at) = '2024-12-25'
GROUP BY DATE(occurred_at);

-- Resultado esperado:
-- date: 2024-12-25
-- total_debits: 8450.00
-- total_credits: 8450.00
-- difference: 0.00
-- ✅ BALANCEADO
```

---

## 🔍 QUERIES DE VALIDAÇÃO

### 1. Verificar Balanceamento Geral
```sql
SELECT 
    user_id,
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) as debits,
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL) as credits,
    ABS(
        SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
        SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL)
    ) as difference,
    CASE 
        WHEN ABS(
            SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
            SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL)
        ) < 0.01 THEN '✅ BALANCEADO'
        ELSE '❌ DESBALANCEADO'
    END as status
FROM ledger_entries
WHERE archived = false
GROUP BY user_id;
```

### 2. Verificar Saldos Consistentes
```sql
WITH calculated_balances AS (
    SELECT 
        a.id,
        a.name,
        a.balance as stored_balance,
        a.initial_balance + COALESCE(
            (
                SELECT SUM(
                    CASE 
                        WHEN t.type = 'RECEITA' THEN t.amount
                        WHEN t.type = 'DESPESA' THEN -t.amount
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN 
                            COALESCE(t.destination_amount, t.amount)
                        ELSE 0
                    END
                )
                FROM transactions t
                WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
                AND t.deleted = false
            ), 0
        ) as calculated_balance
    FROM accounts a
    WHERE a.deleted = false
)
SELECT 
    name,
    stored_balance,
    calculated_balance,
    ABS(stored_balance - calculated_balance) as difference,
    CASE 
        WHEN ABS(stored_balance - calculated_balance) < 0.01 THEN '✅ OK'
        ELSE '❌ INCONSISTENTE'
    END as status
FROM calculated_balances
ORDER BY ABS(stored_balance - calculated_balance) DESC;
```

### 3. Verificar Splits Válidos
```sql
SELECT 
    t.id,
    t.description,
    t.amount as total,
    (
        SELECT SUM((split->>'assignedAmount')::numeric)
        FROM jsonb_array_elements(t.shared_with) as split
    ) as splits_total,
    CASE 
        WHEN (
            SELECT SUM((split->>'assignedAmount')::numeric)
            FROM jsonb_array_elements(t.shared_with) as split
        ) > t.amount + 0.01 THEN '❌ SPLITS > TOTAL'
        WHEN (
            SELECT SUM((split->>'assignedAmount')::numeric)
            FROM jsonb_array_elements(t.shared_with) as split
        ) < t.amount - 0.01 THEN '⚠️ SPLITS < TOTAL'
        ELSE '✅ OK'
    END as status
FROM transactions t
WHERE t.is_shared = true
AND t.deleted = false
AND t.shared_with IS NOT NULL;
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Para Cada Transação

- [ ] Valor é positivo (> 0)
- [ ] Conta de origem existe
- [ ] Categoria existe
- [ ] Data é válida
- [ ] Se transferência: conta de destino existe e é diferente da origem
- [ ] Se multi-moeda: destinationAmount está preenchido
- [ ] Se compartilhada: splits não excedem o total
- [ ] Entrada no ledger foi criada
- [ ] Débito = Crédito no ledger

### Para Cada Conta

- [ ] Saldo armazenado = Saldo calculado (diferença < R$ 0,01)
- [ ] Tipo de conta é válido (CHECKING, SAVINGS, CREDIT_CARD, etc)
- [ ] Moeda é válida (BRL, USD, EUR, etc)
- [ ] Se cartão de crédito: tem closing_day e due_day

### Para Sistema Geral

- [ ] Total de débitos = Total de créditos (por usuário)
- [ ] Não existem transações órfãs (sem conta)
- [ ] Não existem parcelas duplicadas
- [ ] Não existem espelhos não sincronizados
- [ ] Não existem solicitações expiradas pendentes

---

## 🎯 CONCLUSÃO

Este documento demonstra como os dados devem bater no sistema:

1. **Partidas Dobradas:** Sempre débito = crédito
2. **Saldos:** Saldo armazenado = Saldo calculado
3. **Splits:** Soma das partes ≤ Total
4. **Transferências:** Total de ativos não muda
5. **Multi-moeda:** Valores convertidos corretamente

Use as queries de validação para verificar a integridade dos dados regularmente!
