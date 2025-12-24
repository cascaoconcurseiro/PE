# Como Deletar Parcelas Antigas e Testar Novamente

## Problema Identificado

As parcelas que você está vendo com valor errado (R$ 95,00 cada) foram criadas ANTES das correções serem aplicadas.

As parcelas no banco mostram:
- Série: b89523c4-3f06-420a-b439-bce6a041b533
- Descrição: "Seguro - Carro"
- Valor: R$ 95,00 cada (ERRADO - deveria ser R$ 9,50)
- Datas: Corretas (uma por mês de jan a out/2026)

## Solução

### Opção 1: Deletar via Interface (Recomendado)

1. Abra a tela de transações
2. Encontre a série "Seguro - Carro"
3. Clique em uma das parcelas
4. Escolha "Deletar Série Completa"
5. Confirme

### Opção 2: Deletar via SQL (Mais Rápido)

Execute no Supabase Dashboard > SQL Editor:

```sql
-- Deletar a série específica de parcelas antigas
DELETE FROM transactions 
WHERE series_id = 'b89523c4-3f06-420a-b439-bce6a041b533';

-- OU deletar TODAS as parcelas antigas (cuidado!)
-- DELETE FROM transactions WHERE is_installment = true;
```

### Opção 3: Marcar como Deletadas (Soft Delete)

```sql
-- Marcar série como deletada (não remove do banco)
UPDATE transactions 
SET deleted = true, updated_at = NOW()
WHERE series_id = 'b89523c4-3f06-420a-b439-bce6a041b533';
```

## Teste Após Deletar

### 1. Teste com Formulário Normal

1. Recarregue a aplicação (Ctrl+Shift+R)
2. Clique no botão "+" para adicionar transação
3. Preencha:
   - Descrição: "Teste Parcelas Novo"
   - Valor: **95**
   - Selecione uma conta de cartão de crédito
   - Marque "Parcelado"
   - Parcelas: **10**
4. Salve
5. Verifique que criou:
   - ✅ 10 parcelas
   - ✅ Cada uma de R$ 9,50
   - ✅ Uma por mês

### 2. Teste com Importação Compartilhada

1. Vá em "Compartilhado"
2. Clique em "Importar Parcelado"
3. Preencha:
   - Descrição: "Teste Import"
   - Valor Total: **95**
   - Parcelas: **10**
   - Selecione categoria, conta e membro
4. Confirme
5. Verifique que criou:
   - ✅ 10 parcelas
   - ✅ Cada uma de R$ 9,50
   - ✅ Uma por mês

## Verificação no Banco

Execute para ver as novas parcelas:

```sql
SELECT 
    description,
    amount,
    date,
    current_installment,
    total_installments,
    series_id,
    created_at
FROM transactions 
WHERE is_installment = true 
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY series_id, current_installment;
```

Deve mostrar:
- 10 parcelas
- Cada uma com amount = 9.50 (ou 9.5)
- Datas diferentes (uma por mês)

## Por Que Estava Errado Antes?

As parcelas antigas foram criadas quando o código tinha um bug:
- O formulário passava o valor TOTAL (95) como valor de CADA parcela
- Não dividia por 10

Agora o código está correto:
- `generateInstallments` divide o valor total pelo número de parcelas
- Cada parcela recebe o valor correto (95 ÷ 10 = 9.50)

## Notas Importantes

1. **Parcelas antigas não são atualizadas automaticamente**
   - Você precisa deletá-las e criar novas

2. **O código agora está correto**
   - Tanto para formulário normal quanto para importação compartilhada

3. **Verifique o cache do navegador**
   - Faça Ctrl+Shift+R para garantir que está usando o código atualizado

4. **Se ainda houver problema**
   - Verifique os logs do console (F12)
   - Tire um print da tela mostrando o problema
   - Me avise qual fluxo você está usando (formulário ou importação)
