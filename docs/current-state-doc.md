# Current System State Documentation
**Data:** 2025-02-20  
**Objetivo:** Documentar estado atual do sistema antes da reestruturação

## Database Schema Overview

### Main Tables
- `accounts` - Contas financeiras (corrente, poupança, cartão, etc.)
- `transactions` - Transações financeiras (receitas, despesas, transferências)
- `trips` - Viagens associadas a despesas
- `family_members` - Membros da família para divisão de despesas
- `assets` - Ativos e investimentos

### Known Issues (Documented in Requirements)
1. **78+ migration files** com lógica sobreposta
2. **Triggers conflitantes** para atualização de saldo
3. **Schema inconsistente** - alguns campos TEXT onde deveria ser UUID
4. **Falta de índices** adequados
5. **Lógica fragmentada** entre triggers, RPCs e frontend

## Frontend Architecture

### Current Structure
```
src/
├── hooks/
│   └── useDataStore.ts (700+ linhas - PROBLEMA)
├── services/
│   └── supabaseService.ts
├── utils/
│   └── financialLogic.ts
└── components/
    └── [diversos componentes]
```

### Known Issues
1. **useDataStore.ts** mistura fetching, state e business logic
2. **Múltiplas fontes de verdade** para saldo
3. **Realtime subscriptions** causando refreshes excessivos
4. **Lazy loading** mal implementado (flicker)
5. **Validações duplicadas** frontend/backend

## Current Functionality (Working)
✅ Autenticação de usuários
✅ CRUD de contas
✅ CRUD de transações
✅ Transações compartilhadas (com JSONB)
✅ Parcelamento de despesas
✅ Associação com viagens
✅ Dashboard com gráficos
✅ Filtros por período

## Performance Baseline
- **Dashboard load time**: ~2-3 segundos (com flicker)
- **Transaction creation**: ~500ms
- **Month navigation**: ~1-2 segundos (com flicker)

## Data Integrity Checks
- [ ] Verificar saldos inconsistentes
- [ ] Validar referências órfãs
- [ ] Checar transações sem conta
- [ ] Validar splits em JSONB

## Rollback Points
Se algo der errado, podemos voltar para este estado:
- Migrations atuais funcionando
- Frontend atual funcionando
- Dados íntegros (com issues conhecidos)

## Next Steps
1. Criar backup completo do banco
2. Configurar ambiente de staging
3. Iniciar implementação incremental