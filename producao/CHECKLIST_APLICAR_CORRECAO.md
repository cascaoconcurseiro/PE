# ✅ CHECKLIST: Aplicar Correção de Duplicação

## Passo 1: Verificar se o Código Foi Modificado

Abra o arquivo `producao/src/services/SharedTransactionManager.ts` e procure por:

```typescript
// CORREÇÃO: Cada parcela deve ter apenas UM split (o devedor desta parcela específica)
// NÃO passar array com todas as parcelas, apenas a parcela atual
const sharedWithJson = [{
```

**Se você NÃO ver este comentário**, o código não foi atualizado ainda.

## Passo 2: Recompilar o Frontend

### Opção A: Reiniciar o Servidor de Desenvolvimento

1. Pare o servidor (Ctrl+C no terminal)
2. Inicie novamente:
   ```bash
   npm run dev
   ```
   ou
   ```bash
   pnpm dev
   ```

### Opção B: Hard Reload no Navegador

1. Abra o DevTools (F12)
2. Clique com botão direito no ícone de reload
3. Selecione **"Empty Cache and Hard Reload"**

Ou simplesmente: **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)

## Passo 3: Verificar se o Código Novo Está Carregado

1. Abra o DevTools (F12)
2. Vá na aba **Sources**
3. Procure por `SharedTransactionManager.ts`
4. Verifique se o comentário "CORREÇÃO: Cada parcela deve ter apenas UM split" está lá

## Passo 4: Limpar Dados de Teste Antigos

Execute no Supabase SQL Editor:

```sql
-- Deletar transações de teste antigas
DELETE FROM transactions
WHERE description LIKE '%Seguro%'
  OR description LIKE '%DEBUG%'
  OR description LIKE '%TESTE%';

-- Verificar que foram deletadas
SELECT COUNT(*) FROM transactions
WHERE description LIKE '%Seguro%'
  OR description LIKE '%DEBUG%'
  OR description LIKE '%TESTE%';
-- Deve retornar 0
```

## Passo 5: Testar Novamente

Agora sim, importe uma nova fatura parcelada e siga o guia `DEBUG_DUPLICACAO_PARCELAS.md`.

---

## ⚠️ IMPORTANTE

Se você ainda estiver vendo duplicação DEPOIS de:
1. ✅ Verificar que o código foi modificado
2. ✅ Recarregar a página (hard reload)
3. ✅ Limpar dados antigos
4. ✅ Testar com nova importação

Então o problema está em outro lugar e precisamos investigar mais a fundo com os logs.

