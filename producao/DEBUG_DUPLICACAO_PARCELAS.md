# 🔍 DEBUG: Duplicação de Parcelas - Guia de Investigação

## Passo 1: Limpar Console e Recarregar

1. Abra o DevTools (F12)
2. Vá na aba **Console**
3. Clique em "Clear console" (ícone 🚫)
4. Recarregue a página (Ctrl+Shift+R para hard reload)

## Passo 2: Importar UMA Parcela de Teste

1. Vá em **Compartilhado** → **Importar Parcelado**
2. Preencha:
   - Descrição: **"DEBUG TESTE"**
   - Valor Total: **100**
   - Parcelas: **2** (apenas 2 para facilitar debug)
   - Selecione categoria, cartão e membro
3. Clique em **Confirmar**

## Passo 3: Copiar TODOS os Logs do Console

Procure por logs que começam com:
- 🔍 DEBUG
- ✅ Parcela
- ❌ Erro

**IMPORTANTE**: Copie TODOS os logs, especialmente:

```
🔍 DEBUG Parcela 1/2: { ... }
🔍 DEBUG createTransactionDirect - sharedWithJson: { ... }
🔍 DEBUG createTransactionWithValidation - params: { ... }
```

## Passo 4: Verificar no Banco de Dados

Execute no Supabase SQL Editor:

```sql
-- 1. Contar transações criadas
SELECT COUNT(*) as total_transactions
FROM transactions
WHERE description LIKE 'DEBUG TESTE%';

-- 2. Ver detalhes das transações
SELECT 
    id,
    description,
    amount,
    shared_with,
    is_installment,
    current_installment,
    total_installments
FROM transactions
WHERE description LIKE 'DEBUG TESTE%'
ORDER BY current_installment;

-- 3. Contar ledger entries criados
SELECT COUNT(*) as total_ledger_entries
FROM ledger_entries le
JOIN transactions t ON le.transaction_id = t.id
WHERE t.description LIKE 'DEBUG TESTE%';

-- 4. Ver detalhes dos ledger entries
SELECT 
    le.id,
    t.description as transaction_desc,
    t.current_installment,
    le.description as ledger_desc,
    le.amount,
    coa.name as account_name,
    coa.type as account_type
FROM ledger_entries le
JOIN transactions t ON le.transaction_id = t.id
JOIN chart_of_accounts coa ON le.debit_account_id = coa.id
WHERE t.description LIKE 'DEBUG TESTE%'
ORDER BY t.current_installment, le.created_at;
```

## Passo 5: Me Enviar os Resultados

Por favor, me envie:

1. **Logs do Console** (todos os logs com 🔍 DEBUG)
2. **Resultado da Query 1** (total_transactions)
3. **Resultado da Query 2** (detalhes das transações)
4. **Resultado da Query 3** (total_ledger_entries)
5. **Resultado da Query 4** (detalhes dos ledger entries)

## O que Estamos Procurando

### Cenário Correto ✅
```
Importação: 2 parcelas de R$ 50 cada (total R$ 100)

Transações: 2
├─ DEBUG TESTE (1/2) - R$ 50 - shared_with: [{ user_id: "xxx", amount: 50 }]
└─ DEBUG TESTE (2/2) - R$ 50 - shared_with: [{ user_id: "xxx", amount: 50 }]

Ledger Entries: 4
├─ Parcela 1:
│  ├─ Despesa (Minha Parte): R$ 0 (porque compartilhei tudo)
│  └─ A Receber: R$ 50
└─ Parcela 2:
   ├─ Despesa (Minha Parte): R$ 0
   └─ A Receber: R$ 50

Total A Receber: R$ 100 ✅
```

### Cenário com Problema ❌
```
Importação: 2 parcelas de R$ 50 cada (total R$ 100)

Transações: 2 (correto)

Ledger Entries: 8 ou mais (ERRADO!)
├─ Parcela 1:
│  ├─ A Receber: R$ 50 (correto)
│  ├─ A Receber: R$ 50 (DUPLICADO!)
│  ├─ A Receber: R$ 50 (DUPLICADO!)
│  └─ ... (mais duplicados)
└─ Parcela 2:
   └─ ... (mesma duplicação)

Total A Receber: R$ 200+ ❌
```

## Possíveis Causas

Se ainda houver duplicação, pode ser:

1. **Cache do navegador**: Código antigo ainda carregado
2. **Problema no banco**: Função SQL com bug
3. **Problema no fluxo**: Algo chamando a função múltiplas vezes
4. **Problema nos dados**: `shared_with` vindo com múltiplos elementos

---

**Aguardando seus logs para continuar a investigação!** 🔍

