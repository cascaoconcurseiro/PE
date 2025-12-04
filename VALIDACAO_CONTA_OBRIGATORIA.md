# 🔴 VALIDAÇÃO DE CONTA OBRIGATÓRIA E PARTIDAS DOBRADAS

**Data:** 2025-12-04 12:53 BRT  
**Status:** 🔴 EM IMPLEMENTAÇÃO

---

## 📋 PROBLEMAS IDENTIFICADOS

### 1. 🔴 Conta Obrigatória (CRÍTICO)
**Problema:** Sistema permite criar transações sem conta vinculada

**Locais que criam transações:**
1. ✅ `hooks/useTransactionForm.ts` (linha 154) - **JÁ TEM VALIDAÇÃO**
2. ❌ `components/Accounts.tsx` - Depósito, Saque, Transferência, Pagamento de Fatura
3. ❌ `components/Shared.tsx` - Regularização de compartilhadas
4. ❌ `components/Goals.tsx` - Movimentação de metas
5. ❌ `components/Investments.tsx` - Compra/venda de ativos
6. ❌ `services/recurrenceEngine.ts` - Transações recorrentes

---

### 2. 🟠 Partidas Dobradas (ALTA)
**Problema:** Nem todas as movimentações seguem o princípio de partidas dobradas

**Princípio:** Toda movimentação financeira deve ter:
- **Origem (débito):** De onde sai o dinheiro
- **Destino (crédito):** Para onde vai o dinheiro

**Tipos de Transação:**

#### ✅ TRANSFERÊNCIA (já está correto)
- Origem: `accountId`
- Destino: `destinationAccountId`
- ✅ Partidas dobradas implementadas

#### ❌ RECEITA (precisa correção)
- Origem: `EXTERNAL` ou categoria específica
- Destino: `accountId`
- ❌ Falta origem explícita

#### ❌ DESPESA (precisa correção)
- Origem: `accountId`
- Destino: `EXTERNAL` ou categoria específica
- ❌ Falta destino explícito

---

## 🛠️ CORREÇÕES A APLICAR

### Correção 1: Validação de Conta Obrigatória

#### 1.1 `components/Accounts.tsx`
**Linhas:** 100-125

```typescript
const handleActionSubmit = (amount: number, description: string, sourceId: string) => {
    if (!selectedAccount) return;
    
    // ✅ ADICIONAR VALIDAÇÃO
    if (!selectedAccount.id) {
        addToast('Erro: Conta não identificada', 'error');
        return;
    }
    
    const date = new Date().toISOString();
    const commonProps = { amount, date, accountId: selectedAccount.id, isRecurring: false };

    switch (actionModal.type) {
        case 'DEPOSIT':
            // ✅ VALIDAR que accountId existe
            if (!commonProps.accountId) {
                addToast('Erro: Conta de destino obrigatória', 'error');
                return;
            }
            onAddTransaction({ ...commonProps, description: description || 'Depósito', type: TransactionType.INCOME, category: Category.INCOME });
            break;
            
        case 'WITHDRAW':
            // ✅ VALIDAR que accountId existe
            if (!commonProps.accountId) {
                addToast('Erro: Conta de origem obrigatória', 'error');
                return;
            }
            if (sourceId) {
                onAddTransaction({ ...commonProps, description: description || 'Saque para Carteira', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
            } else {
                onAddTransaction({ ...commonProps, description: description || 'Saque em Espécie', type: TransactionType.EXPENSE, category: Category.OTHER });
            }
            break;
            
        case 'TRANSFER':
            // ✅ VALIDAR origem e destino
            if (!commonProps.accountId || !sourceId) {
                addToast('Erro: Contas de origem e destino obrigatórias', 'error');
                return;
            }
            onAddTransaction({ ...commonProps, description: description || 'Transferência', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
            break;
            
        case 'PAY_INVOICE':
            // ✅ VALIDAR origem e destino
            if (!sourceId || !selectedAccount.id) {
                addToast('Erro: Contas de origem e destino obrigatórias', 'error');
                return;
            }
            onAddTransaction({ amount, description: `Pagamento Fatura - ${selectedAccount.name}`, date, type: TransactionType.TRANSFER, category: Category.TRANSFER, accountId: sourceId, destinationAccountId: selectedAccount.id, isRecurring: false });
            break;
    }
    setActionModal({ ...actionModal, isOpen: false });
};
```

