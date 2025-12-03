# Bug: Despesas Compartilhadas Aparecem Antes da Compensação

## Data: 2025-12-02

---

## 🐛 Problema Identificado

Quando você cria uma despesa onde **outra pessoa pagou**, o sistema está:

1. ✅ **Correto:** Não afeta o saldo imediatamente
2. ❌ **Errado:** Aparece na lista de transações imediatamente
3. ❌ **Errado:** Aparece nos relatórios antes da compensação

### Comportamento Atual (Errado)

```
1. João pagou R$ 100 no restaurante
2. Você divide 50/50 com João
3. Sistema cria transação de R$ 50 na sua conta IMEDIATAMENTE
4. Transação aparece no extrato (mas não deveria)
5. Quando você compensa, cria OUTRA transação de R$ 50
6. Resultado: Duplicação visual
```

### Comportamento Esperado (Correto)

```
1. João pagou R$ 100 no restaurante
2. Você divide 50/50 com João
3. Sistema registra a DÍVIDA (R$ 50) apenas no módulo "Compartilhado"
4. Transação NÃO aparece no extrato
5. Quando você compensa/paga:
   - Escolhe de onde sai o dinheiro (ex: Conta Corrente)
   - AGORA SIM cria uma transação de R$ 50
   - Transação aparece no extrato
6. Resultado: Apenas 1 transação, no momento certo
```

---

## 🔍 Análise Técnica

### Arquivos Envolvidos

1. **`services/balanceEngine.ts`** (linhas 44-51)
   - ✅ Já não afeta saldo quando `someoneElsePaid = true`
   - Está correto, não precisa mudar

2. **`components/Shared.tsx`** (linhas 62-116)
   - ✅ Gera corretamente as "invoices" (faturas a pagar/receber)
   - Está correto, não precisa mudar

3. **`components/Transactions.tsx`** e **`components/Reports.tsx`**
   - ❌ Mostram TODAS as transações, incluindo dívidas não pagas
   - **PRECISA FILTRAR** transações onde `payerId !== 'me' && !isSettled`

4. **`services/accountUtils.ts`** (funções de extrato)
   - ❌ Incluem transações de dívidas não pagas
   - **PRECISA FILTRAR**

---

## 💡 Solução

### Opção 1: Filtrar na Visualização (Recomendado)

Adicionar filtro em todos os lugares que mostram transações:

```typescript
// Filtrar transações que não devem aparecer ainda
const visibleTransactions = transactions.filter(t => {
    // Se alguém pagou por mim e ainda não compensei, NÃO mostrar
    if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
        return false;
    }
    return true;
});
```

**Vantagens:**
- Mantém o histórico completo no banco
- Fácil de implementar
- Não quebra nada existente

**Desvantagens:**
- Precisa aplicar filtro em vários lugares

---

### Opção 2: Não Criar Transação Até Compensar (Mais Complexo)

Mudar a lógica para:
1. Quando alguém paga por você, **não cria transação**
2. Apenas registra no módulo "Compartilhado"
3. Quando compensar, **aí sim** cria a transação

**Vantagens:**
- Mais limpo conceitualmente
- Não precisa filtrar depois

**Desvantagens:**
- Mudança grande na arquitetura
- Pode quebrar funcionalidades existentes
- Mais difícil de implementar

---

## 🎯 Recomendação

**Implementar Opção 1** (Filtrar na Visualização)

### Locais para Aplicar o Filtro

1. ✅ `components/Transactions.tsx` - Lista de transações
2. ✅ `components/Reports.tsx` - Todos os relatórios
3. ✅ `services/accountUtils.ts` - Extratos e faturas
4. ✅ `services/ledger.ts` - Razão contábil
5. ✅ `components/Dashboard.tsx` - Resumos

---

## 📝 Implementação

### Criar Função Utilitária

```typescript
// utils/transactionFilters.ts
export const shouldShowTransaction = (t: Transaction): boolean => {
    // Filtrar transações deletadas
    if (t.deleted) return false;
    
    // Filtrar dívidas não compensadas (alguém pagou por mim)
    if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
        return false;
    }
    
    return true;
};

export const getVisibleTransactions = (transactions: Transaction[]): Transaction[] => {
    return transactions.filter(shouldShowTransaction);
};
```

### Aplicar em Cada Componente

```typescript
// Exemplo: components/Transactions.tsx
import { getVisibleTransactions } from '../utils/transactionFilters';

const visibleTransactions = useMemo(() => 
    getVisibleTransactions(transactions),
    [transactions]
);

// Usar visibleTransactions ao invés de transactions
```

---

## ⚠️ Casos Especiais

### Caso 1: Eu Paguei, Outros Devem
- **Comportamento:** Transação aparece normalmente
- **Razão:** O dinheiro saiu da minha conta
- **Filtro:** NÃO aplicar

### Caso 2: Outro Pagou, Eu Devo
- **Comportamento:** Transação NÃO aparece até compensar
- **Razão:** O dinheiro ainda não saiu da minha conta
- **Filtro:** APLICAR

### Caso 3: Compensação/Pagamento
- **Comportamento:** Nova transação é criada e aparece
- **Razão:** Agora o dinheiro saiu/entrou na conta
- **Filtro:** NÃO aplicar (é uma transação normal)

---

## 🧪 Testes Necessários

### Teste 1: Criar Dívida
1. João paga R$ 100
2. Dividir 50/50
3. **Verificar:** Transação NÃO aparece no extrato
4. **Verificar:** Dívida aparece em "Compartilhado"

### Teste 2: Compensar Dívida
1. Ir em "Compartilhado"
2. Clicar em "Pagar" para João
3. Selecionar conta de origem
4. Confirmar
5. **Verificar:** Nova transação de R$ 50 aparece no extrato
6. **Verificar:** Dívida some de "Compartilhado"

### Teste 3: Relatórios
1. Criar dívida não compensada
2. Ir em "Relatórios" > "Razão"
3. **Verificar:** Dívida NÃO aparece
4. Compensar dívida
5. **Verificar:** Pagamento aparece

---

## 📊 Impacto

### Antes da Correção
- Transações duplicadas visualmente
- Confusão sobre o que foi pago
- Relatórios incorretos

### Depois da Correção
- Apenas transações reais aparecem
- Clareza sobre dívidas vs pagamentos
- Relatórios precisos

---

**Status:** 📋 Análise Completa - Pronto para Implementar

