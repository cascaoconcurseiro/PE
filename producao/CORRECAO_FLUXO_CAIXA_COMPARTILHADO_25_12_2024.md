# Correção: Fluxo de Caixa - Transações Compartilhadas e Faturas Pendentes

**Data:** 25/12/2024  
**Problema Reportado:** Transação compartilhada de R$ 199,00 aparecendo como +R$ 199 (crédito) e -R$ 199 (débito) no fluxo de caixa

## 🐛 Problemas Identificados

### 1. Duplicação de Valores em Transações Compartilhadas
**Sintoma:** Uma despesa compartilhada de R$ 199,00 aparecia duas vezes no fluxo de caixa:
- Como despesa: -R$ 199,00
- Como receita (reembolso): +R$ 199,00

**Causa Raiz:** 
A lógica implementada em 23/12/2024 tentava mostrar o valor total pago E o reembolso separadamente. Isso estava correto para visualização detalhada, mas causava confusão no fluxo de caixa.

**Exemplo do problema:**
```
Transação: Jantar compartilhado - R$ 199,00
- Minha parte: R$ 99,50
- Parte do amigo: R$ 99,50

Fluxo de Caixa ANTES (ERRADO):
- Despesas: R$ 199,00
- Receitas: R$ 99,50 (reembolso)
- Impacto líquido: -R$ 99,50 ✅ (correto)
- MAS aparecia visualmente confuso com crédito e débito
```

### 2. Faturas Pendentes no Fluxo de Caixa
**Sintoma:** Faturas de cartão importadas mas não pagas apareciam no fluxo de caixa

**Causa Raiz:**
Transações marcadas com `isPendingInvoice = true` não estavam sendo filtradas nos cálculos do fluxo de caixa.

**Comportamento Esperado:**
- Faturas pendentes (`isPendingInvoice = true`) só devem aparecer:
  - Na visualização da fatura do cartão
  - No fluxo de caixa APÓS serem pagas (`isSettled = true`)

## ✅ Correções Aplicadas

### Arquivo: `producao/src/core/engines/financialLogic.ts`

#### 1. Correção no Cálculo de Fluxo de Caixa (linha ~540-590)

**ANTES:**
```typescript
if (t.type === TransactionType.EXPENSE && isSharedContext) {
    if (!t.payerId || t.payerId === 'me') {
        // Mostrava valor total + adicionava reembolso como receita
        amount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
        const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
        const reimbursementBRL = SafeFinancialCalculator.safeCurrencyConversion(splitsTotal, account?.currency || 'BRL');
        data[monthIndex].Receitas += reimbursementBRL; // ❌ PROBLEMA
    } else {
        amount = calculateEffectiveTransactionValue(t);
    }
}
```

**DEPOIS:**
```typescript
// ✅ FIX 2025-12-25: Skip pending invoices
if (t.isPendingInvoice && !t.isSettled) {
    return;
}

if (t.type === TransactionType.EXPENSE) {
    const isSharedContext = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');
    if (isSharedContext) {
        // Usar apenas o valor efetivo (minha parte da despesa)
        amount = calculateEffectiveTransactionValue(t);
    }
}
```

#### 2. Correção no Time Travel (linha ~480-510)

Adicionado filtro para faturas pendentes no cálculo de ajuste do saldo inicial:

```typescript
// ✅ FIX 2025-12-25: Skip pending invoices from time travel calculation
if (t.isPendingInvoice && !t.isSettled) {
    return;
}
```

### Arquivo: `producao/src/features/dashboard/useOptimizedFinancialDashboard.ts`

#### 3. Correção nos Totais Mensais (linha ~160)

Adicionado filtro para faturas pendentes nas transações realizadas:

```typescript
const realizedTransactions = monthlyTransactions.filter((t: Transaction) => {
    // ✅ FIX 2025-12-25: Skip pending invoices
    if (t.isPendingInvoice && !t.isSettled) {
        return false;
    }
    
    const tDate = new Date(t.date);
    tDate.setHours(0, 0, 0, 0);
    return tDate <= referenceDate;
});
```

## 🎯 Resultado Esperado

### Transações Compartilhadas
```
Transação: Jantar compartilhado - R$ 199,00
- Minha parte: R$ 99,50
- Parte do amigo: R$ 99,50

Fluxo de Caixa DEPOIS (CORRETO):
- Despesas: R$ 99,50 (apenas minha parte)
- Receitas: R$ 0,00
- Impacto líquido: -R$ 99,50 ✅
```

### Faturas Pendentes
```
Fatura importada do cartão: R$ 850,00
- isPendingInvoice: true
- isSettled: false

Fluxo de Caixa:
- NÃO aparece (correto)

Quando pagar a fatura:
- isSettled: true
- Aparece no fluxo de caixa na data do pagamento ✅
```

## 🧪 Como Testar

1. **Teste de Transação Compartilhada:**
   - Criar uma despesa compartilhada de R$ 200,00
   - Dividir 50/50 com outra pessoa
   - Verificar no fluxo de caixa que aparece apenas R$ 100,00 de despesa
   - Não deve aparecer R$ 100,00 de receita

2. **Teste de Fatura Pendente:**
   - Importar fatura de cartão
   - Verificar que não aparece no fluxo de caixa
   - Marcar como paga
   - Verificar que agora aparece no fluxo de caixa

## 📝 Notas Técnicas

### Função `calculateEffectiveTransactionValue()`
Esta função calcula o valor efetivo de uma transação compartilhada:
- Se eu paguei: retorna apenas minha parte (total - splits)
- Se outra pessoa pagou: retorna minha parte do split

### Flag `isPendingInvoice`
- `true`: Fatura importada mas não paga
- `false` ou `undefined`: Transação normal
- Quando `isSettled = true`: Fatura foi paga

### Impacto em Outros Módulos
Estas correções afetam apenas:
- ✅ Fluxo de Caixa (Dashboard)
- ✅ Totais Mensais (Cards de Resumo)
- ❌ NÃO afeta: Visualização de faturas, lista de transações, relatórios

## 🔄 Histórico de Mudanças

- **23/12/2024:** Implementação inicial da lógica de reembolso visível
- **25/12/2024:** Correção para simplificar fluxo de caixa (apenas valor efetivo)
- **25/12/2024:** Adição de filtro para faturas pendentes

## ⚠️ Atenção

A lógica de visualização detalhada (mostrar valor total + reembolso) ainda pode ser útil em:
- Relatórios detalhados de despesas compartilhadas
- Visualização individual de transações
- Módulo de compartilhamento

Mas para o **fluxo de caixa**, a abordagem simplificada (apenas valor efetivo) é mais clara e intuitiva.
