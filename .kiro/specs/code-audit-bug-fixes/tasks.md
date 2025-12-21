# Implementation Plan: Code Audit and Bug Fixes

## Overview

Este plano implementa correções sistemáticas para bugs críticos identificados durante auditoria do código. As tarefas estão organizadas por prioridade e dependências, começando com correções críticas que afetam cálculos financeiros.

## Tasks

- [x] 1. Corrigir lógica de transações compartilhadas em cálculos
  - Implementar filtro correto para dívidas não pagas
  - Atualizar dashboardEngine.calculateSpendingChartData para excluir unpaid debts
  - Atualizar financialLogic.calculateProjectedBalance para tratar receivables/payables corretamente
  - Atualizar financialLogic.calculateMonthlyTotals para excluir unpaid debts
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3_

- [ ]* 1.1 Escrever testes de propriedade para filtro de transações compartilhadas
  - **Property 1: Shared Transaction Exclusion from Cash Flow**
  - **Validates: Requirements 1.1, 2.2, 2.3**

- [x] 2. Corrigir validação de splits em transações
  - Adicionar validação em validateTransaction para verificar splits <= amount
  - Implementar correção automática quando splits > amount (proporcional)
  - Adicionar logging quando correção for aplicada
  - _Requirements: 1.5, 6.4_

- [ ]* 2.1 Escrever testes de propriedade para validação de splits
  - **Property 2: Split Total Never Exceeds Transaction Amount**
  - **Validates: Requirements 1.5, 6.4**

- [x] 3. Corrigir cálculo de projeção de saldo
  - Atualizar calculateProjectedBalance para usar data correta como cutoff
  - Implementar lógica de "hoje" vs "início do mês" baseado no mês visualizado
  - Corrigir inclusão de receivables e payables em pending calculations
  - Adicionar validação de datas futuras vs passadas
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 3.1 Escrever testes de propriedade para projeção de saldo
  - **Property 3: Projected Balance Only Includes Future Transactions**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 4. Fortalecer validação de datas
  - Implementar isDayValidForMonth em useTransactionStore
  - Adicionar validação de reconstrução de data
  - Rejeitar datas que não existem no calendário (ex: 30/02)
  - Adicionar mensagens de erro específicas para cada tipo de erro de data
  - _Requirements: 6.2, 8.4_

- [ ]* 4.1 Escrever testes de propriedade para validação de datas
  - **Property 5: Date Validation Rejects Invalid Calendar Dates**
  - **Validates: Requirements 6.2, 8.4**

- [x] 5. Corrigir geração de parcelas
  - Atualizar generateInstallments para usar FinancialPrecision em todos os cálculos
  - Implementar ajuste da última parcela para garantir soma exata
  - Aplicar mesma lógica para splits compartilhados em parcelas
  - Adicionar validação pós-geração (soma deve ser exata)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 5.1 Escrever testes de propriedade para geração de parcelas
  - **Property 6: Installment Sum Equals Original Amount**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 6. Checkpoint - Validar correções críticas
  - Executar todos os testes de propriedade
  - Verificar que nenhum cálculo retorna NaN
  - Confirmar que dívidas não pagas não aparecem em despesas
  - Validar que parcelas somam exatamente o total
  - Perguntar ao usuário se há dúvidas ou problemas

- [x] 7. Corrigir cálculo de totais mensais
  - Atualizar calculateMonthlyTotals para filtrar unpaid debts
  - Implementar cálculo de valor efetivo para shared transactions
  - Adicionar validação de que apenas transações do mês são incluídas
  - Garantir que refunds são tratados corretamente (negativos)
  - _Requirements: 2.3, 4.1_

- [ ]* 7.1 Escrever testes de propriedade para totais mensais
  - **Property 7: Monthly Totals Exclude Unpaid Debts**
  - **Validates: Requirements 2.3, 4.1**

- [x] 8. Corrigir cálculo de fluxo de caixa anual
  - Atualizar calculateCashFlowData para excluir unpaid debts
  - Corrigir cálculo de saldo inicial (trabalhar para trás do saldo atual)
  - Implementar máscara de meses históricos vazios
  - Adicionar validação de curva acumulada (monotônica quando sem transações)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 8.1 Escrever testes de propriedade para fluxo de caixa
  - **Property 8: Cash Flow Accumulated Balance is Monotonic**
  - **Validates: Requirements 8.3, 8.5**

- [x] 9. Melhorar logging e detecção de erros
  - Adicionar logging de sanitizações em SafeFinancialCalculator
  - Implementar logging estruturado em FinancialErrorDetector
  - Adicionar contexto completo (stack trace, inputs, metadata) em todos os logs
  - Implementar níveis de severidade corretos
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 9.1 Escrever testes de propriedade para logging
  - **Property 10: Error Logging Includes Full Context**
  - **Validates: Requirements 9.1, 9.3, 9.5**

