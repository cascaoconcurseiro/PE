# 🔴 BUGS CRÍTICOS IDENTIFICADOS - EXCLUSÃO E FATURAS

**Data:** 2025-12-04 13:20 BRT  
**Status:** 🔴 3 BUGS CRÍTICOS

---

## 📋 PROBLEMAS REPORTADOS

### 1. 🔴 **BUG CRÍTICO: Conta Deletada Aparece como "Conta Desconhecida"**

**Problema:**
- Usuário deletou um cartão
- Balancete mostra "Conta Desconhecida R$ 0,00 R$ 100,00 -R$ 100,00"
- Razão mostra "31/12/2025 Fatura Importada - Janeiro de 2026 Saldo Inicial / Ajuste Conta Desconhecida R$ 100,00"

**Causa Raiz:**
```typescript
// services/ledger.ts - Linha 27
const getAccountName = (id: string) => accountMap.get(id) || 'Conta Desconhecida';
```

**Análise:**
1. ✅ Exclusão em cascata **EXISTE** em `useDataStore.ts` (linhas 267-275)
2. ❌ MAS transações podem ter sido criadas **ANTES** da exclusão
3. ❌ Transações antigas com `accountId` de conta deletada ficam órfãs
4. ❌ `generateLedger` mostra "Conta Desconhecida" para essas transações

