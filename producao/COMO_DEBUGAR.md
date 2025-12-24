# 🔍 COMO DEBUGAR O PROBLEMA

## O Problema

Você está vendo 10 parcelas no MESMO mês, e depois elas aparecem em TODOS os meses.

**MAS** o banco de dados está VAZIO - não há nenhuma parcela salva!

Isso significa que o problema está no **FRONTEND** - as parcelas estão sendo geradas na memória mas não estão sendo salvas no banco.

---

## 🧪 TESTE 1: Verificar o Console do Navegador

### Passo 1: Abra o Console
1. Pressione **F12**
2. Vá na aba **"Console"**
3. Limpe o console (ícone 🚫 ou Ctrl+L)

### Passo 2: Ative o Debug
1. Copie TODO o conteúdo do arquivo `DEBUG_CONSOLE.js`
2. Cole no console
3. Pressione Enter
4. Deve aparecer: "✅ DEBUG ATIVADO!"

### Passo 3: Crie uma Transação Parcelada
1. Clique no botão "+"
2. Preencha:
   - Descrição: "Teste Debug"
   - Valor: **100**
   - Selecione um cartão de crédito
   - Marque "Parcelado"
   - Parcelas: **10**
3. Clique em "Salvar"

### Passo 4: Analise os Logs

Você deve ver no console:

```
🔵 CHAMADA RPC create_financial_record: [...]
📦 DADOS ENVIADOS: {
  amount: 10,
  date: "2025-01-24",
  description: "Teste Debug (1/10)",
  is_installment: true,
  current_installment: 1,
  total_installments: 10,
  series_id: "..."
}
✅ RESPOSTA RPC: {...}
```

**Isso deve aparecer 10 VEZES** (uma para cada parcela).

### O Que Verificar:

1. **Quantas vezes aparece "CHAMADA RPC"?**
   - ✅ Deve ser 10 vezes
   - ❌ Se for 1 vez, o problema é que não está gerando as 10 parcelas

2. **As datas são diferentes?**
   - ✅ Deve ser: 2025-01-24, 2025-02-24, 2025-03-24, etc.
   - ❌ Se todas forem iguais, o problema está no cálculo da data

3. **Os valores estão corretos?**
   - ✅ Deve ser 10 para cada parcela (100 ÷ 10)
   - ❌ Se for 100, o problema está no cálculo do valor

4. **Há erros na resposta?**
   - ❌ Se houver erro, copie e me envie

---

## 🧪 TESTE 2: Verificar o Banco de Dados

Execute no Supabase SQL Editor:

```sql
-- Ver as últimas transações criadas
SELECT 
    id,
    description,
    amount,
    date,
    current_installment,
    total_installments,
    is_installment,
    series_id,
    created_at
FROM transactions 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

**O que deve aparecer:**
- 10 linhas (uma para cada parcela)
- Datas diferentes (uma por mês)
- Valores corretos (10 cada)

**Se não aparecer nada:**
- As transações não estão sendo salvas no banco
- Há algum erro silencioso

---

## 🧪 TESTE 3: Verificar o Cache

1. Feche COMPLETAMENTE o navegador
2. Abra novamente
3. Pressione **Ctrl+Shift+R** para recarregar sem cache
4. Tente criar a transação novamente

---

## 📊 ME ENVIE:

1. **Print do console** mostrando os logs do DEBUG_CONSOLE.js
2. **Print da tela** mostrando as parcelas que você está vendo
3. **Resultado da query SQL** do TESTE 2

Com essas informações eu vou conseguir identificar exatamente onde está o problema!

---

## 💡 POSSÍVEIS CAUSAS:

### Causa 1: Parcelas não estão sendo salvas no banco
- **Sintoma:** Console mostra 10 chamadas RPC, mas banco está vazio
- **Solução:** Verificar se há erro na resposta do RPC

### Causa 2: Datas estão sendo calculadas erradas
- **Sintoma:** Console mostra todas as datas iguais
- **Solução:** Corrigir o cálculo de data no código

### Causa 3: Interface está mostrando dados em cache
- **Sintoma:** Banco está vazio mas interface mostra parcelas
- **Solução:** Limpar cache e recarregar

### Causa 4: Está usando código antigo
- **Sintoma:** Código não foi atualizado
- **Solução:** Verificar se o arquivo foi salvo e recompilar
