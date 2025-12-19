# Changelog - Pé de Meia

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.0.2] - 2025-12-19

### Adicionado
- **Testes Unitários**: Implementados testes para `financialPrecision`, `financialLogic` e `validationService`
- **Vitest**: Configuração completa de testes com cobertura de código
- **Hooks Modulares**: Criados `useAccountStore` e `useTransactionStore` para melhor separação de responsabilidades
- **Scripts de Desenvolvimento**: Adicionados `test`, `test:watch`, `test:coverage`, `lint` e `typecheck`

### Corrigido
- **IntegrityService**: Corrigida comparação de tipos de conta usando utilitário centralizado
- **Validações**: Melhorada validação de transações compartilhadas e órfãs
- **Precisão Financeira**: Uso consistente de `FinancialPrecision` para cálculos de parcelas

### Melhorado
- **Documentação**: Consolidada documentação técnica
- **Tipos**: Uso de `TransactionType` enum ao invés de strings hardcoded
- **Código**: Removidos imports não utilizados e código morto

## [0.0.1] - 2025-12-18

### Funcionalidades Principais
- Dashboard com projeção financeira
- Gerenciamento de contas (corrente, poupança, cartão de crédito, investimentos)
- Transações com parcelamento e recorrência
- Despesas compartilhadas com splits
- Viagens com orçamento e participantes
- Metas financeiras
- Orçamentos por categoria
- Investimentos e ativos
- Relatórios PDF
- PWA com suporte offline
- Multi-moeda com conversão

### Arquitetura
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + Auth + RLS)
- Capacitor para mobile (iOS/Android)
- TailwindCSS para estilização
- Decimal.js para precisão financeira

---

## Legenda

- **Adicionado**: Novas funcionalidades
- **Corrigido**: Correções de bugs
- **Melhorado**: Melhorias em funcionalidades existentes
- **Removido**: Funcionalidades removidas
- **Segurança**: Correções de segurança