**Correção Necessária:**
```typescript
// Opção 1: Filtrar transações órfãs do ledger
export const generateLedger = (transactions: Transaction[], accounts: Account[]): LedgerEntry[] => {
    const accountMap = new Map(accounts.map(a => [a.id, a.name]));
    const accountIds = new Set(accounts.map(a => a.id));
    
    // ✅ Filtrar transações com contas válidas
    const validTransactions = transactions.filter(tx => {
        // Verificar se conta de origem existe
        if (!accountIds.has(tx.accountId)) {
            console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (conta: ${tx.accountId})`);
            return false;
        }
        // Verificar se conta de destino existe (para transferências)
        if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
            if (!accountIds.has(tx.destinationAccountId)) {
                console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (destino: ${tx.destinationAccountId})`);
                return false;
            }
        }
        return true;
    });
    
    // ... resto do código usando validTransactions
};

// Opção 2: Melhorar exclusão em cascata para marcar como deletadas
// ao invés de excluir fisicamente
```

---

### 2. 🔴 **BUG CRÍTICO: Faturas Importadas Não Aparecem no Cartão**

**Problema:**
- Usuário importa faturas
- Faturas não aparecem na lista de transações do cartão

**Causa Raiz:**
```typescript
// components/Accounts.tsx - Linha 191
onAddTransaction({ 
    amount: tx.amount, 
    description: tx.description, 
    date: tx.date, 
    type: tx.type, 
    category: Category.OTHER,  // ❌ Sempre usa Category.OTHER
    accountId: selectedAccount.id, 
    isRecurring: false 
});
```

**Análise:**
1. ✅ Transações são criadas corretamente
2. ❌ MAS podem estar sendo filtradas em algum lugar
3. ❌ Ou a UI não está mostrando todas as transações do cartão

**Correção Necessária:**
```typescript
// Verificar se há filtros escondendo as transações importadas
// Verificar se getInvoiceData está filtrando corretamente
```

---

### 3. 🔴 **BUG CRÍTICO: Faturas Importadas Não Podem Ser Editadas/Excluídas**

**Problema:**
- Usuário não consegue editar ou excluir faturas importadas

**Causa Raiz:**
- Provavelmente falta UI para editar/excluir transações na view do cartão

**Correção Necessária:**
```typescript
// Adicionar botões de editar/excluir nas transações do cartão
// Similar ao que existe em Transactions.tsx
```

---

## 🛠️ CORREÇÕES A APLICAR

### Correção 1: Filtrar Transações Órfãs do Ledger

**Arquivo:** `services/ledger.ts`  
**Linhas:** 25-102

```typescript
export const generateLedger = (transactions: Transaction[], accounts: Account[]): LedgerEntry[] => {
    const accountMap = new Map(accounts.map(a => [a.id, a.name]));
    const accountIds = new Set(accounts.map(a => a.id));
    const getAccountName = (id: string) => accountMap.get(id) || 'Conta Desconhecida';

    const ledger: LedgerEntry[] = [];

    // Filter out deleted transactions and unpaid debts
    const activeTransactions = transactions.filter(shouldShowTransaction);

    activeTransactions.forEach(tx => {
        if (!tx.amount || tx.amount <= 0) return;

        // ✅ VALIDAÇÃO: Ignorar transações com contas deletadas
        if (!accountIds.has(tx.accountId)) {
            console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (conta: ${tx.accountId})`);
            return;
        }

        // ✅ VALIDAÇÃO: Para transferências, verificar destino
        if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
            if (!accountIds.has(tx.destinationAccountId)) {
                console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (destino: ${tx.destinationAccountId})`);
                return;
            }
        }

        // ... resto do código
    });

    return ledger.sort((a, b) => b.date.localeCompare(a.date));
};
```

---

### Correção 2: Melhorar Exclusão em Cascata

**Arquivo:** `hooks/useDataStore.ts`  
**Linhas:** 267-275

**Opção A: Soft Delete (Recomendado)**
```typescript
const handleDeleteAccount = async (id: string) => performOperation(async () => {
    // ✅ SOFT DELETE: Marcar transações como deletadas ao invés de excluir
    const accountTxs = transactions.filter(t => t.accountId === id || t.destinationAccountId === id);
    for (const tx of accountTxs) {
        await supabaseService.update('transactions', { ...tx, deleted: true, updatedAt: new Date().toISOString() });
    }
    // Then delete the account itself
    await supabaseService.delete('accounts', id);
}, 'Conta e transações excluídas.');
```

**Opção B: Hard Delete (Atual - Melhorar)**
```typescript
const handleDeleteAccount = async (id: string) => performOperation(async () => {
    // ✅ HARD DELETE: Excluir fisicamente todas as transações
    const accountTxs = transactions.filter(t => t.accountId === id || t.destinationAccountId === id);
    
    console.log(`🗑️ Excluindo conta ${id} e ${accountTxs.length} transações associadas...`);
    
    for (const tx of accountTxs) {
        await supabaseService.delete('transactions', tx.id);
        console.log(`  ✅ Transação excluída: ${tx.description}`);
    }
    
    // Then delete the account itself
    await supabaseService.delete('accounts', id);
    
    console.log(`✅ Conta ${id} excluída com sucesso!`);
}, 'Conta e transações excluídas.');
```

---

### Correção 3: Investigar Por Que Faturas Não Aparecem

**Passos:**
1. ✅ Verificar se transações estão sendo criadas (console.log)
2. ✅ Verificar filtros em `getInvoiceData`
3. ✅ Verificar se `shouldShowTransaction` está filtrando
4. ✅ Verificar UI do cartão

---

### Correção 4: Adicionar Edição/Exclusão de Faturas

**Arquivo:** `components/Accounts.tsx`  
**Adicionar:**
- Botão de editar em cada transação da fatura
- Botão de excluir em cada transação da fatura
- Modal de edição (reutilizar TransactionForm)

---

## 🎯 PRIORIDADES

### Prioridade 1 (CRÍTICA) - Fazer AGORA
1. ✅ Filtrar transações órfãs do ledger
2. ✅ Melhorar exclusão em cascata (soft delete)

### Prioridade 2 (ALTA) - Fazer HOJE
3. ✅ Investigar por que faturas não aparecem
4. ✅ Adicionar edição/exclusão de faturas

---

## 📝 NOTAS

### Soft Delete vs Hard Delete

**Soft Delete (Recomendado):**
- ✅ Mantém histórico
- ✅ Pode desfazer
- ✅ Auditoria
- ❌ Mais complexo

**Hard Delete (Atual):**
- ✅ Mais simples
- ✅ Limpa dados
- ❌ Perde histórico
- ❌ Não pode desfazer

**Recomendação:** Usar **Soft Delete** para transações e **Hard Delete** para contas.

---

**Análise Realizada Por:** Antigravity AI  
**Data:** 2025-12-04 13:20 BRT  
**Bugs Identificados:** 3  
**Correções Planejadas:** 4
