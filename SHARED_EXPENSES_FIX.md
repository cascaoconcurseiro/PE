# Correção: Despesas Compartilhadas Aparecem Antes da Compensação

## Data: 2025-12-02

---

## 🎯 Problema Resolvido

**Antes:** Quando outra pessoa pagava uma despesa compartilhada, o sistema lançava imediatamente a sua parte no extrato e relatórios, mesmo antes de você compensar/pagar.

**Depois:** Transações onde outra pessoa pagou **só aparecem** depois que você compensar no módulo "Compartilhado".

---

## ✅ Solução Implementada

### 1. Função Utilitária Criada

**Arquivo:** `utils/transactionFilters.ts`

```typescript
export const shouldShowTransaction = (t: Transaction): boolean => {
    // Filtrar transações deletadas
    if (t.deleted) return false;
    
    // Filtrar dívidas não pagas (alguém pagou por mim)
    if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
        return false;
    }
    
    return true;
};
```

**Lógica:**
- ✅ Mostra transações normais
- ✅ Mostra transações onde EU paguei (mesmo compartilhadas)
- ❌ **NÃO** mostra dívidas não compensadas (outro pagou)
- ❌ **NÃO** mostra transações deletadas

---

### 2. Arquivos Modificados

#### ✏️ `services/ledger.ts`
- Aplica `shouldShowTransaction` no razão contábil
- Dívidas não pagas não aparecem no razão

#### ✏️ `components/Reports.tsx`
- Aplica `shouldShowTransaction` no fluxo de caixa
- Dívidas não pagas não aparecem nos relatórios

#### ✏️ `services/accountUtils.ts`
- Aplica `shouldShowTransaction` em 3 funções:
  - `getInvoiceData()` - Faturas de cartão
  - `getCommittedBalance()` - Saldo comprometido
  - `getBankExtract()` - Extrato bancário
- Dívidas não pagas não aparecem em extratos

---

## 📊 Fluxo Correto Agora

### Cenário 1: Outra Pessoa Paga

```
1. João paga R$ 100 no restaurante
2. Você divide 50/50 com João
3. Sistema cria transação com:
   - amount: R$ 100
   - payerId: "joao-id"
   - sharedWith: [{ memberId: "joao-id", amount: 50 }]
   - isSettled: false

4. ❌ Transação NÃO aparece no seu extrato
5. ✅ Dívida aparece em "Compartilhado" (R$ 50 a pagar)
6. ✅ Saldo da sua conta NÃO é afetado

7. Você vai em "Compartilhado" > Clica em "Pagar"
8. Seleciona "Conta Corrente" como origem
9. Confirma pagamento

10. Sistema cria NOVA transação:
    - amount: R$ 50
    - type: EXPENSE
    - category: TRANSFER
    - accountId: "conta-corrente-id"
    - description: "Pagamento Acerto - João"

11. Sistema marca a dívida original como paga:
    - isSettled: true
    - settledAt: "2025-12-02T19:40:00Z"

12. ✅ AGORA SIM aparece transação de R$ 50 no extrato
13. ✅ Saldo da conta corrente diminui R$ 50
14. ✅ Dívida some de "Compartilhado"
```

---

### Cenário 2: Você Paga

```
1. Você paga R$ 100 no restaurante
2. Divide 50/50 com João
3. Sistema cria transação com:
   - amount: R$ 100
   - payerId: "me" (ou vazio)
   - sharedWith: [{ memberId: "joao-id", amount: 50 }]

4. ✅ Transação aparece IMEDIATAMENTE no extrato (R$ 100)
5. ✅ Saldo diminui R$ 100 (você pagou)
6. ✅ Crédito aparece em "Compartilhado" (R$ 50 a receber de João)

7. João vai pagar você
8. Você vai em "Compartilhado" > Clica em "Receber"
9. Seleciona onde quer receber (ex: Conta Corrente)
10. Confirma

11. Sistema cria transação de RECEITA:
    - amount: R$ 50
    - type: INCOME
    - accountId: "conta-corrente-id"
    - description: "Recebimento Acerto - João"

12. Sistema marca o split como pago:
    - sharedWith[0].isSettled: true
    - sharedWith[0].settledAt: "2025-12-02T19:40:00Z"

13. ✅ Transação de recebimento aparece no extrato
14. ✅ Saldo aumenta R$ 50
15. ✅ Crédito some de "Compartilhado"
```

