# Análise de Bugs - Sistema Financeiro

## Data: 2025-12-02

### 🐛 Bug 1: Transações Excluídas Aparecem nos Relatórios

**Problema:**
Quando uma transação de cartão de crédito é excluída, ela continua aparecendo nos relatórios (Razão, Balancete, Fluxo de Caixa).

**Causa Raiz:**
O sistema usa **soft delete** (marca `deleted: true` no banco), mas os relatórios usam a lista de transações do estado React que é filtrada apenas na busca inicial (`eq('deleted', false)`). Quando uma transação é excluída:
1. O `supabaseService.delete()` marca `deleted: true` no banco
2. O `refresh()` é chamado e recarrega os dados
3. A query filtra `deleted: false` corretamente
4. **MAS** os componentes de relatório (`Reports.tsx`) usam `useMemo` com dependências `[transactions, accounts]`
5. O React pode não detectar a mudança se a referência do array não mudar adequadamente

**Arquivos Afetados:**
- `services/supabaseService.ts` (linha 134, 187)
- `hooks/useDataStore.ts` (linha 187-205)
- `components/Reports.tsx` (linhas 23-24, 27-91)
- `services/ledger.ts` (linha 23-97)

**Solução:**
Garantir que após exclusão, o estado seja atualizado corretamente e os memos sejam recalculados.

---

### 🐛 Bug 2: Faturas Importadas Não Aparecem no Mês Correto

**Problema:**
Quando faturas futuras/históricas são importadas via `CreditCardImportModal`, elas não aparecem no lançamento do mês respectivo, apesar de afetar o saldo.

**Causa Raiz:**
A função `getInvoiceData()` em `accountUtils.ts` filtra transações baseada no **ciclo de fechamento** (linhas 59-66):
```typescript
const startStr = startDate.toISOString().split('T')[0];
const endStr = closingDate.toISOString().split('T')[0];

const txs = transactions.filter(t => {
    if (t.accountId !== account.id) return false;
    return t.date >= startStr && t.date <= endStr;
});
```

Quando uma fatura é importada com `date: targetDate` (dia do fechamento), ela pode cair **fora** do ciclo se:
- A data for exatamente no dia de fechamento do mês seguinte
- A lógica de ciclo não considerar corretamente transações futuras

**Exemplo:**
- Cartão fecha dia 5
- Importo fatura de Janeiro com data `2025-01-05`
- Ao visualizar Janeiro, o ciclo pode ser `2024-12-06` a `2025-01-05`
- Mas a transação pode não aparecer devido à lógica de comparação de datas

**Arquivos Afetados:**
- `components/accounts/CreditCardImportModal.tsx` (linhas 22-36, 49-62)
- `services/accountUtils.ts` (linhas 3-91)

**Solução:**
Ajustar a data de criação das transações importadas para garantir que caiam dentro do ciclo correto, ou ajustar a lógica de filtragem.

---

### 🐛 Bug 3: Exclusão de Cartão Não Remove Transações dos Relatórios

**Problema:**
Quando um cartão é excluído, suas transações ainda aparecem nos relatórios (efeito cascata não funciona).

**Causa Raiz:**
O sistema faz **soft delete** apenas da conta (`handleDeleteAccount`), mas **NÃO** deleta ou marca como deletadas as transações associadas.

**Código Atual:**
```typescript
const handleDeleteAccount = async (id: string) => 
    performOperation(async () => { 
        await supabaseService.delete('accounts', id); 
    }, 'Conta excluída.');
```

**Solução:**
Implementar exclusão em cascata: ao deletar uma conta, deletar também todas as transações associadas.

---

### ⚡ Bug 4: Performance Lenta no Carregamento

**Problema:**
O sistema está demorando para carregar tanto no mobile quanto na web.

**Possíveis Causas:**
1. **Múltiplas queries sequenciais** no `fetchData()` (9 queries em `Promise.all`)
2. **Recálculos pesados** em `useMemo` sem otimização adequada
3. **Renderizações desnecessárias** de componentes
4. **Falta de índices** no banco de dados
5. **Bundle size** grande sem code splitting

**Arquivos para Investigar:**
- `hooks/useDataStore.ts` (linhas 114-164)
- `index.tsx` (renderização condicional)
- `services/supabaseService.ts` (queries)

**Soluções Propostas:**
1. Adicionar loading states progressivos
2. Implementar lazy loading de componentes
3. Otimizar queries com índices no Supabase
4. Adicionar cache de dados
5. Reduzir bundle com code splitting

---

## Prioridade de Correção

1. **ALTA** - Bug 1: Transações excluídas nos relatórios (afeta integridade dos dados)
2. **ALTA** - Bug 3: Exclusão em cascata (afeta integridade dos dados)
3. **MÉDIA** - Bug 2: Faturas importadas (afeta usabilidade)
4. **MÉDIA** - Bug 4: Performance (afeta experiência do usuário)

---

## Plano de Ação

### Fase 1: Correção de Integridade de Dados
- [ ] Implementar exclusão em cascata para contas
- [ ] Garantir que transações excluídas não apareçam em relatórios
- [ ] Adicionar testes para validar exclusões

### Fase 2: Correção de Lógica de Faturas
- [ ] Ajustar lógica de `getInvoiceData()` para incluir transações importadas
- [ ] Validar ciclos de fechamento com diferentes cenários
- [ ] Adicionar logs para debug de filtragem

### Fase 3: Otimização de Performance
- [ ] Implementar lazy loading
- [ ] Adicionar índices no banco
- [ ] Otimizar useMemo e useCallback
- [ ] Implementar cache de dados

