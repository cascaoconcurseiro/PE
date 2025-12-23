# Guia: Resolver Parcelas Não Aparecem

## 🚨 Problema
As parcelas compartilhadas não estão aparecendo na interface, mesmo após as correções implementadas.

## 🔍 Diagnóstico Passo a Passo

### **Passo 1: Executar Debug Básico**
1. Abra o console do navegador (F12)
2. Cole e execute o conteúdo de `debug-parcelas-nao-aparecem.js`
3. Analise os resultados:
   - ✅ Se há transações no banco = Problema de sincronização
   - ❌ Se não há transações = Problema de criação

### **Passo 2: Testar Função RPC**
1. Execute o conteúdo de `testar-rpc-create-shared.js`
2. Verifique o resultado:
   - ✅ SUCESSO = RPC funcionando
   - ❌ ERRO "function does not exist" = Função não existe no banco
   - ❌ ERRO de permissão = Problema de RLS

### **Passo 3: Verificar Permissões**
1. Execute o conteúdo de `verificar-permissoes.js`
2. Identifique problemas:
   - Acesso negado a tabelas
   - Função RPC não encontrada
   - Problemas de autenticação

---

## 🛠️ Soluções por Problema

### **Problema A: Função RPC Não Existe**
**Sintoma**: Erro "function create_shared_transaction_v2 does not exist"

**Solução**:
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Execute o conteúdo do arquivo: `supabase/migrations/20251221_shared_rpc_functions_v2.sql`
4. Verifique se a função foi criada

### **Problema B: Permissões RLS**
**Sintoma**: Erro de acesso negado às tabelas

**Solução**:
1. Verifique se o usuário está autenticado
2. No Supabase, vá para Authentication > Users
3. Confirme que o usuário existe e está ativo
4. Verifique as políticas RLS nas tabelas

### **Problema C: Transações Criadas Mas Não Aparecem**
**Sintoma**: Transações existem no banco mas não na UI

**Possíveis Causas**:
1. **Cache não invalidado**
2. **Filtros incorretos na UI**
3. **Problema de sincronização**
4. **Domain incorreto**

**Soluções**:
```javascript
// 1. Limpar cache manualmente
if (window.sharedTransactionManager) {
    window.sharedTransactionManager.clearCache();
}

// 2. Forçar refresh da página
window.location.reload();

// 3. Verificar filtros
// Vá para a aba "Compartilhado" e verifique se está na aba correta (REGULAR/TRAVEL/HISTORY)
```

### **Problema D: Mapeamento de User IDs**
**Sintoma**: Transações existem mas aparecem para usuário errado

**Solução**:
1. Verifique se `family_members.linked_user_id` está preenchido
2. Execute no SQL Editor:
```sql
-- Verificar mapeamento
SELECT 
    fm.id,
    fm.name,
    fm.email,
    fm.linked_user_id,
    au.email as auth_email
FROM family_members fm
LEFT JOIN auth.users au ON au.id = fm.linked_user_id::uuid
WHERE fm.user_id = auth.uid();

-- Corrigir se necessário
UPDATE family_members 
SET linked_user_id = 'UUID_DO_USUARIO_CORRETO'
WHERE id = 'ID_DO_MEMBRO';
```

---

## 🧪 Teste Completo

### **Script de Teste Final**
Execute este código no console para teste completo:

```javascript
async function testeCompleto() {
    console.log('🧪 TESTE COMPLETO - Parcelas Compartilhadas');
    
    // 1. Verificar ambiente
    if (!window.sharedTransactionManager?.supabase) {
        console.error('❌ SharedTransactionManager não disponível');
        return;
    }
    
    const supabase = window.sharedTransactionManager.supabase;
    
    // 2. Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('❌ Usuário não autenticado');
        return;
    }
    
    console.log('✅ Usuário:', user.email);
    
    // 3. Testar criação de parcela
    const testData = {
        p_description: 'TESTE FINAL - Parcela',
        p_amount: 100.00,
        p_category: 'OTHER',
        p_date: '2025-01-20',
        p_account_id: null,
        p_shared_splits: [{
            user_id: user.id,
            amount: 100.00,
            email: user.email
        }],
        p_trip_id: null,
        p_installment_data: { total: 1, series_id: null }
    };
    
    const { data: result, error } = await supabase.rpc('create_shared_transaction_v2', testData);
    
    if (error) {
        console.error('❌ FALHA no teste:', error);
        return;
    }
    
    if (result?.success) {
        console.log('✅ SUCESSO! Parcela criada');
        
        // Limpar cache e verificar
        window.sharedTransactionManager.clearCache();
        
        setTimeout(() => {
            console.log('🔄 Recarregue a página e verifique se a parcela aparece');
        }, 1000);
        
    } else {
        console.error('❌ RPC executou mas falhou:', result?.error);
    }
}

testeCompleto();
```

---

## 📋 Checklist de Verificação

- [ ] **Função RPC existe no banco**
- [ ] **Usuário está autenticado**
- [ ] **Permissões RLS estão corretas**
- [ ] **Cache foi limpo após criação**
- [ ] **Domain está correto (SHARED)**
- [ ] **linked_user_id está preenchido**
- [ ] **Filtros da UI estão corretos**

---

## 🆘 Se Nada Funcionar

### **Solução Drástica: Reset Completo**

1. **Backup dos dados importantes**
2. **Recriar função RPC**:
```sql
-- No Supabase SQL Editor
DROP FUNCTION IF EXISTS public.create_shared_transaction_v2;
-- Depois execute novamente o arquivo da migração
```

3. **Verificar todas as tabelas**:
```sql
-- Verificar estrutura
\d transactions
\d shared_transaction_requests
\d shared_transaction_mirrors
```

4. **Recriar transação manualmente**:
```sql
-- Inserir transação de teste
INSERT INTO transactions (
    user_id,
    description,
    amount,
    type,
    category,
    date,
    is_shared,
    domain,
    currency,
    created_at,
    updated_at
) VALUES (
    auth.uid(),
    'Teste Manual - Parcela Compartilhada',
    95.00,
    'DESPESA',
    'OTHER',
    CURRENT_DATE,
    true,
    'SHARED',
    'BRL',
    NOW(),
    NOW()
);
```

---

## 📞 Próximos Passos

1. **Execute os scripts de debug**
2. **Identifique o problema específico**
3. **Aplique a solução correspondente**
4. **Teste novamente**
5. **Se persistir, use a solução drástica**

**O problema SERÁ resolvido seguindo este guia sistematicamente.**