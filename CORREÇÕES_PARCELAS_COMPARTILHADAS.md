# Correções Implementadas - Parcelas Compartilhadas

## Problemas Identificados e Soluções

### 1. **Função RPC Inexistente**
**Problema**: O código estava tentando chamar `import_shared_installment_v2` que não existe no banco.
**Solução**: Modificado `SharedTransactionManager.importSharedInstallments()` para usar `create_shared_transaction_v2` que existe.

### 2. **Cache Não Invalidado**
**Problema**: Após importação, o cache do `SharedTransactionManager` não era limpo.
**Solução**: Adicionado `sharedTransactionManager.clearCache()` após importação bem-sucedida.

### 3. **Email Obrigatório na RPC**
**Problema**: A função `create_shared_transaction_v2` exige email válido para cada split.
**Solução**: Gerado email placeholder válido: `user-{userId}@shared.local`

### 4. **Mapeamento de User ID**
**Problema**: Usando `memberId` em vez de `linkedUserId` para identificar usuários.
**Solução**: Modificado para usar `member.linkedUserId` quando disponível.

### 5. **Logs de Debug Adicionados**
**Solução**: Adicionados logs detalhados para facilitar debugging:
- Mapeamento de usuários
- Transações geradas
- Resultado das chamadas RPC

## Arquivos Modificados

1. **`src/services/SharedTransactionManager.ts`**
   - Substituída função RPC inexistente
   - Adicionados logs de debug
   - Melhorado tratamento de emails

2. **`src/components/shared/SharedInstallmentImport.tsx`**
   - Adicionado `clearCache()` após importação
   - Melhorado mapeamento de user IDs
   - Adicionados logs de debug

## Como Testar

### 1. **Teste Manual**
1. Abra a aplicação e vá para a seção "Compartilhado"
2. Clique em "Importar Parcelado Compartilhado"
3. Preencha os dados:
   - Descrição: "Teste Parcelas"
   - Valor da parcela: 100
   - Número de parcelas: 3
   - Selecione um membro da família
4. Clique em "Confirmar Importação"
5. Verifique se aparece a mensagem de sucesso
6. Verifique se as parcelas aparecem na lista do membro

### 2. **Debug no Console**
Execute os scripts de debug criados:
```javascript
// Carregar debug-shared-installments.js no console
// Carregar test-shared-rpc.js no console
```

### 3. **Verificar Logs**
Abra o console do navegador (F12) e procure por:
- `DEBUG: Mapeamento de usuário`
- `DEBUG: Transações geradas para importação`
- `DEBUG: Resultado da importação`
- `DEBUG: Processando série de parcelas`

## Possíveis Problemas Restantes

### 1. **LinkedUserId Não Preenchido**
Se o membro não tem `linkedUserId`, as parcelas podem não aparecer corretamente.
**Verificação**: Logs mostrarão se `linkedUserId` é null.

### 2. **Usuário Não Autenticado**
A função RPC requer usuário autenticado.
**Verificação**: Erro "Usuário não autenticado" nos logs.

### 3. **Permissões RPC**
Usuário pode não ter permissão para executar a função.
**Verificação**: Erro de permissão nos logs.

### 4. **Sincronização de Dados**
Transações podem estar sendo criadas mas não aparecendo na UI.
**Verificação**: Verificar diretamente no banco de dados.

## Próximos Passos

1. **Testar a importação** seguindo os passos acima
2. **Verificar logs** para identificar problemas específicos
3. **Se ainda não funcionar**, verificar:
   - Se o usuário está autenticado
   - Se o `linkedUserId` está preenchido nos membros
   - Se as transações estão sendo criadas no banco
   - Se o `useSharedFinances` está processando corretamente

## Comandos SQL para Debug

```sql
-- Verificar transações compartilhadas criadas
SELECT id, description, amount, date, is_shared, shared_with, current_installment, total_installments
FROM transactions 
WHERE is_shared = true 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar solicitações pendentes
SELECT id, transaction_id, invited_email, assigned_amount, status
FROM shared_transaction_requests 
WHERE status = 'PENDING'
ORDER BY created_at DESC 
LIMIT 5;
```