---

## 🧪 Como Testar

### Teste 1: Criar Dívida (Outro Pagou)

1. Ir em **Transações** > **Nova Transação**
2. Preencher:
   - Descrição: "Jantar no restaurante"
   - Valor: R$ 100
   - Tipo: Despesa
   - Conta: (qualquer)
   - **Quem pagou:** Selecionar um membro da família (ex: João)
   - **Compartilhar:** Dividir com João (50/50)
3. Salvar

**Verificações:**
- ❌ Transação **NÃO** deve aparecer em "Transações"
- ❌ Transação **NÃO** deve aparecer no extrato da conta
- ❌ Saldo da conta **NÃO** deve mudar
- ✅ Dívida de R$ 50 deve aparecer em "Compartilhado" > João (A Pagar)
- ❌ Transação **NÃO** deve aparecer em "Relatórios" > "Razão"

---

### Teste 2: Compensar Dívida

1. Ir em **Compartilhado**
2. Localizar João
3. Clicar em **Pagar** (botão vermelho)
4. Selecionar conta de origem (ex: Conta Corrente)
5. Confirmar

**Verificações:**
- ✅ Nova transação de R$ 50 aparece em "Transações"
- ✅ Transação aparece no extrato da Conta Corrente
- ✅ Saldo da Conta Corrente diminui R$ 50
- ✅ Dívida some de "Compartilhado"
- ✅ Transação de pagamento aparece em "Relatórios" > "Razão"

---

### Teste 3: Você Paga (Comportamento Normal)

1. Ir em **Transações** > **Nova Transação**
2. Preencher:
   - Descrição: "Cinema"
   - Valor: R$ 60
   - Tipo: Despesa
   - Conta: Cartão de Crédito
   - **Quem pagou:** Deixar vazio ou "Você"
   - **Compartilhar:** Dividir com Maria (50/50)
3. Salvar

**Verificações:**
- ✅ Transação de R$ 60 aparece **IMEDIATAMENTE** em "Transações"
- ✅ Transação aparece na fatura do cartão
- ✅ Limite do cartão diminui R$ 60
- ✅ Crédito de R$ 30 aparece em "Compartilhado" > Maria (A Receber)
- ✅ Transação aparece em "Relatórios" > "Razão"

---

## 📁 Arquivos Criados/Modificados

### 📄 Criados (2)
1. ✅ `utils/transactionFilters.ts` - Função de filtro
2. ✅ `BUG_SHARED_EXPENSES.md` - Análise do problema
3. ✅ `SHARED_EXPENSES_FIX.md` - Este arquivo

### ✏️ Modificados (4)
1. ✅ `services/ledger.ts` - Filtro no razão
2. ✅ `components/Reports.tsx` - Filtro nos relatórios
3. ✅ `services/accountUtils.ts` - Filtro em 3 funções
4. ✅ `utils/transactionFilters.ts` - Função criada

---

## ⚠️ Importante

### O que NÃO mudou

- ✅ Módulo "Compartilhado" continua mostrando TODAS as dívidas
- ✅ Cálculo de saldo continua correto (já estava)
- ✅ Lógica de compensação continua igual

### O que mudou

- ✅ Dívidas não pagas **não aparecem** em extratos
- ✅ Dívidas não pagas **não aparecem** em relatórios
- ✅ Apenas transações **reais** (onde dinheiro saiu/entrou) aparecem

---

## 🎉 Resultado

**Antes:**
- Confusão sobre o que foi pago
- Transações "fantasma" no extrato
- Relatórios incorretos

**Depois:**
- Clareza total sobre dívidas vs pagamentos
- Apenas transações reais no extrato
- Relatórios precisos

---

**Status:** ✅ Implementado e Pronto para Testes

**Última Atualização:** 2025-12-02 19:40 BRT