- [x] 10. Adicionar proteções contra NaN em todos os cálculos
  - Revisar todos os usos de operações matemáticas
  - Substituir operações diretas por SafeFinancialCalculator onde necessário
  - Adicionar validação de resultado após cada cálculo crítico
  - Implementar fallbacks seguros para todos os cenários
  - _Requirements: 3.1, 3.5_

- [ ]* 10.1 Escrever testes de propriedade para proteção contra NaN
  - **Property 4: No NaN Values in Financial Calculations**
  - **Validates: Requirements 3.1, 3.5**

- [ ] 11. Corrigir filtros de dashboard
  - Atualizar filterDashboardTransactions para excluir foreign trips corretamente
  - Implementar filtro de moeda em calculateDashboardNetWorth
  - Adicionar validação de que apenas BRL é incluído
  - Corrigir filtro de upcoming bills (usar notificationDate)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 11.1 Escrever testes unitários para filtros de dashboard
  - Testar filtro de moeda estrangeira
  - Testar filtro de trips estrangeiros
  - Testar filtro de upcoming bills
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 12. Corrigir cálculo de sparklines
  - Atualizar calculateSparklineData para usar safe operations
  - Garantir que dias sem transações retornam 0
  - Adicionar sanitização de valores antes de somar
  - Validar que array retornado contém apenas números válidos
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 12.1 Escrever testes unitários para sparklines
  - Testar dias sem transações
  - Testar valores inválidos
  - Testar array de saída
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 13. Adicionar validação de transferências
  - Implementar validação de origem ≠ destino
  - Adicionar validação de multi-moeda (requer destinationAmount)
  - Validar que contas existem antes de criar transferência
  - Adicionar mensagens de erro específicas
  - _Requirements: 6.3, 6.5_

- [ ]* 13.1 Escrever testes unitários para validação de transferências
  - Testar origem = destino (deve rejeitar)
  - Testar multi-moeda sem destinationAmount (deve rejeitar)
  - Testar contas inexistentes (deve rejeitar)
  - _Requirements: 6.3, 6.5_

- [ ] 14. Implementar sanitização automática de dados
  - Adicionar sanitização em SafeFinancialCalculator.sanitizeTransactions
  - Implementar sanitização em SafeFinancialCalculator.sanitizeAccounts
  - Adicionar logging de todas as sanitizações realizadas
  - Garantir que dados sanitizados mantêm integridade
  - _Requirements: 3.3, 3.4_

- [ ]* 14.1 Escrever testes de propriedade para sanitização
  - **Property 9: Sanitization Preserves Data Integrity**
  - **Validates: Requirements 3.3, 9.2**

- [ ] 15. Adicionar validação de valores negativos
  - Implementar validação em validateTransaction
  - Permitir negativos apenas para refunds
  - Adicionar sugestão de usar isRefund flag
  - Rejeitar valores negativos em outros casos
  - _Requirements: 6.1_

- [ ]* 15.1 Escrever testes unitários para validação de valores
  - Testar valores negativos sem isRefund (deve rejeitar)
  - Testar valores negativos com isRefund (deve aceitar)
  - Testar valores zero (deve rejeitar)
  - _Requirements: 6.1_

- [ ] 16. Checkpoint final - Testes de integração
  - Executar todos os testes unitários e de propriedade
  - Testar fluxo completo: entrada → validação → cálculo → resultado
  - Verificar que todos os bugs identificados foram corrigidos
  - Validar que nenhum novo bug foi introduzido
  - Gerar relatório de saúde do sistema
  - Perguntar ao usuário se há dúvidas ou problemas

- [ ] 17. Documentação e cleanup
  - Atualizar comentários em código corrigido
  - Adicionar JSDoc para funções modificadas
  - Criar guia de debugging com exemplos de logs
  - Documentar padrões de validação e sanitização
  - _Requirements: 9.1, 9.2, 9.3_

- [ ]* 17.1 Criar documentação de debugging
  - Guia de interpretação de logs
  - Exemplos de erros comuns e soluções
  - Fluxograma de validação e sanitização
  - _Requirements: 9.1, 9.2, 9.3_

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam correção universal
- Testes unitários validam exemplos específicos e casos extremos
- Prioridade: Tarefas 1-6 são críticas e devem ser feitas primeiro
- Tarefas 7-15 são importantes mas podem ser feitas incrementalmente
- Tarefa 16 é checkpoint final obrigatório
- Tarefa 17 é documentação (pode ser feita em paralelo)
