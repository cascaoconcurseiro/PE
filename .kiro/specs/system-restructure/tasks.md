# Implementation Plan: System Restructure

## Overview

Este plano implementa a reestruturação do sistema financeiro "Pé de Meia" de forma **ultra-segura**, priorizando a estabilidade do sistema atual. A estratégia é de **migração incremental e reversível**, onde o sistema antigo continua funcionando enquanto o novo é construído e testado em paralelo.

**Princípios de Segurança:**
- Nunca remover código que funciona até o novo estar 100% estável
- Sempre manter rollback disponível
- Testar cada mudança em ambiente isolado primeiro
- Migrar dados em pequenos lotes com validação

## Tasks

- [x] 1. Preparação e Ambiente Seguro
  - Criar backup completo do banco de dados atual
  - Configurar ambiente de staging idêntico ao produção
  - Documentar estado atual do sistema para rollback
  - _Requirements: 9.1, 9.4_

- [x] 2. Consolidação Segura do Schema (Adições Não-Destrutivas)
  - [x] 2.1 Criar nova tabela transaction_splits (sem tocar nas existentes)
    - Implementar tabela normalizada para splits
    - Manter tabela atual intacta
    - _Requirements: 7.1_

  - [ ]* 2.2 Escrever testes de propriedade para transaction_splits
    - **Property 5: Atomic Split Creation**
    - **Validates: Requirements 7.2**

  - [x] 2.3 Adicionar índices otimizados (sem remover existentes)
    - Criar índices em user_id, date, account_id, deleted
    - Monitorar performance antes e depois
    - _Requirements: 1.3, 8.1_

  - [x] 2.4 Corrigir tipos UUID em novas colunas (sem alterar existentes)
    - Adicionar colunas UUID paralelas às TEXT existentes
    - Migrar referências gradualmente
    - _Requirements: 1.2_

- [ ] 3. Checkpoint - Validar Schema Seguro
  - Verificar que sistema atual continua funcionando normalmente
  - Validar que novas tabelas foram criadas corretamente
  - Executar testes de integridade

- [ ] 4. Implementação de RPCs Validados (Paralelos aos Existentes)
  - [ ] 4.1 Criar create_transaction_v2 (mantendo versão atual)
    - Implementar RPC com validações robustas
    - Não remover create_transaction original
    - _Requirements: 6.1, 6.2_

  - [ ]* 4.2 Escrever testes de propriedade para validação backend
    - **Property 3: Backend Validation Rejects Invalid Input**
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 4.3 Criar update_transaction_v2 e delete_transaction_v2
    - Implementar versões seguras com validação
    - Manter versões originais funcionando
    - _Requirements: 6.1_

  - [ ] 4.4 Implementar RPC de reconciliação de saldos
    - Função para detectar e corrigir inconsistências
    - Não alterar cálculos existentes ainda
    - _Requirements: 2.5_

  - [ ]* 4.5 Escrever testes de propriedade para reconciliação
    - **Property 2: Balance Reconciliation Correctness**
    - **Validates: Requirements 2.5**

- [ ] 5. Trigger Único de Saldo (Implementação Paralela)
  - [ ] 5.1 Criar novo trigger update_account_balance_v2
    - Implementar lógica consolidada de saldo
    - Aplicar apenas em contas de teste inicialmente
    - _Requirements: 2.1, 2.2_

  - [ ]* 5.2 Escrever testes de propriedade para consistência de saldo
    - **Property 1: Balance Consistency After Transaction Operations**
    - **Validates: Requirements 2.2**

  - [ ] 5.3 Testar trigger em ambiente isolado
    - Validar com dados de teste
    - Comparar resultados com sistema atual
    - _Requirements: 2.2_

- [ ] 6. Checkpoint - Backend Paralelo Funcionando
  - Verificar que RPCs v2 funcionam corretamente
  - Validar que trigger v2 calcula saldos corretos
  - Sistema original deve continuar intacto

- [ ] 7. Refatoração Segura do Frontend (Hooks Separados)
  - [ ] 7.1 Criar useFinanceData (sem remover useDataStore)
    - Implementar hook focado apenas em fetching
    - Testar em componentes isolados primeiro
    - _Requirements: 4.1_

  - [ ] 7.2 Criar useFinanceState (paralelo ao useDataStore)
    - Implementar gerenciamento de estado limpo
    - Validar cálculos contra sistema atual
    - _Requirements: 4.2_

  - [ ] 7.3 Criar useFinanceActions (sem alterar ações existentes)
    - Implementar actions que chamam RPCs v2
    - Manter actions originais funcionando
    - _Requirements: 4.3_

  - [ ]* 7.4 Escrever testes de propriedade para rollback otimista
    - **Property 4: Optimistic Update Rollback on Failure**
    - **Validates: Requirements 4.4**

- [ ] 8. Implementação do apiService (Camada Paralela)
  - [ ] 8.1 Criar apiService.ts (sem alterar supabaseService.ts)
    - Implementar camada limpa de RPCs
    - Manter supabaseService funcionando
    - _Requirements: 4.1_

  - [ ] 8.2 Implementar tratamento de erros tipados
    - Result<T> pattern para operações
    - Mensagens de erro em português
    - _Requirements: 6.2, 6.3_

