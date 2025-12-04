# 🐛 BUG: Despesas Compartilhadas Duplicadas

## Problema Identificado

Quando outra pessoa paga uma despesa compartilhada, o sistema está criando **duas transações** incorretamente:

### Exemplo Real
- **Despesa Total:** R$ 5,00 (Alimentação)
- **Pago por:** Fran
- **Minha parte:** R$ 2,50
- **Parte de Fran:** R$ 2,50

### O que está acontecendo ERRADO ❌

1. **Transação 1:** Despesa de R$ 2,50 (minha parte)
   - Tipo: EXPENSE
   - Conta: Minha conta
   - Descrição: "Alimentação"
   - **Problema:** Debita R$ 2,50 da minha conta IMEDIATAMENTE

2. **Transação 2:** Transferência de R$ 2,50
   - Tipo: EXPENSE (deveria ser TRANSFER)
   - Descrição: "Pagamento Acerto - Fran"
   - **Problema:** Debita MAIS R$ 2,50 da minha conta

**Total debitado:** R$ 5,00 (ERRADO! Deveria ser apenas R$ 2,50 quando eu pagar)

---

## Comportamento Correto ✅

### Quando Fran paga R$ 5,00 e minha parte é R$ 2,50:

1. **NÃO criar nenhuma transação na minha conta**
2. **Registrar apenas a dívida** (aparece em "Compartilhado")
3. **Não afetar meu saldo** até eu liquidar

### Quando eu pagar os R$ 2,50 para Fran:

1. **Criar UMA transferência** de R$ 2,50
   - Tipo: TRANSFER (não EXPENSE)
   - De: Minha conta
   - Para: Conta de Fran (ou marcar como pago externamente)
   - Descrição: "Pagamento Acerto - Fran"

2. **Marcar a dívida como quitada** (isSettled = true)

---

## Código Problemático

**Arquivo:** `components/Shared.tsx`  
**Linhas:** 210-227

```typescript
// ❌ PROBLEMA: Cria uma EXPENSE ao invés de TRANSFER
if (settleModal.type !== 'OFFSET') {
    onAddTransaction({
        amount: finalAmount,
        description: `${settleModal.type === 'RECEIVE' ? 'Recebimento' : 'Pagamento'} Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
        date: now.split('T')[0],
        type: settleModal.type === 'RECEIVE' ? TransactionType.INCOME : TransactionType.EXPENSE, // ❌ ERRADO!
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

---

## Solução Proposta

### Opção 1: Usar TRANSFER (Recomendado)

```typescript
if (settleModal.type !== 'OFFSET') {
    onAddTransaction({
        amount: finalAmount,
        description: `${settleModal.type === 'RECEIVE' ? 'Recebimento' : 'Pagamento'} Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
        date: now.split('T')[0],
        type: TransactionType.TRANSFER, // ✅ CORRETO
        category: Category.TRANSFER,
        accountId: selectedAccountId,
        destinationAccountId: 'EXTERNAL', // ✅ Marca como transferência externa
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

### Opção 2: Não criar transação quando outra pessoa paga

Quando `payerId !== 'me'`, a transação original **NÃO deve afetar minha conta** até eu liquidar.

**Arquivo:** `services/balanceEngine.ts`  
**Linhas:** 72-77

```typescript
if (tx.type === TransactionType.EXPENSE) {
    // ✅ CORREÇÃO: Só debitar se EU paguei
    if (!someoneElsePaid) {
        const change = tx.isRefund ? amount : -amount;
        sourceAcc.balance = round2dec(sourceAcc.balance + change);
    }
    // ✅ Se outra pessoa pagou, não afeta minha conta até eu liquidar
}
```

---

## Impacto

### Antes da Correção ❌
- Despesa de R$ 5,00 paga por Fran
- Minha parte: R$ 2,50
- **Saldo debitado:** R$ 5,00 (ERRADO!)

### Depois da Correção ✅
- Despesa de R$ 5,00 paga por Fran
- Minha parte: R$ 2,50
- **Saldo debitado:** R$ 0,00 (até eu pagar)
- Quando eu pagar: **Saldo debitado:** R$ 2,50 (CORRETO!)

---

## Testes Necessários

1. ✅ Criar despesa compartilhada paga por outra pessoa
2. ✅ Verificar que não afeta meu saldo
3. ✅ Verificar que aparece em "Compartilhado" como dívida
4. ✅ Pagar a dívida
5. ✅ Verificar que debita apenas minha parte
6. ✅ Verificar que não cria transação duplicada

---

**Data:** 2025-12-04  
**Prioridade:** 🔴 CRÍTICA  
**Status:** 🔍 Identificado, aguardando correção
