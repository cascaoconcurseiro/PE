# Solução: Parcelas Compartilhadas Invisíveis

## Problema

Quando você importa uma parcela compartilhada e atribui ao usuário B (Fran):
- ✅ A parcela aparece para você (quem criou)
- ❌ A parcela NÃO aparece para o usuário B (Fran)

## Causa Raiz

O sistema de transações compartilhadas funciona com **espelhos**:

1. Você cria uma transação com `userId` = Fran (quem vai pagar)
2. O sistema deveria criar automaticamente um **espelho** dessa transação para você
3. Esse espelho permite que você veja a transação mesmo não sendo o `userId`

**O problema:** O trigger `trg_handle_shared_transaction` que criava os espelhos foi **removido** na migration `20260301_nuclear_trigger_cleanup.sql`.

### Como funciona a visualização (RLS)

A política RLS permite visualizar transações se:
- Você é o `user_id` (proprietário) OU
- Existe uma solicitação aceita em `shared_transaction_requests` OU
- Existe um espelho em `shared_transaction_mirrors`

Sem o trigger, os espelhos não são criados, então você não consegue ver as transações que criou para outros usuários.

## Solução

### 1. Restaurar o Trigger (20241225_restore_shared_sync_trigger.sql)

Recria o trigger que chama `sync_shared_transaction` automaticamente quando:
- Uma transação compartilhada é criada (INSERT)
- Uma transação compartilhada é atualizada (UPDATE)

```sql
CREATE TRIGGER trg_sync_shared_transaction_insert
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    WHEN (NEW.is_shared = true)
    EXECUTE FUNCTION public.handle_shared_transaction_sync();
```

### 2. Corrigir Transações Existentes (20241225_backfill_missing_mirrors.sql)

Processa todas as transações compartilhadas existentes que não têm espelhos e cria os espelhos faltantes.

## Como Aplicar

### Opção 1: Via Supabase Dashboard

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute as migrations na ordem:
   - `20241225_restore_shared_sync_trigger.sql`
   - `20241225_backfill_missing_mirrors.sql`

### Opção 2: Via CLI

```bash
cd producao
supabase db push
```

## Verificação

Após aplicar as migrations:

1. **Teste com nova transação:**
   - Crie uma nova parcela compartilhada
   - Verifique se aparece para ambos os usuários

2. **Verifique transações antigas:**
   - As transações existentes devem ter espelhos criados
   - Ambos os usuários devem ver as transações

3. **Query de verificação:**
```sql
-- Ver transações compartilhadas sem espelhos
SELECT t.id, t.description, t.user_id, t.shared_with
FROM transactions t
WHERE t.is_shared = true
  AND t.shared_with IS NOT NULL
  AND jsonb_array_length(t.shared_with) > 0
  AND NOT EXISTS (
      SELECT 1
      FROM transactions mirror
      WHERE mirror.payer_id = t.user_id::text
      AND mirror.date = t.date
      AND mirror.is_shared = true
  );
```

## Prevenção

O trigger agora está restaurado e funcionará automaticamente para:
- Novas transações compartilhadas criadas via formulário
- Novas transações compartilhadas importadas
- Atualizações em transações compartilhadas existentes

## Notas Técnicas

- A função `sync_shared_transaction` já existia e está funcionando corretamente
- O problema era apenas a falta do trigger para chamá-la automaticamente
- Os espelhos são criados com `domain = 'SHARED'` (ou `'TRAVEL'` se tiver trip_id)
- O campo `payer_id` identifica quem é o pagador original
