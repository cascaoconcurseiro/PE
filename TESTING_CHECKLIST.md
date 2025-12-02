# ✅ Checklist de Testes - Correções Implementadas

## 📋 Como Usar Este Checklist

1. Marque cada item após testar
2. Anote qualquer problema encontrado
3. Se algo não funcionar, revise a seção "Troubleshooting"

---

## 🔧 Pré-Requisitos

### 1. Aplicar Índices no Banco de Dados

- [ ] Abrir Supabase Dashboard
- [ ] Ir em **SQL Editor** > **New Query**
- [ ] Copiar conteúdo do arquivo `APPLY_INDEXES.sql`
- [ ] Executar o script
- [ ] Verificar se todos os índices foram criados (última query do script)

**Resultado Esperado:** 16 índices criados com sucesso

---

## 🧪 Testes de Funcionalidade

### Bug 1: Transações Excluídas nos Relatórios

#### Teste 1.1: Excluir Transação de Cartão
- [ ] Ir em **Contas** > Selecionar um cartão de crédito
- [ ] Visualizar uma transação na fatura
- [ ] Excluir a transação
- [ ] Ir em **Relatórios** > **Razão**
- [ ] **Verificar:** Transação NÃO deve aparecer no razão
- [ ] Ir em **Relatórios** > **Balancete**
- [ ] **Verificar:** Valores devem estar corretos (sem a transação excluída)
- [ ] Ir em **Relatórios** > **Fluxo de Caixa**
- [ ] **Verificar:** Valores devem estar corretos (sem a transação excluída)

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

#### Teste 1.2: Excluir Transação de Conta Bancária
- [ ] Ir em **Contas** > Selecionar uma conta bancária
- [ ] Visualizar o extrato
- [ ] Excluir uma transação
- [ ] Ir em **Relatórios** > **Razão**
- [ ] **Verificar:** Transação NÃO deve aparecer
- [ ] **Verificar:** Saldo da conta deve estar correto

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

### Bug 2: Faturas Importadas

#### Teste 2.1: Importar Fatura do Mês Atual
- [ ] Ir em **Contas** > Selecionar um cartão de crédito
- [ ] Clicar em **Importar Dívidas Históricas/Futuras**
- [ ] Preencher valor para o mês atual (ex: R$ 500,00)
- [ ] Salvar
- [ ] Visualizar a fatura do mês atual
- [ ] **Verificar:** Transação importada deve aparecer na lista
- [ ] **Verificar:** Valor da fatura deve incluir a importação

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

#### Teste 2.2: Importar Fatura Futura
- [ ] Ir em **Contas** > Selecionar um cartão de crédito
- [ ] Clicar em **Importar Dívidas Históricas/Futuras**
- [ ] Preencher valor para um mês futuro (ex: próximo mês, R$ 300,00)
- [ ] Salvar
- [ ] Navegar para o mês futuro usando as setas
- [ ] **Verificar:** Transação importada deve aparecer na fatura
- [ ] **Verificar:** Valor da fatura deve estar correto

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

#### Teste 2.3: Importar Múltiplas Faturas
- [ ] Ir em **Contas** > Selecionar um cartão de crédito
- [ ] Clicar em **Importar Dívidas Históricas/Futuras**
- [ ] Preencher valores para 3 meses diferentes
- [ ] Salvar
- [ ] Verificar cada mês individualmente
- [ ] **Verificar:** Cada fatura deve aparecer no mês correto

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

### Bug 3: Exclusão em Cascata

#### Teste 3.1: Excluir Cartão de Crédito
- [ ] Criar um cartão de crédito de teste
- [ ] Adicionar 3 transações neste cartão
- [ ] Ir em **Relatórios** > **Razão**
- [ ] **Verificar:** As 3 transações aparecem no razão
- [ ] Voltar em **Contas**
- [ ] Excluir o cartão de crédito
- [ ] Confirmar exclusão
- [ ] Ir em **Relatórios** > **Razão**
- [ ] **Verificar:** As 3 transações NÃO devem mais aparecer
- [ ] Ir em **Dashboard**
- [ ] **Verificar:** Saldos devem estar corretos (sem o cartão)

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

#### Teste 3.2: Excluir Conta Bancária
- [ ] Criar uma conta bancária de teste
- [ ] Adicionar 2 transações nesta conta
- [ ] Excluir a conta
- [ ] Ir em **Relatórios** > **Balancete**
- [ ] **Verificar:** Transações NÃO devem aparecer
- [ ] **Verificar:** Conta NÃO deve aparecer na lista

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

### Bug 4: Performance

#### Teste 4.1: Tempo de Carregamento Inicial (Desktop)
- [ ] Limpar cache do navegador (Ctrl+Shift+Del)
- [ ] Abrir DevTools (F12) > Network tab
- [ ] Recarregar a página (Ctrl+R)
- [ ] Anotar tempo de carregamento total
- [ ] **Verificar:** Deve ser menor que 3 segundos

**Tempo Medido:** _______ segundos

**Status:** ⬜ Passou (< 3s) | ⬜ Falhou (≥ 3s)

---

