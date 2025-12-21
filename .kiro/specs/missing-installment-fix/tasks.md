# Implementation Plan: Missing Installment Fix

## Overview

Este plano implementa a correção do bug onde parcelas importadas aparecem em quantidades diferentes para usuários diferentes. A implementação segue uma abordagem de 4 fases: diagnóstico, correção, validação e prevenção.

## Tasks

- [x] 1. Implementar Diagnostic Engine
  - Criar função SQL para diagnóstico completo de parcelas faltantes
  - Implementar identificação de usuários A e B
  - Implementar análise detalhada de cada parcela
  - Implementar detecção de problemas (user_id incorreto, parcelas deletadas)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Escrever testes de propriedade para diagnóstico
  - **Property 1: Complete Installment Discovery**
  - **Property 2: Comprehensive Analysis Coverage**
  - **Property 3: Problem Detection Completeness**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. Implementar Correction Engine
  - Criar função SQL para correção de user_id das parcelas
  - Implementar restauração de parcelas deletadas
  - Implementar operações atômicas com transações
  - Implementar validação de contas antes da correção
  - Implementar logging de todas as operações
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

- [x] 2.1 Escrever testes de propriedade para correção
  - **Property 4: User_ID Correction Accuracy**
  - **Property 5: Data Preservation During Correction**
  - **Property 6: Atomic Correction Operations**
  - **Property 7: Account Validation Before Correction**
  - **Property 8: Deletion Restoration Accuracy**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2**

- [ ] 3. Implementar Validation Engine
  - Criar função SQL para validação pós-correção
  - Implementar contagem de parcelas visíveis
  - Implementar verificação de integridade dos dados
  - Implementar validação de consistência (user_id, deleted, account_id)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3.1 Escrever testes de propriedade para validação
  - **Property 9: Post-Correction Visibility Consistency**
  - **Property 10: Installment Count Accuracy**
  - **Property 11: No Deleted Installments After Correction**
  - **Property 12: Account Consistency**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [ ] 4. Checkpoint - Testar engines individuais
  - Executar testes unitários para cada engine
  - Verificar que todas as funções SQL foram criadas corretamente
  - Validar que os testes de propriedade passam
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implementar Prevention System
  - Verificar se função RPC create_transaction está correta
  - Verificar se função can_access_account existe
  - Implementar testes de regressão para importação
  - Implementar validação de segurança
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5.1 Escrever testes de propriedade para prevenção
  - **Property 13: Security Validation**
  - **Validates: Requirements 5.4**

- [ ] 6. Criar script de execução principal
  - Criar migration SQL que executa todas as fases
  - Implementar modo dry-run para teste seguro
  - Implementar logging detalhado de todas as operações
  - Implementar rollback automático em caso de erro
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [ ] 6.1 Escrever testes de integração
  - Testar fluxo completo de diagnóstico → correção → validação
  - Testar cenários de erro e rollback
  - Testar modo dry-run vs execução real
  - _Requirements: All requirements_

- [ ] 7. Aplicar correção no ambiente de produção
  - Executar script em modo dry-run primeiro
  - Analisar resultados do dry-run
  - Executar correção real se dry-run for bem-sucedido
  - Validar que todas as parcelas aparecem corretamente
  - _Requirements: All requirements_

- [ ] 8. Checkpoint final - Validar correção completa
  - Verificar que usuário B vê todas as 10 parcelas
  - Verificar que não há parcelas duplicadas
  - Verificar que dados estão íntegros
  - Documentar resultados da correção
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks incluem testes completos para garantir correção robusta
- Cada task referencia requirements específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de correção
- Testes unitários validam exemplos específicos e casos extremos
- Modo dry-run permite teste seguro antes da execução real