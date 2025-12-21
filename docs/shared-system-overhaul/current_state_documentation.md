# Documentação do Estado Atual - Sistema Compartilhado

## Data: 2025-12-21
## Status: PRÉ-REESTRUTURAÇÃO

## Resumo Executivo

O sistema de transações compartilhadas apresenta problemas críticos que impedem seu funcionamento adequado. Esta documentação registra o estado atual antes da reestruturação completa.

## Problemas Críticos Identificados

### 1. Parcelas Compartilhadas Não Aparecem para Usuário B
- **Sintoma**: Usuário A cria parcelas compartilhadas, mas usuário B não as vê
- **Causa Raiz**: Função `sync_shared_transaction` falha silenciosamente
- **Impacto**: Sistema compartilhado não funcional para parcelas
- **Arquivos Afetados**: 
  - `src/components/shared/SharedInstallmentImport.tsx`
  - `src/hooks/useSharedFinances.ts`

### 2. Dono Não Consegue Editar Transação Compartilhada
- **Sintoma**: Usuário que criou transação compartilhada não consegue editá-la
- **Causa Raiz**: RLS policies muito restritivas
- **Impacto**: Impossibilidade de corrigir dados após compartilhamento
- **Arquivos Afetados**: Políticas RLS no banco de dados

### 3. Banco de Dados Desorganizado
- **Sintoma**: 45+ migrações com duplicações e scripts espalhados
- **Causa Raiz**: Falta de consolidação e limpeza
- **Impacto**: Dificuldade de manutenção e debugging
- **Arquivos Afetados**: Toda pasta `supabase/migrations/`

### 4. Sincronização Inconsistente
- **Sintoma**: Dados compartilhados ficam dessincronizados
- **Causa Raiz**: Falta de mecanismos de retry e recuperação
- **Impacto**: Inconsistências entre usuários
- **Arquivos Afetados**: Funções RPC de sincronização

## Estado Atual das Migrações

### Migrações Ativas (45 arquivos)
```
20251220_restrict_shared_management.sql
20251220_secure_trips_management.sql
20260125_fix_mirror_currency.sql
20260127_consolidacao_final_rpc_e_balance.sql
... (41 outras migrações)
```

### Funções RPC Problemáticas
- `create_transaction` - Múltiplas versões conflitantes
- `update_transaction` - Permissões inadequadas
- `sync_shared_transaction` - Falha silenciosamente
- `respond_to_shared_request` - Operações não atômicas

### Tabelas Principais
- `transactions` - Schema inconsistente para compartilhamento
- `shared_transaction_requests` - Falta campos essenciais
- `family_members` - Linking problemático com usuários

## Componentes Frontend Problemáticos

### SharedRequests.tsx
- Usa RPC `get_shared_requests_v3` que pode não existir
- Tratamento de erro inadequado
- Feedback visual insuficiente

### SharedInstallmentImport.tsx
- Não garante criação de transações espelho
- Falta validação de sincronização
- Problemas com parcelas não aparecendo

### useSharedFinances.ts
- Lógica complexa de mapeamento de devedores
- Fallback por nome não confiável
- Inconsistências na exibição de dados

## Backup e Rollback

### Backup Criado
- **Arquivo**: `supabase/backups/pre_shared_system_overhaul_backup.sql`
- **Conteúdo**: Schema completo, funções problemáticas, metadados
- **Função de Rollback**: `emergency_rollback_shared_system()`

### Estratégia de Rollback
1. Executar função `emergency_rollback_shared_system()`
2. Restaurar migrações do backup
3. Reverter alterações no frontend
4. Validar integridade dos dados

## Métricas de Problemas

### Frequência de Falhas (Estimada)
- Parcelas não sincronizadas: ~60% dos casos
- Edições bloqueadas: ~40% dos casos
- Inconsistências de dados: ~30% dos casos

### Impacto nos Usuários
- Funcionalidade compartilhada inutilizável
- Necessidade de workarounds manuais
- Perda de confiança no sistema

## Próximos Passos

1. **Limpeza do Banco** - Consolidar migrações e funções
2. **Novo Schema** - Implementar estrutura robusta
3. **Funções RPC v2** - Operações atômicas e confiáveis
4. **Frontend Refatorado** - Componentes com melhor UX
5. **Testes Abrangentes** - Cobertura completa com property tests

## Critérios de Sucesso

- [ ] Parcelas compartilhadas aparecem para todos os usuários
- [ ] Donos podem editar transações compartilhadas
- [ ] Banco de dados limpo e organizado
- [ ] Sincronização confiável com retry automático
- [ ] Interface intuitiva com feedback adequado
- [ ] Testes automatizados com 100% de cobertura crítica

---

**Nota**: Esta documentação será atualizada conforme o progresso da reestruturação.