#### Teste 4.2: Tempo de Carregamento (Mobile)
- [ ] Abrir DevTools (F12) > Network tab
- [ ] Ativar throttling "Fast 3G"
- [ ] Recarregar a página
- [ ] Anotar tempo de carregamento
- [ ] **Verificar:** Deve ser menor que 8 segundos

**Tempo Medido:** _______ segundos

**Status:** ⬜ Passou (< 8s) | ⬜ Falhou (≥ 8s)

---

#### Teste 4.3: Navegação Entre Páginas
- [ ] Ir em **Dashboard**
- [ ] Ir em **Transações**
- [ ] Ir em **Relatórios**
- [ ] Ir em **Contas**
- [ ] **Verificar:** Cada transição deve ser instantânea (< 500ms)

**Status:** ⬜ Passou | ⬜ Falhou

**Observações:**
```
_____________________________________________________
_____________________________________________________
```

---

#### Teste 4.4: Cálculo de Relatórios
- [ ] Ir em **Relatórios** > **Razão**
- [ ] Abrir DevTools > Performance tab
- [ ] Iniciar gravação
- [ ] Trocar para aba **Balancete**
- [ ] Parar gravação
- [ ] **Verificar:** Tempo de cálculo deve ser < 300ms

**Tempo Medido:** _______ ms

**Status:** ⬜ Passou (< 300ms) | ⬜ Falhou (≥ 300ms)

---

## 🔍 Testes de Regressão

### Funcionalidades Existentes (Garantir que não quebraram)

#### Teste R1: Adicionar Transação
- [ ] Adicionar uma transação de despesa
- [ ] **Verificar:** Aparece na lista de transações
- [ ] **Verificar:** Saldo da conta atualiza corretamente

**Status:** ⬜ Passou | ⬜ Falhou

---

#### Teste R2: Editar Transação
- [ ] Editar uma transação existente
- [ ] Alterar valor e descrição
- [ ] Salvar
- [ ] **Verificar:** Alterações foram aplicadas
- [ ] **Verificar:** Saldo atualiza corretamente

**Status:** ⬜ Passou | ⬜ Falhou

---

#### Teste R3: Parcelamento
- [ ] Criar uma transação parcelada (3x)
- [ ] **Verificar:** 3 transações foram criadas
- [ ] **Verificar:** Valores estão corretos
- [ ] **Verificar:** Datas estão em meses consecutivos

**Status:** ⬜ Passou | ⬜ Falhou

---

#### Teste R4: Transferência
- [ ] Criar uma transferência entre contas
- [ ] **Verificar:** Saldo da origem diminui
- [ ] **Verificar:** Saldo do destino aumenta
- [ ] **Verificar:** Aparece no extrato de ambas as contas

**Status:** ⬜ Passou | ⬜ Falhou

---

#### Teste R5: Pagar Fatura
- [ ] Ir em um cartão de crédito com fatura aberta
- [ ] Clicar em **Pagar Fatura**
- [ ] Selecionar conta de origem
- [ ] Confirmar pagamento
- [ ] **Verificar:** Fatura foi zerada
- [ ] **Verificar:** Saldo da conta origem diminuiu

**Status:** ⬜ Passou | ⬜ Falhou

---

## 📊 Resumo dos Testes

### Estatísticas
- **Total de Testes:** 15
- **Testes Passados:** _____ / 15
- **Testes Falhados:** _____ / 15
- **Taxa de Sucesso:** _____ %

### Bugs Encontrados
```
1. _____________________________________________________
   _____________________________________________________

2. _____________________________________________________
   _____________________________________________________

3. _____________________________________________________
   _____________________________________________________
```

---

## 🔧 Troubleshooting

### Problema: Transações excluídas ainda aparecem

**Solução:**
1. Limpar cache do navegador
2. Fazer logout e login novamente
3. Verificar se o filtro `!t.deleted` está presente em todos os arquivos

---

### Problema: Faturas importadas não aparecem

**Solução:**
1. Verificar se a data da transação está correta (dia 1 do mês)
2. Verificar se o ciclo de fechamento está configurado corretamente
3. Navegar para o mês usando as setas (não o seletor de mês)

---

### Problema: Performance ainda lenta

**Solução:**
1. Verificar se os índices foram criados no banco:
   ```sql
   select count(*) from pg_indexes where schemaname = 'public';
   ```
   Deve retornar pelo menos 16 índices

2. Limpar cache do navegador
3. Verificar conexão com internet
4. Verificar se há muitos dados (> 10.000 transações)

---

### Problema: Exclusão em cascata não funciona

**Solução:**
1. Verificar se o código em `useDataStore.ts` foi atualizado
2. Fazer hard refresh (Ctrl+Shift+R)
3. Verificar console do navegador por erros

---

## ✅ Aprovação Final

- [ ] Todos os testes críticos passaram
- [ ] Performance está aceitável
- [ ] Nenhum bug de regressão encontrado
- [ ] Sistema está pronto para uso

**Assinatura:** _____________________  
**Data:** _____________________

---

**Última Atualização:** 2025-12-02 19:30 BRT

