# ✅ Checklist de Testes Pós-Correções

**Execute estes testes APÓS aplicar o script SQL**

---

## 🎯 Objetivo

Validar que todas as correções foram aplicadas corretamente e o sistema está funcionando perfeitamente.

---

## 📝 Testes Obrigatórios

### 1️⃣ Teste de Transação Simples (2 min)

**Objetivo:** Verificar criação básica

- [ ] Abra o sistema
- [ ] Clique em "Nova Transação"
- [ ] Crie uma despesa de R$ 100
- [ ] Verifique se apareceu na lista
- [ ] Verifique se o saldo foi atualizado

**Resultado Esperado:** ✅ Transação criada e saldo correto

---

### 2️⃣ Teste de Transferência Multi-Moeda (3 min)

**Objetivo:** Validar correção de validação multi-moeda

**Pré-requisito:** Ter 2 contas com moedas diferentes (ex: BRL e USD)

- [ ] Crie uma transferência de conta BRL para USD
- [ ] Insira valor de origem: R$ 100
- [ ] Insira valor de destino: $ 20
- [ ] Salve a transação
- [ ] Verifique se os saldos estão corretos:
  - Conta BRL: -R$ 100
  - Conta USD: +$ 20

**Resultado Esperado:** ✅ Transferência com conversão correta

---

### 3️⃣ Teste de Parcelamento Compartilhado (5 min)

**Objetivo:** Validar correção de arredondamento

**Pré-requisito:** Ter um membro da família cadastrado

- [ ] Crie uma despesa de R$ 100
- [ ] Marque como parcelada em 3x
- [ ] Marque como compartilhada 50/50 com um membro
- [ ] Salve e verifique as 3 parcelas:
  - Parcela 1: R$ 33,33 (Membro: R$ 16,67)
  - Parcela 2: R$ 33,33 (Membro: R$ 16,67)
  - Parcela 3: R$ 33,34 (Membro: R$ 16,66)
- [ ] Some os valores:
  - Total: R$ 100,00 ✅
  - Total Membro: R$ 50,00 ✅

**Resultado Esperado:** ✅ Sem erro de centavos

---

### 4️⃣ Teste de Performance (2 min)

**Objetivo:** Validar índices aplicados

- [ ] Abra a página de Transações
- [ ] Filtre por mês atual
- [ ] Observe o tempo de carregamento
- [ ] Abra a página de Relatórios
- [ ] Observe o tempo de carregamento

**Resultado Esperado:** ✅ Carregamento instantâneo (< 1 segundo)

---

### 5️⃣ Teste de Despesa Compartilhada (3 min)

**Objetivo:** Validar lógica de compartilhamento

**Pré-requisito:** Ter um membro da família cadastrado

- [ ] Crie uma despesa de R$ 200
- [ ] Marque como compartilhada
- [ ] Atribua R$ 150 para o membro
- [ ] Salve a transação
- [ ] Vá em "Compartilhado"
- [ ] Verifique se aparece:
  - "Membro deve R$ 150,00 para Você"

**Resultado Esperado:** ✅ Dívida calculada corretamente

---

### 6️⃣ Teste de Exclusão em Cascata (2 min)

**Objetivo:** Validar exclusão de conta com transações

- [ ] Crie uma conta de teste
- [ ] Crie 2 transações nessa conta
- [ ] Tente excluir a conta
- [ ] Confirme a exclusão
- [ ] Verifique se:
  - Conta foi excluída
  - Transações foram excluídas
  - Nenhum erro apareceu

**Resultado Esperado:** ✅ Exclusão em cascata funcionando

---

### 7️⃣ Teste de Cartão de Crédito (3 min)

**Objetivo:** Validar cálculo de fatura

**Pré-requisito:** Ter um cartão de crédito cadastrado

- [ ] Crie 3 despesas no cartão
- [ ] Vá em "Contas" > Cartão
- [ ] Verifique a fatura atual
- [ ] Verifique se o total está correto
- [ ] Verifique se as datas estão corretas

**Resultado Esperado:** ✅ Fatura calculada corretamente

---

## 🔍 Testes Opcionais (Se tiver tempo)

### 8️⃣ Teste de Viagem

- [ ] Crie uma viagem
- [ ] Adicione despesas à viagem
- [ ] Vá em "Relatórios" > "Viagens"
- [ ] Verifique se os gastos aparecem

**Resultado Esperado:** ✅ Relatório de viagem correto

---

### 9️⃣ Teste de Investimentos

- [ ] Adicione um ativo
- [ ] Registre uma compra
- [ ] Registre uma venda
- [ ] Verifique o lucro/prejuízo

**Resultado Esperado:** ✅ Cálculos de investimento corretos

---

### 🔟 Teste de Orçamento

- [ ] Crie um orçamento mensal
- [ ] Adicione despesas na categoria
- [ ] Verifique o progresso do orçamento

**Resultado Esperado:** ✅ Orçamento atualizado em tempo real

---

## 📊 Validação do Banco de Dados

### Verificar Campos Adicionados

Execute no Supabase SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN (
    'related_member_id',
    'settled_by_tx_id',
    'reconciled',
    'reconciled_with',
    'destination_amount',
    'exchange_rate'
  );
```

**Resultado Esperado:** 6 linhas retornadas

---

### Verificar Índices Criados

```sql
SELECT indexname 
FROM pg_indexes
WHERE tablename = 'transactions'
  AND indexname LIKE 'idx_%';
```

**Resultado Esperado:** 9 índices listados

---

### Verificar Constraints

```sql
SELECT conname 
FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
  AND conname LIKE 'check_%';
```

**Resultado Esperado:** 4 constraints listadas

---

## ✅ Checklist Final

Após executar todos os testes:

- [ ] Todos os testes obrigatórios passaram
- [ ] Nenhum erro apareceu no console
- [ ] Performance está boa (< 1s)
- [ ] Campos do banco foram adicionados
- [ ] Índices foram criados
- [ ] Constraints foram aplicadas

---

## 🐛 E se algo falhar?

### Erro ao criar transação
1. Verifique o console do navegador (F12)
2. Verifique se o script SQL foi executado
3. Tente fazer refresh (F5)

### Performance ainda lenta
1. Verifique se os índices foram criados
2. Execute a query de verificação de índices
3. Aguarde alguns minutos (cache do banco)

### Erro de validação
1. Verifique se as constraints foram criadas
2. Execute a query de verificação de constraints
3. Verifique os dados que está inserindo

---

## 🎉 Tudo Passou?

**PARABÉNS!** 🎊

Seu sistema está:
- ✅ 100% funcional
- ✅ Otimizado
- ✅ Validado
- ✅ Pronto para produção

---

**Tempo Total:** ~20 minutos  
**Dificuldade:** Fácil  
**Resultado:** Sistema completo e testado