- [ ] 9. Otimização de Carregamento (Implementação Gradual)
  - [ ] 9.1 Implementar carregamento em lote (novo endpoint)
    - Criar endpoint para accounts + current month
    - Testar performance vs carregamento atual
    - _Requirements: 3.1_

  - [ ] 9.2 Implementar cache de períodos
    - Sistema de cache que não interfere no atual
    - Validar que dados cached são consistentes
    - _Requirements: 3.4_

  - [ ] 9.3 Eliminar flicker com loading states
    - Implementar estados de loading que bloqueiam UI
    - Testar em componentes isolados
    - _Requirements: 3.2, 3.5_

- [ ] 10. Checkpoint - Sistema Novo Funcionando em Paralelo
  - Validar que novo sistema funciona completamente
  - Comparar resultados com sistema atual
  - Preparar para migração gradual

- [ ] 11. Migração Gradual de Dados (Lotes Pequenos)
  - [ ] 11.1 Migrar splits existentes para transaction_splits
    - Processar em lotes de 100 registros
    - Validar cada lote antes do próximo
    - _Requirements: 7.1_

  - [ ]* 11.2 Escrever testes para cálculo de receivables/payables
    - **Property 6: Receivables and Payables Calculation**
    - **Validates: Requirements 7.3**

  - [ ] 11.3 Migrar referências TEXT para UUID
    - Processar em lotes pequenos
    - Manter referências antigas até validação completa
    - _Requirements: 1.2_

- [ ] 12. Switch Gradual para Sistema Novo
  - [ ] 12.1 Migrar dashboard para novos hooks (feature flag)
    - Implementar toggle para alternar entre sistemas
    - Monitorar performance e erros
    - _Requirements: 3.1, 4.1_

  - [ ] 12.2 Migrar transações para RPCs v2 (feature flag)
    - Permitir rollback imediato se necessário
    - Validar cada operação contra sistema antigo
    - _Requirements: 6.1_

  - [ ] 12.3 Ativar trigger v2 para saldos (gradual por conta)
    - Migrar uma conta por vez
    - Comparar saldos calculados
    - _Requirements: 2.2_

- [ ] 13. Implementação de Transações Compartilhadas Seguras
  - [ ] 13.1 Migrar criação de splits para sistema normalizado
    - Usar transaction_splits em vez de JSONB
    - Manter compatibilidade com dados antigos
    - _Requirements: 7.2_

  - [ ]* 13.2 Escrever testes para liquidação de splits
    - **Property 7: Settlement Creates Both Records**
    - **Validates: Requirements 7.4**

  - [ ] 13.3 Implementar proteção contra deleção com splits pendentes
    - Validar antes de permitir deleção
    - Mensagens claras para usuário
    - _Requirements: 7.5_

  - [ ]* 13.4 Escrever testes para proteção de deleção
    - **Property 8: Unsettled Splits Block Deletion**
    - **Validates: Requirements 7.5**

- [ ] 14. Checkpoint Final - Validação Completa
  - Executar todos os testes de propriedade
  - Comparar dados entre sistema antigo e novo
  - Validar performance e estabilidade

- [ ] 15. Limpeza Segura (Apenas Após Validação Total)
  - [ ] 15.1 Remover código legado do useDataStore (backup primeiro)
    - Arquivar código antigo antes de remover
    - Manter possibilidade de rollback
    - _Requirements: 5.1, 5.2_

  - [ ] 15.2 Remover RPCs e triggers antigos (backup primeiro)
    - Arquivar em schema separado
    - Documentar o que foi removido
    - _Requirements: 5.1_

  - [ ] 15.3 Consolidar migrations antigas (opcional)
    - Arquivar migrations em pasta separada
    - Criar migration consolidada final
    - _Requirements: 1.1, 1.4_

- [ ] 16. Documentação e Manutenibilidade
  - [ ] 16.1 Atualizar README com nova arquitetura
    - Documentar estrutura de hooks separados
    - Explicar fluxo de dados novo
    - _Requirements: 9.1_

  - [ ] 16.2 Documentar tipos TypeScript completos
    - Interfaces para todas as entidades
    - Tipos para Result<T> e erros
    - _Requirements: 9.3_

  - [ ] 16.3 Criar CHANGELOG da reestruturação
    - Documentar todas as mudanças importantes
    - Incluir guia de rollback se necessário
    - _Requirements: 9.4_

## Notes

- **Tarefas marcadas com `*` são opcionais** e podem ser puladas para MVP mais rápido
- **Cada checkpoint é obrigatório** - não prossiga se algo não estiver funcionando
- **Sempre mantenha rollback disponível** - nunca remova código que funciona até o novo estar 100% estável
- **Teste em staging primeiro** - toda mudança deve ser validada em ambiente seguro
- **Migração em lotes pequenos** - nunca processe todos os dados de uma vez
- **Feature flags** permitem ativar/desativar funcionalidades rapidamente
- **Backup contínuo** - mantenha backups antes de cada etapa crítica