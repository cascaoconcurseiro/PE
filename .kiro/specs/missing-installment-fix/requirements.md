# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o bug onde parcelas importadas aparecem em quantidades diferentes para usuários diferentes. Especificamente, o usuário A (quem importou) vê 10 parcelas, mas o usuário B (dono da conta) vê apenas 9 parcelas.

## Glossary

- **System**: O sistema de gerenciamento financeiro
- **User_A**: Usuário que realizou a importação das parcelas
- **User_B**: Usuário dono da conta onde as parcelas foram importadas
- **Installment**: Parcela de uma transação parcelada
- **Transaction**: Registro de transação financeira no banco de dados
- **Account**: Conta financeira (cartão de crédito, conta bancária, etc.)
- **Database**: Banco de dados Supabase PostgreSQL

## Requirements

### Requirement 1: Diagnóstico de Parcelas Faltantes

**User Story:** Como desenvolvedor, eu quero diagnosticar exatamente quais parcelas estão faltando e por quê, para que eu possa corrigir o problema de forma precisa.

#### Acceptance Criteria

1. WHEN o sistema executa o diagnóstico, THE System SHALL identificar todas as parcelas relacionadas à importação
2. WHEN o sistema analisa cada parcela, THE System SHALL verificar o user_id, account_id, e status deleted de cada parcela
3. WHEN o sistema encontra parcelas com user_id incorreto, THE System SHALL listar essas parcelas com seus IDs
4. WHEN o sistema encontra parcelas deletadas, THE System SHALL listar essas parcelas com seus IDs
5. THE System SHALL comparar a quantidade de parcelas visíveis para User_A versus User_B

### Requirement 2: Correção de User_ID das Parcelas

**User Story:** Como usuário dono da conta, eu quero que todas as parcelas importadas apareçam na minha conta, para que eu possa visualizar e gerenciar todas as minhas transações.

#### Acceptance Criteria

1. WHEN uma parcela tem user_id incorreto, THE System SHALL atualizar o user_id para o ID do dono da conta
2. WHEN o sistema atualiza o user_id, THE System SHALL preservar todos os outros dados da parcela
3. WHEN o sistema atualiza múltiplas parcelas, THE System SHALL executar a operação de forma atômica
4. THE System SHALL validar que a conta de destino existe e não está deletada antes de atualizar
5. THE System SHALL registrar em log todas as atualizações realizadas

### Requirement 3: Restauração de Parcelas Deletadas

**User Story:** Como usuário dono da conta, eu quero que parcelas que foram incorretamente deletadas sejam restauradas, para que eu possa ver todas as minhas transações.

#### Acceptance Criteria

1. WHEN uma parcela está marcada como deleted=true incorretamente, THE System SHALL restaurar a parcela (deleted=false)
2. WHEN o sistema restaura uma parcela, THE System SHALL atualizar o user_id para o dono da conta
3. THE System SHALL validar que a parcela pertence ao grupo de parcelas sendo corrigido
4. THE System SHALL registrar em log todas as restaurações realizadas

### Requirement 4: Validação de Integridade

**User Story:** Como desenvolvedor, eu quero validar que todas as parcelas estão corretas após a correção, para garantir que o problema foi completamente resolvido.

#### Acceptance Criteria

1. WHEN a correção é aplicada, THE System SHALL contar quantas parcelas são visíveis para User_B
2. WHEN a contagem é realizada, THE System SHALL verificar que o número total de parcelas corresponde ao esperado
3. THE System SHALL verificar que todas as parcelas têm o mesmo user_id (do dono da conta)
4. THE System SHALL verificar que nenhuma parcela está marcada como deleted
5. THE System SHALL verificar que todas as parcelas pertencem à mesma conta

### Requirement 5: Prevenção de Regressão

**User Story:** Como desenvolvedor, eu quero garantir que este problema não ocorra novamente no futuro, para manter a integridade dos dados.

#### Acceptance Criteria

1. THE System SHALL validar que a função RPC create_transaction usa o user_id do dono da conta
2. THE System SHALL validar que existe a função can_access_account para verificar permissões
3. WHEN novas parcelas são criadas via importação, THE System SHALL usar o user_id do dono da conta
4. THE System SHALL rejeitar tentativas de criar transações em contas sem permissão
