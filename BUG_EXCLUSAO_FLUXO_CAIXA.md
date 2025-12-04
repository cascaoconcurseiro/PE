# 🐛 Bug: Lançamento Excluído Ainda Aparece no Fluxo de Caixa

## Problema Reportado

**Data**: 2025-12-04
**Usuário**: Wesley

### Descrição
1. **Lançamento fantasma no fluxo de caixa**: 
   - Lançamento: Janeiro de 2026 - R$ 100,00 (Competência) / R$ 100,00 (Caixa) / R$ 0,00 (Diferença)
   - O lançamento foi excluído mas ainda aparece no relatório de Fluxo de Caixa
   - **Comportamento esperado**: Quando um lançamento é excluído, deve sumir de TODOS os lugares

2. **Aviso de inconsistência não funciona**:
   - Aparece um aviso de inconsistência
   - Ao clicar no aviso, não mostra as inconsistências
   - **Comportamento esperado**: Deve mostrar sempre as inconsistências detectadas

## Análise Técnica

### 1. Filtro de Transações Excluídas

O arquivo `utils/transactionFilters.ts` já possui o filtro correto:

```typescript
export const shouldShowTransaction = (t: Transaction): boolean => {
    // Filter deleted transactions
    if (t.deleted) return false;
    
    // Filter unpaid debts (someone else paid, I owe them)
    if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
        return false;
    }
    
    return true;
};
```

### 2. Uso do Filtro no Fluxo de Caixa

O componente `Reports.tsx` (linha 33) já usa o filtro:

```typescript
const activeTransactions = transactions.filter(shouldShowTransaction);
```

### 3. Possíveis Causas

#### Causa 1: Transação não está marcada como `deleted`
- A exclusão pode não estar setando `t.deleted = true`
- Verificar a função `onDeleteTransaction`

#### Causa 2: Cache ou estado desatualizado
- O estado pode não estar sendo atualizado após a exclusão
- Verificar se o `useMemo` está recalculando corretamente

#### Causa 3: Múltiplas fontes de dados
- Pode haver transações duplicadas ou em diferentes estados
- Verificar se há sincronização pendente

### 4. Aviso de Inconsistência

**Problema**: Não foi encontrado nenhum componente que exibe avisos de inconsistência.

**Busca realizada**:
- ❌ Não encontrado: "inconsistência", "inconsistenc", "aviso"
- ✅ Encontrado: `AlertTriangle` usado em notificações e modais de confirmação

**Hipótese**: O "aviso de inconsistência" pode ser:
1. Uma notificação no sino (Bell icon)
2. Um alerta visual no próprio relatório
3. Um toast/mensagem temporária

## Plano de Correção

### Etapa 1: Investigar a Exclusão de Transações
- [ ] Verificar a implementação de `onDeleteTransaction` no `index.tsx`
- [ ] Confirmar se `deleted: true` está sendo setado
- [ ] Verificar se há lógica de exclusão física vs lógica

### Etapa 2: Verificar Estado e Renderização
- [ ] Adicionar logs no `cashFlowReport` para ver quais transações estão sendo processadas
- [ ] Verificar se o `useMemo` está recalculando após exclusão
- [ ] Confirmar se o estado de `transactions` está sendo atualizado

### Etapa 3: Localizar o Aviso de Inconsistência
- [ ] Procurar no código onde esse aviso é gerado
- [ ] Verificar se é uma notificação, toast ou alerta inline
- [ ] Implementar a exibição detalhada das inconsistências

### Etapa 4: Testes
- [ ] Criar uma transação de teste
- [ ] Excluir a transação
- [ ] Verificar se sumiu do fluxo de caixa
- [ ] Verificar se sumiu de todos os relatórios
- [ ] Testar o aviso de inconsistência

## Próximos Passos

1. Verificar o arquivo `index.tsx` para entender como `onDeleteTransaction` funciona
2. Procurar por componentes de validação ou avisos de inconsistência
3. Adicionar logs temporários para debug
4. Implementar correções necessárias
