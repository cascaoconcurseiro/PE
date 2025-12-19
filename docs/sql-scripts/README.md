# Scripts SQL - Pé de Meia

## Scripts Ativos

| Script | Descrição | Quando Usar |
|--------|-----------|-------------|
| `SUPABASE_SCHEMA.sql` | Schema completo do banco | Setup inicial |
| `FACTORY_RESET_V3.sql` | Reset de dados do usuário | Factory reset via app |
| `FULL_DB_DIAGNOSTIC.sql` | Diagnóstico completo | Debug de problemas |
| `DIAGNOSE_FK_CONSTRAINTS.sql` | Verifica FKs | Debug de constraints |
| `APPLY_PERFORMANCE_INDEXES.sql` | Índices de performance | Otimização |
| `CREATE_RPC_FUNCTION.sql` | RPCs principais | Setup inicial |
| `CREATE_RPC_GET_ACCOUNT_TOTALS.sql` | RPC de saldos | Setup inicial |
| `CREATE_USER_SETTINGS_TABLE.sql` | Tabela de configurações | Setup inicial |
| `SHARED_EXPENSES_MIGRATION.sql` | Migração de compartilhados | Migração |
| `TRIGGER_NOTIFICACAO_COMPARTILHADO.sql` | Trigger de notificações | Setup inicial |
| `UPDATE_RLS_FOR_SHARED_VIEW.sql` | RLS para views | Setup inicial |
| `CONSTRAINTS_VALIDACAO.sql` | Constraints de validação | Setup inicial |
| `CHECK_INDEXES.sql` | Verifica índices | Diagnóstico |
| `CHECK_USER_RPC.sql` | Verifica RPCs | Diagnóstico |
| `APPLY_INDEXES.sql` | Aplica índices | Otimização |

## Pasta `archive/`

Scripts obsoletos mantidos para referência histórica. **Não usar em produção.**

## Como Usar

1. Acesse o **Supabase SQL Editor**
2. Cole o conteúdo do script desejado
3. Execute

## Ordem de Execução (Setup Inicial)

1. `SUPABASE_SCHEMA.sql`
2. `CREATE_RPC_FUNCTION.sql`
3. `CREATE_RPC_GET_ACCOUNT_TOTALS.sql`
4. `CREATE_USER_SETTINGS_TABLE.sql`
5. `APPLY_PERFORMANCE_INDEXES.sql`
6. `CONSTRAINTS_VALIDACAO.sql`
7. `TRIGGER_NOTIFICACAO_COMPARTILHADO.sql`
8. `UPDATE_RLS_FOR_SHARED_VIEW.sql`
