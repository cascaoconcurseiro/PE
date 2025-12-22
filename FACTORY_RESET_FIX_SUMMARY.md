# CORREÇÃO: Factory Reset não limpa dados do fluxo de caixa

## PROBLEMA IDENTIFICADO
Após executar reset de fábrica, os dados do fluxo de caixa ainda apareciam na aplicação devido a cache local não sendo limpo.

## CAUSA RAIZ
O factory reset estava funcionando corretamente no banco de dados (deletando todas as transações), mas os dados permaneciam em cache local:
- **localStorage** - Cache de dados da aplicação
- **sessionStorage** - Cache temporário de sessão  
- **Service Worker Cache** - Cache do PWA
- **Cache do React** - Estado local dos componentes

## SOLUÇÃO IMPLEMENTADA

### 1. LIMPEZA COMPLETA DE CACHE
Modificado `FactoryResetService.ts` para limpar todos os caches após factory reset bem-sucedido:

```typescript
// 🔧 FIX: Limpar TODOS os caches após factory reset bem-sucedido
if (isSuccess) {
  try {
    // 1. Limpar localStorage (cache de dados, configurações, etc.)
    localStorage.clear();
    
    // 2. Limpar sessionStorage (cache temporário)
    sessionStorage.clear();
    
    // 3. Limpar cache do service worker se disponível
    if ('serviceWorker' in navigator && 'caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      }).catch(e => console.warn('Erro ao limpar cache do service worker:', e));
    }
    
    console.log('✅ Factory reset completo - todos os caches limpos');
    
    // 4. Forçar reload completo da aplicação após um pequeno delay
    setTimeout(() => {
      window.location.href = window.location.origin; // Força navegação completa
    }, 500);
    
  } catch (error) {
    console.warn('Erro ao limpar caches locais:', error);
    // Não falhar o factory reset por causa de erro de cache
  }
}
```

### 2. CORREÇÃO NO useDataStore
Removido `window.location.reload()` duplicado do `handleFactoryReset` para evitar conflito:

```typescript
handleFactoryReset: async (unlinkFamily: boolean = false) => performOperation(async () => {
    await supabaseService.performSmartReset(unlinkFamily);
    // ... limpar estado local ...
    // Não fazer window.location.reload() aqui - o FactoryResetService já faz
}, 'Sistema restaurado para o padrão de fábrica.'),
```

### 3. ARQUIVOS MODIFICADOS
- ✅ `src/services/factory-reset/FactoryResetService.ts` - Adicionada limpeza de cache
- ✅ `src/hooks/useDataStore.ts` - Removido reload duplicado

## COMO FUNCIONA AGORA

1. **Usuário executa factory reset** através das configurações
2. **FactoryResetService** executa limpeza no banco de dados
3. **Após sucesso**, limpa TODOS os caches locais:
   - localStorage
   - sessionStorage  
   - Service Worker cache
4. **Força reload completo** da aplicação
5. **Aplicação recarrega** com dados limpos do servidor

## TESTE DA CORREÇÃO

### Script de Teste
Criado `test-factory-reset.js` para testar no console do navegador:
- Verifica dados antes do reset
- Executa factory reset
- Verifica dados após reset
- Confirma que não há transações visíveis

### Como Testar
1. Faça login na aplicação
2. Abra o console do navegador (F12)
3. Execute o script `test-factory-reset.js`
4. Verifique se os dados foram completamente removidos

## RESULTADO ESPERADO
✅ **Após factory reset:**
- Banco de dados limpo (0 transações)
- Cache local limpo
- Aplicação recarregada
- Fluxo de caixa vazio
- Nenhum dado antigo visível

## STATUS
✅ **CORREÇÃO IMPLEMENTADA**
- Problema identificado e corrigido
- Limpeza completa de cache implementada
- Reload forçado para garantir dados limpos
- Pronto para teste em produção