#### 1.2 `components/Shared.tsx`
**Linha:** 206

```typescript
// 1. Transaction Record (Money Movement)
if (settleModal.type !== 'OFFSET') {
    // ✅ VALIDAR que selectedAccountId existe
    if (!selectedAccountId) {
        alert('Erro: Selecione uma conta para regularizar');
        return;
    }
    
    onAddTransaction({
        amount: finalAmount,
        description: `${settleModal.type === 'RECEIVE' ? 'Recebimento' : 'Pagamento'} Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
        date: now.split('T')[0],
        type: settleModal.type === 'RECEIVE' ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: settleModal.type === 'RECEIVE' ? Category.INCOME : Category.TRANSFER,
        accountId: selectedAccountId,
        isShared: false,
        relatedMemberId: settleModal.memberId!,
        exchangeRate: isConverting ? rate : undefined,
        currency: isConverting ? 'BRL' : settleModal.currency,
        createdAt: now,
        updatedAt: now,
        syncStatus: SyncStatus.PENDING
    });
}
```

#### 1.3 `components/Goals.tsx`
**Linha:** 84

```typescript
const handleContribute = () => {
    if (!selectedGoal || !contributionAmount || contributionAmount <= 0) return;
    
    // ✅ VALIDAR que sourceAccountId existe
    if (!sourceAccountId) {
        alert('Erro: Selecione uma conta de origem');
        return;
    }
    
    const transaction: Omit<Transaction, 'id'> = {
        amount: contributionAmount,
        description: `Contribuição para ${selectedGoal.name}`,
        date: new Date().toISOString(),
        type: TransactionType.TRANSFER,
        category: Category.SAVINGS,
        accountId: sourceAccountId,
        destinationAccountId: 'GOAL_' + selectedGoal.id,
        isRecurring: false
    };
    
    onAddTransaction(transaction);
    // ... resto do código
};
```

#### 1.4 `components/Investments.tsx`
**Linhas:** 185, 242, 277, 320

```typescript
// Exemplo: Compra de Ativo
const handleBuy = () => {
    if (!selectedAsset || !buyAmount || buyAmount <= 0) return;
    
    // ✅ VALIDAR que sourceAccountId existe
    if (!sourceAccountId) {
        alert('Erro: Selecione uma conta de origem');
        return;
    }
    
    onAddTransaction({
        amount: buyAmount,
        description: `Compra ${selectedAsset.ticker}`,
        date: new Date().toISOString(),
        type: TransactionType.TRANSFER,
        category: Category.INVESTMENT,
        accountId: sourceAccountId,
        destinationAccountId: 'ASSET_' + selectedAsset.id,
        isRecurring: false
    });
    // ... resto do código
};
```

#### 1.5 `services/recurrenceEngine.ts`
**Linha:** 86

```typescript
// FIX: Verificar se a transação tem accountId antes de criar
if (!alreadyExists) {
    // ✅ VALIDAR que accountId existe
    if (!t.accountId || t.accountId === 'EXTERNAL') {
        console.error(`❌ ERRO: Transação recorrente sem conta válida!`);
        console.error(`   Transaction ID: ${t.id}`);
        console.error(`   Description: ${t.description}`);
        return; // Não criar transação inválida
    }
    
    onAddTransaction(newTx);
}
```

---

### Correção 2: Partidas Dobradas Completas

#### 2.1 Criar Helper de Validação

**Arquivo:** `utils/transactionValidation.ts` (NOVO)

```typescript
import { Transaction, TransactionType } from '../types';

/**
 * Valida se uma transação tem conta de origem válida
 */
