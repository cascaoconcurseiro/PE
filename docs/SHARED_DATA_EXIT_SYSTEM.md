# Sistema de Saída Automática de Dados Compartilhados

## Visão Geral

Este documento descreve o novo sistema implementado que gerencia automaticamente a saída de usuários de dados compartilhados durante o factory reset, incluindo notificações para outros usuários e ressincronização automática.

## Funcionalidades Implementadas

### 1. Saída Automática Durante Reset

Quando um usuário executa um factory reset, o sistema agora:

- ✅ **Remove automaticamente de viagens compartilhadas**
- ✅ **Remove automaticamente de grupos familiares**
- ✅ **Notifica outros usuários sobre a saída**
- ✅ **Cria registros para ressincronização futura**

### 2. Notificações para Outros Usuários

Os outros usuários recebem notificações informando:

- Que o usuário saiu devido a um reset do sistema
- Que podem readicioná-lo quando desejarem
- Que os dados serão ressincronizados automaticamente

### 3. Ressincronização Automática

Quando um usuário é readicionado:

- ✅ **Dados são sincronizados automaticamente**
- ✅ **Transações compartilhadas são restauradas**
- ✅ **Configurações de grupo são aplicadas**
- ✅ **Usuário recebe notificação de sucesso**

## Arquivos Implementados

### Serviços

1. **`src/services/factory-reset/SharedDataExitManager.ts`**
   - Gerencia saída de dados compartilhados
   - Envia notificações para outros usuários
   - Cria registros de ressincronização

2. **`src/services/factory-reset/FactoryResetService.ts`** (atualizado)
   - Integra o novo sistema de saída automática
   - Método `executeResetWithSharedDataExit()`

### Hooks

3. **`src/hooks/useResyncNotifications.ts`**
   - Hook para gerenciar oportunidades de ressincronização
   - Funções para readicionar usuários
   - Verificação de possibilidade de ressincronização

### Componentes

4. **`src/components/shared/ResyncNotificationBanner.tsx`**
   - Banner que mostra usuários disponíveis para ressincronização
   - Interface para readicionar usuários
   - Feedback visual do processo

5. **`src/components/Shared.tsx`** (atualizado)
   - Integra o banner de ressincronização

6. **`src/components/settings/DataManagement.tsx`** (atualizado)
   - Informações sobre as novas funcionalidades
   - Interface melhorada para factory reset

### Banco de Dados

7. **`supabase/migrations/20241221_shared_data_exit_functions.sql`**
   - Funções SQL para saída de dados compartilhados
   - Tabela `user_resync_records`
   - Função `get_resync_opportunities()`

### Serviços Core

8. **`src/core/services/supabaseService.ts`** (atualizado)
   - Integra o novo sistema no `performSmartReset()`
   - Fallback para método antigo se necessário

## Fluxo de Funcionamento

### Durante o Factory Reset

```mermaid
graph TD
    A[Usuário inicia Factory Reset] --> B[SharedDataExitManager.exitAllSharedData()]
    B --> C[Sair de viagens compartilhadas]
    B --> D[Sair de grupos familiares]
    B --> E[Enviar notificações para outros usuários]
    B --> F[Criar registros de ressincronização]
    F --> G[Executar limpeza de dados]
    G --> H[Reset concluído]
```

### Durante a Ressincronização

```mermaid
graph TD
    A[Usuário A vê banner de ressincronização] --> B[Clica em 'Readicionar']
    B --> C[Escolhe: Grupo Familiar ou Viagem]
    C --> D[Sistema adiciona Usuário B de volta]
    D --> E[executeResync() é chamado]
    E --> F[Dados são sincronizados]
    F --> G[Notificações de sucesso enviadas]
    G --> H[Banner é removido]
```

## Benefícios

### Para o Usuário que Fez Reset
- ✅ Não precisa se preocupar em sair manualmente de grupos
- ✅ Pode ser facilmente readicionado
- ✅ Dados são restaurados automaticamente

### Para Outros Usuários
- ✅ São informados sobre a saída
- ✅ Podem readicionar facilmente
- ✅ Interface clara e intuitiva

### Para o Sistema
- ✅ Dados consistentes
- ✅ Sem transações órfãs
- ✅ Sincronização automática

## Configuração

### Requisitos
1. Executar a migração SQL: `20241221_shared_data_exit_functions.sql`
2. Certificar-se de que as tabelas necessárias existem:
   - `user_notifications`
   - `user_resync_records`
   - `profiles`

### Variáveis de Ambiente
Nenhuma variável adicional necessária.

## Testes

### Cenários de Teste

1. **Factory Reset com Saída Automática**
   - Usuário em grupo familiar faz reset
   - Verificar se saiu do grupo
   - Verificar se outros foram notificados

2. **Ressincronização**
   - Readicionar usuário ao grupo
   - Verificar se dados foram sincronizados
   - Verificar notificações de sucesso

3. **Múltiplos Grupos**
   - Usuário em várias viagens e grupos
   - Verificar saída de todos
   - Verificar possibilidade de readição seletiva

## Monitoramento

### Logs Importantes
- `SharedDataExitManager`: Saída de dados compartilhados
- `FactoryResetService`: Execução do reset completo
- `useResyncNotifications`: Oportunidades de ressincronização

### Métricas
- Número de saídas automáticas por dia
- Taxa de ressincronização
- Tempo médio de ressincronização

## Troubleshooting

### Problemas Comuns

1. **Usuário não aparece para ressincronização**
   - Verificar se `can_resync = true` na tabela `user_resync_records`
   - Verificar se havia relacionamento anterior

2. **Ressincronização falha**
   - Verificar logs do `SharedDataExitManager.executeResync()`
   - Verificar permissões do usuário

3. **Notificações não enviadas**
   - Verificar tabela `user_notifications`
   - Verificar se usuários têm perfis válidos

## Próximos Passos

### Melhorias Futuras
- [ ] Interface para gerenciar convites pendentes
- [ ] Histórico de ressincronizações
- [ ] Configurações de notificação por usuário
- [ ] Ressincronização parcial (apenas algumas transações)

### Otimizações
- [ ] Cache de oportunidades de ressincronização
- [ ] Batch processing para múltiplas ressincronizações
- [ ] Compressão de registros antigos

---

**Implementado em:** 21 de Dezembro de 2024  
**Versão:** 1.0  
**Status:** ✅ Concluído e Testado