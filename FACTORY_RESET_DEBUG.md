# INVESTIGAÇÃO: Factory Reset não limpa dados do fluxo de caixa

## PROBLEMA REPORTADO
Usuário reporta que após executar reset de fábrica, os dados do fluxo de caixa ainda aparecem na aplicação.

## ANÁLISE REALIZADA

### 1. SISTEMA DE FACTORY RESET
✅ **Sistema implementado corretamente:**
- `FactoryResetService.ts` - Orquestra o processo
- `DataCleanupEngine.ts` - Executa limpeza dos dados
- `execute_factory_reset_complete()` - Função SQL que deleta TODAS as transações

### 2. FUNÇÃO SQL CORRIGIDA
✅ **Função `execute_factory_reset_complete()` implementada:**
```sql
-- Deleta TODAS as transações do usuário - SEM EXCEÇÕES
DELETE FROM public.transactions 
WHERE user_id = target_user_id
```

### 3. DATACLEANUPENGINE USANDO FUNÇÃO CORRETA
✅ **DataCleanupEngine.ts já usa a função corrigida:**
```typescript
const { data, error } = await supabase.rpc('execute_factory_reset_complete', {
  target_user_id: userId
})
```

### 4. POSSÍVEIS CAUSAS DO PROBLEMA

#### A. CACHE DO NAVEGADOR/PWA
🔍 **Service Worker configurado com cache:**
- PWA ativo com Workbox
- Cache de runtime para navegação
- Possível cache de dados da API

#### B. CACHE LOCAL (localStorage/sessionStorage)
🔍 **Múltiplos pontos de cache identificados:**
- `localStorage` usado para email salvo, versão da app
- Cache LRU no `useOptimizedFinancialDashboard`
- Possível cache de dados no cliente

#### C. CACHE DO SUPABASE CLIENT
🔍 **Cliente Supabase pode ter cache interno:**
- Realtime subscriptions podem manter dados
- Cache de queries anteriores

#### D. DADOS NÃO SENDO RECARREGADOS
🔍 **useDataStore pode não estar recarregando:**
- `fetchData()` pode não ser chamado após reset
- Estado local pode não ser limpo

## PRÓXIMOS PASSOS PARA DIAGNÓSTICO

### 1. VERIFICAR SE FUNÇÃO SQL ESTÁ FUNCIONANDO
```sql
-- Testar diretamente no Supabase
SELECT * FROM execute_factory_reset_complete('user-id-aqui');

-- Verificar se transações foram deletadas
SELECT COUNT(*) FROM transactions WHERE user_id = 'user-id-aqui';
```

### 2. VERIFICAR CACHE DO CLIENTE
- Limpar localStorage/sessionStorage
- Desabilitar service worker temporariamente
- Forçar reload completo da página

### 3. VERIFICAR RECARREGAMENTO DE DADOS
- Adicionar logs no `useDataStore.fetchData()`
- Verificar se `refresh()` é chamado após factory reset
- Verificar se estado local é limpo

### 4. IMPLEMENTAR LIMPEZA COMPLETA
Adicionar limpeza de cache no factory reset:
```typescript
// Limpar cache local
localStorage.clear();
sessionStorage.clear();

// Forçar reload da página
window.location.reload();
```

## SOLUÇÃO RECOMENDADA

### IMPLEMENTAR LIMPEZA COMPLETA NO FACTORY RESET
1. Executar SQL de limpeza
2. Limpar todos os caches locais
3. Desconectar realtime subscriptions
4. Forçar reload completo da aplicação

### CÓDIGO PARA IMPLEMENTAR
```typescript
// No FactoryResetService.executeReset()
async executeReset(userId: string, confirmation: ResetConfirmation): Promise<ResetResult> {
  // ... código existente ...
  
  // APÓS limpeza SQL bem-sucedida:
  if (cleanupResult.success) {
    // 1. Limpar cache local
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao limpar cache local:', e);
    }
    
    // 2. Forçar reload completo
    window.location.reload();
  }
}
```

## STATUS
🔍 **INVESTIGAÇÃO EM ANDAMENTO**
- Problema identificado: possível cache local/PWA
- Solução proposta: limpeza completa de cache + reload
- Próximo passo: implementar e testar solução