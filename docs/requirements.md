# Requirements Document

## Introduction

Este documento define os requisitos para a reestruturação completa do sistema financeiro "Pé de Meia". O sistema atual sofre de problemas críticos de performance, inconsistência de dados e código legado acumulado após múltiplas iterações de desenvolvimento. A reestruturação visa criar uma arquitetura limpa, performática e sincronizada entre frontend e backend.

## Glossary

- **Sistema**: Aplicação financeira "Pé de Meia" composta por frontend React e backend Supabase
- **Transação**: Registro financeiro de receita, despesa ou transferência
- **Conta**: Entidade que armazena saldo (conta corrente, poupança, cartão de crédito, etc.)
- **Saldo**: Valor monetário atual de uma conta
- **Flicker**: Comportamento onde valores aparecem e depois mudam rapidamente na UI
- **Lazy Loading**: Carregamento sob demanda de dados históricos
- **RPC**: Remote Procedure Call - funções do banco de dados chamadas pelo frontend
- **Trigger**: Função automática executada no banco quando dados são modificados
- **Migration**: Arquivo SQL que modifica a estrutura do banco de dados
- **Double Entry**: Princípio contábil onde toda transação afeta duas contas

## Diagnóstico dos Problemas Atuais

### Backend (Supabase)
1. **78+ arquivos de migration** acumulados, muitos com correções sobrepostas
2. **Triggers conflitantes** para atualização de saldo
3. **RPCs redundantes** com lógica duplicada
4. **Schema inconsistente** com campos TEXT onde deveria ser UUID
5. **Falta de índices** adequados para queries frequentes
6. **Lógica de negócio fragmentada** entre triggers, RPCs e frontend

### Frontend (React)
1. **useDataStore.ts** com 700+ linhas e responsabilidades misturadas
2. **Múltiplas fontes de verdade** para saldo (DB balance vs cálculo local)
3. **Realtime subscriptions** causando refreshes excessivos
4. **Lazy loading** mal implementado causando flicker
5. **Validações duplicadas** entre frontend e backend
6. **Lógica financeira espalhada** em múltiplos arquivos

## Requirements

### Requirement 1: Consolidação do Schema do Banco de Dados

**User Story:** As a developer, I want a single consolidated database schema, so that I can maintain and evolve the system without conflicts.

#### Acceptance Criteria

1. THE Sistema SHALL have a single consolidated migration file containing the complete database schema
2. THE Sistema SHALL use UUID type for all foreign key references (account_id, trip_id, etc.)
3. THE Sistema SHALL have proper indexes on frequently queried columns (user_id, date, account_id, deleted)
4. THE Sistema SHALL archive all legacy migrations in a separate folder without deleting them
5. THE Sistema SHALL have constraints ensuring referential integrity between transactions and accounts

### Requirement 2: Simplificação da Lógica de Saldo

**User Story:** As a user, I want to see accurate account balances immediately, so that I can trust the financial data displayed.

#### Acceptance Criteria

1. THE Sistema SHALL calculate account balances using a single authoritative method
2. WHEN a transaction is created, updated, or deleted THEN the Sistema SHALL update the account balance atomically via database trigger
3. THE Sistema SHALL NOT recalculate balances on the frontend except for projections
4. WHEN the user loads the dashboard THEN the Sistema SHALL display the stored balance without additional calculations
5. THE Sistema SHALL provide an RPC function to reconcile balances if inconsistencies are detected

### Requirement 3: Otimização do Carregamento de Dados

**User Story:** As a user, I want the application to load quickly without flickering values, so that I have a smooth experience.

#### Acceptance Criteria

1. WHEN the application starts THEN the Sistema SHALL load accounts and current month transactions in a single batch
2. THE Sistema SHALL NOT display partial data that causes value flickering
3. WHEN navigating to a different month THEN the Sistema SHALL load that month's data before updating the UI
4. THE Sistema SHALL cache loaded periods to avoid redundant fetches
5. THE Sistema SHALL use a loading state that blocks UI updates until data is complete

### Requirement 4: Refatoração do Data Store

**User Story:** As a developer, I want a clean and maintainable data layer, so that I can add features without introducing bugs.

#### Acceptance Criteria

1. THE Sistema SHALL separate data fetching logic from state management
2. THE Sistema SHALL have a single source of truth for each data entity
3. THE Sistema SHALL use optimistic updates only when the operation is guaranteed to succeed
4. WHEN an operation fails THEN the Sistema SHALL rollback optimistic updates and show an error
5. THE Sistema SHALL debounce realtime subscription updates to prevent excessive re-renders

### Requirement 5: Limpeza de Código Legado

**User Story:** As a developer, I want to remove unused code and dependencies, so that the codebase is easier to understand.

#### Acceptance Criteria

1. THE Sistema SHALL remove all unused service functions from supabaseService.ts
2. THE Sistema SHALL remove all unused hooks and components
3. THE Sistema SHALL consolidate duplicate utility functions
4. THE Sistema SHALL remove commented-out code blocks older than 30 days
5. THE Sistema SHALL have consistent naming conventions across all files

### Requirement 6: Sincronização Frontend-Backend

**User Story:** As a user, I want my data to be consistent between what I see and what is stored, so that I can trust the application.

#### Acceptance Criteria

1. THE Sistema SHALL validate all data on the backend before persisting
2. THE Sistema SHALL return validation errors with user-friendly messages
3. WHEN the backend rejects an operation THEN the Sistema SHALL display the specific reason to the user
4. THE Sistema SHALL NOT allow the frontend to bypass backend validations
5. THE Sistema SHALL log all data inconsistencies for debugging

### Requirement 7: Simplificação das Transações Compartilhadas

**User Story:** As a user, I want shared expenses to work reliably, so that I can split costs with family members.

#### Acceptance Criteria

1. THE Sistema SHALL store shared transaction splits in a normalized table instead of JSONB
2. WHEN a shared transaction is created THEN the Sistema SHALL create split records atomically
3. THE Sistema SHALL calculate receivables and payables from the splits table
4. WHEN a split is settled THEN the Sistema SHALL update both the split record and create a settlement transaction
5. THE Sistema SHALL prevent deletion of transactions with unsettled splits

### Requirement 8: Melhoria da Performance de Queries

**User Story:** As a user, I want the application to respond quickly to my actions, so that I can manage my finances efficiently.

#### Acceptance Criteria

1. THE Sistema SHALL have indexes on all columns used in WHERE clauses
2. THE Sistema SHALL use database views for complex aggregations instead of client-side calculations
3. THE Sistema SHALL limit query results to necessary data only
4. WHEN fetching transactions THEN the Sistema SHALL use pagination or date ranges
5. THE Sistema SHALL have query execution time under 200ms for common operations

### Requirement 9: Documentação e Manutenibilidade

**User Story:** As a developer, I want clear documentation of the system architecture, so that I can onboard quickly and make changes safely.

#### Acceptance Criteria

1. THE Sistema SHALL have a README documenting the project structure
2. THE Sistema SHALL have inline comments explaining complex business logic
3. THE Sistema SHALL have TypeScript types for all database entities
4. THE Sistema SHALL have a CHANGELOG documenting significant changes
5. THE Sistema SHALL have error messages that help identify the source of problems