export const hasValidSourceAccount = (tx: Partial<Transaction>): boolean => {
    return !!(tx.accountId && tx.accountId !== 'EXTERNAL');
};

/**
 * Valida se uma transação tem conta de destino válida (para transferências)
 */
export const hasValidDestinationAccount = (tx: Partial<Transaction>): boolean => {
    if (tx.type !== TransactionType.TRANSFER) return true;
    return !!(tx.destinationAccountId && tx.destinationAccountId !== 'EXTERNAL');
};

/**
 * Valida se uma transação segue o princípio de partidas dobradas
 */
export const isDoubleEntryValid = (tx: Partial<Transaction>): boolean => {
    switch (tx.type) {
        case TransactionType.TRANSFER:
            // Transferência: precisa origem E destino
            return hasValidSourceAccount(tx) && hasValidDestinationAccount(tx);
            
        case TransactionType.INCOME:
            // Receita: precisa destino (accountId)
            return hasValidSourceAccount(tx);
            
        case TransactionType.EXPENSE:
            // Despesa: precisa origem (accountId)
            return hasValidSourceAccount(tx);
            
        default:
            return false;
    }
};

/**
 * Retorna mensagem de erro se a transação for inválida
 */
export const getTransactionValidationError = (tx: Partial<Transaction>): string | null => {
    if (!tx.type) return 'Tipo de transação obrigatório';
    if (!tx.amount || tx.amount <= 0) return 'Valor deve ser maior que zero';
    if (!tx.description?.trim()) return 'Descrição obrigatória';
    if (!tx.date) return 'Data obrigatória';
    
    switch (tx.type) {
        case TransactionType.TRANSFER:
            if (!hasValidSourceAccount(tx)) return 'Conta de origem obrigatória';
            if (!hasValidDestinationAccount(tx)) return 'Conta de destino obrigatória';
            if (tx.accountId === tx.destinationAccountId) return 'Origem e destino não podem ser iguais';
            break;
            
        case TransactionType.INCOME:
            if (!hasValidSourceAccount(tx)) return 'Conta de destino obrigatória';
            break;
            
        case TransactionType.EXPENSE:
            if (!hasValidSourceAccount(tx)) return 'Conta de origem obrigatória';
            break;
    }
    
    return null;
};
```

#### 2.2 Aplicar Validação em `hooks/useDataStore.ts`

```typescript
import { getTransactionValidationError } from '../utils/transactionValidation';

const handleAddTransaction = (data: Omit<Transaction, 'id'>) => {
    // ✅ VALIDAR antes de adicionar
    const validationError = getTransactionValidationError(data);
    if (validationError) {
        console.error(`❌ ERRO: ${validationError}`);
        console.error('   Transaction data:', data);
        alert(`Erro ao criar transação: ${validationError}`);
        return;
    }
    
    // ... resto do código
};
```

---

## 📊 RESUMO DE VALIDAÇÕES

### Validações Existentes ✅
1. ✅ `useTransactionForm.ts` - Formulário principal

### Validações a Adicionar ❌
1. ❌ `Accounts.tsx` - 4 tipos de ação
2. ❌ `Shared.tsx` - Regularização
3. ❌ `Goals.tsx` - Contribuição
4. ❌ `Investments.tsx` - 4 operações
5. ❌ `recurrenceEngine.ts` - Recorrências
6. ❌ `useDataStore.ts` - Validação central

**Total:** 6 arquivos + 1 novo arquivo de utilitário

---

## 🎯 IMPACTO DAS CORREÇÕES

### Antes
❌ Transações podem ser criadas sem conta  
❌ Dados inconsistentes no banco  
❌ Saldos incorretos  
❌ Relatórios com erros  

### Depois
✅ Todas as transações têm conta obrigatória  
✅ Validação em todos os pontos de criação  
✅ Partidas dobradas completas  
✅ Dados consistentes  
✅ Saldos corretos  

---

**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 30 minutos  
**Risco:** Médio (pode quebrar fluxos existentes)
