# Correção de Parcelas - Guia de Aplicação

## Problemas Corrigidos

### 1. Erro de Ambiguidade na Função RPC
**Sintoma:** `Could not choose the best candidate function between: public.create_financial_record...`

**Causa:** Duas migrations criaram versões diferentes da função `create_financial_record`:
- `20260301_architecture_reset.sql` - SEM campos de parcelas (11 parâmetros)
- `20260301_fix_rpc_installments.sql` - COM campos de parcelas (16 parâmetros)

**Solução:** Nova migration `20260302_fix_installments_conflict.sql` que:
- Remove a versão antiga da função
- Recria com assinatura completa incluindo campos de parcelas

### 2. Lógica Incorreta de Cálculo de Parcelas
**Sintoma:** Ao lançar 95x10, criava 10 parcelas de R$ 95,00 (total R$ 950,00) em vez de 10 parcelas de R$ 9,50 (total R$ 95,00)

**Causa:** No arquivo `SharedInstallmentImport.tsx`:
- O campo "Valor da Parcela" estava sendo tratado como valor de cada parcela
- Mas o código multiplicava: `amount * installments` para calcular o total
- Resultado: 95 * 10 = 950 (errado)

**Solução:** Alterações em `SharedInstallmentImport.tsx`:
1. Campo renomeado para "Valor Total"
2. Cálculo corrigido: `totalValue / numInstallments` para obter valor de cada parcela
3. Ajuste da última parcela para garantir soma exata
4. Interface mostra claramente: "10x de R$ 9,50" quando digitar 95 total em 10 parcelas

## Como Aplicar as Correções

### Passo 1: Aplicar Migration no Banco de Dados

#### Opção A: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Copie o conteúdo de `supabase/migrations/20260302_fix_installments_conflict.sql`
4. Execute o SQL

#### Opção B: Via CLI do Supabase
```bash
cd producao
npx supabase db push
```

#### Opção C: Via psql (se tiver acesso direto)
```bash
cd producao
psql -h [seu-host] -U [seu-usuario] -d [seu-banco] -f supabase/migrations/20260302_fix_installments_conflict.sql
```

### Passo 2: Verificar a Correção

Execute no SQL Editor do Supabase:

```sql
-- Verificar se a função tem a assinatura correta
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_financial_record';
```

Deve retornar UMA função com 16 parâmetros incluindo:
- p_is_installment
- p_current_installment
- p_total_installments
- p_series_id

### Passo 3: Testar a Importação

1. Acesse a tela de Compartilhado
2. Clique em "Importar Parcelado"
3. Preencha:
   - Descrição: "Teste Parcelas"
   - Valor Total: 95
   - Parcelas: 10
   - Selecione categoria, conta e membro
4. Clique em "Confirmar 10x de R$ 9,50"
5. Verifique que foram criadas:
   - 10 parcelas
   - Cada uma de R$ 9,50
   - Uma por mês
   - Total: R$ 95,00

## Validação

### ✅ Checklist de Sucesso

- [ ] Migration aplicada sem erros
- [ ] Função `create_financial_record` tem 16 parâmetros
- [ ] Interface mostra "Valor Total" em vez de "Valor da Parcela"
- [ ] Ao digitar 95 total e 10 parcelas, mostra "10x de R$ 9,50"
- [ ] Importação cria 10 parcelas de R$ 9,50 cada
- [ ] Parcelas aparecem em meses diferentes
- [ ] Soma total das parcelas = valor total informado

### ❌ Se Ainda Houver Erros

1. **Erro de ambiguidade persiste:**
   - Execute: `DROP FUNCTION IF EXISTS public.create_financial_record;` (sem parâmetros)
   - Reaplique a migration

2. **Parcelas ainda com valor errado:**
   - Limpe o cache do navegador (Ctrl+Shift+R)
   - Verifique se o arquivo `SharedInstallmentImport.tsx` foi salvo corretamente
   - Reinicie o servidor de desenvolvimento

3. **Erro ao importar:**
   - Verifique os logs do console do navegador (F12)
   - Verifique os logs do Supabase
   - Confirme que a conta selecionada existe e está ativa

## Arquivos Modificados

1. **Nova Migration:**
   - `producao/supabase/migrations/20260302_fix_installments_conflict.sql`

2. **Código Frontend:**
   - `producao/src/components/shared/SharedInstallmentImport.tsx`
     - Função `generateInstallmentTransactions()` - corrigido cálculo
     - Label "Valor Total" em vez de "Valor da Parcela"
     - Botão mostra valor correto por parcela
     - Adicionado preview do valor por parcela abaixo do campo

## Notas Importantes

- As parcelas antigas (criadas antes da correção) NÃO serão alteradas automaticamente
- Você pode deletá-las manualmente e reimportar com os valores corretos
- A correção afeta apenas novas importações a partir de agora
- O cálculo de parcelas em outros fluxos (não compartilhado) já estava correto
