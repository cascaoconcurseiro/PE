# Schema Audit: transactions table

## Data: 2026-02-23

## Objetivo
Auditar a tabela `transactions` para identificar discrepâncias entre o schema do banco de dados e o código.

## Colunas Existentes (database.types.ts)

### Identificação
- `id` (string) - PK
- `user_id` (string) - FK para auth.users

### Dados Básicos
- `description` (string) - Descrição da transação
- `amount` (number) - Valor
- `type` (string) - Tipo (RECEITA, DESPESA, TRANSFERÊNCIA)
- `category` (string) - Categoria
- `date` (string) - Data da transação
- `currency` (string | null) - Moeda

### Contas
- `account_id` (string | null) - Conta de origem
- `destination_account_id` (string | null) - Conta de destino (transferências)

### Parcelamento
- `is_installment` (boolean | null) - É parcelada?
- `current_installment` (number | null) - Parcela atual
- `total_installments` (number | null) - Total de parcelas
- `series_id` (string | null) - ID da série de parcelas
- `installment_plan_id` (string | null) - ID do plano de parcelamento

### Compartilhamento
- `is_shared` (boolean | null) - É compartilhada?
- `payer_id` (string | null) - Quem pagou ('me' ou UUID)
- `shared_with` (Json | null) - Divisão entre participantes
- `related_member_id` (string | null) - Membro relacionado

### Espelhamento
- `is_mirror` (boolean | null) - É espelho?
- `source_transaction_id` (string | null) - Transação original
- `mirror_transaction_id` (string | null) - Transação espelho
- `linked_transaction_id` (string | null) - Transação vinculada

### Recorrência
- `is_recurring` (boolean | null) - É recorrente?
- `frequency` (string | null) - Frequência
- `recurrence_day` (number | null) - Dia da recorrência
- `last_generated` (string | null) - Última geração
- `recurring_rule_id` (string | null) - ID da regra

### Viagem
- `trip_id` (string | null) - ID da viagem
- `domain` (string | null) - Domínio (PERSONAL, TRAVEL, SHARED, BUSINESS)

### Reconciliação
- `reconciled` (boolean | null) - Reconciliada?
- `reconciled_at` (string | null) - Data de reconciliação
- `reconciled_by` (string | null) - Quem reconciliou
- `reconciled_with` (string | null) - Com o quê reconciliou

### Liquidação
- `is_settled` (boolean | null) - Liquidada?
- `settled_at` (string | null) - Data de liquidação
- `settled_by_tx_id` (string | null) - Transação que liquidou

### Outros
- `observation` (string | null) - Observação
- `is_refund` (boolean | null) - É reembolso?
- `original_amount` (number | null) - Valor original
- `destination_amount` (number | null) - Valor de destino
- `exchange_rate` (number | null) - Taxa de câmbio
- `enable_notification` (boolean | null) - Habilitar notificação?
- `notification_date` (string | null) - Data de notificação
- `bank_statement_id` (string | null) - ID do extrato bancário
- `statement_id` (string | null) - ID do statement
- `sync_status` (string | null) - Status de sincronização
- `deleted` (boolean | null) - Deletada?
- `created_at` (string | null) - Data de criação
- `updated_at` (string | null) - Data de atualização

## Colunas Mencionadas no Erro mas NÃO Existentes

### ❌ notes
- **Status**: NÃO EXISTE no schema atual
- **Erro Reportado**: "column notes of relation transactions does not exist"
- **Uso**: Não encontrado no código TypeScript ou SQL
- **Ação**: Verificar se é realmente necessária ou se é erro de código antigo

## Análise de Discrepâncias

### 1. Coluna "notes" vs "observation"
- A tabela possui `observation` (string | null)
- O erro menciona `notes`
- **Hipótese**: Código antigo pode estar tentando usar `notes` quando deveria usar `observation`
- **Ação**: Buscar no código onde `notes` é referenciada e substituir por `observation`

### 2. Tipo de payer_id
- **Atual**: string | null
- **Esperado**: TEXT (correto)
- **Status**: ✅ OK

### 3. Constraints Faltantes
- Não há constraint para validar `type` IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA')
- Não há constraint para validar `domain` IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')
- **Ação**: Adicionar constraints na migration

## Recomendações

### Imediatas
1. ❌ **NÃO adicionar coluna `notes`** - Não é usada no código
2. ✅ Adicionar constraints de validação para `type` e `domain`
3. ✅ Documentar que `observation` é o campo correto para notas

### Médio Prazo
1. Considerar renomear `observation` para `notes` se fizer mais sentido semanticamente
2. Limpar colunas não usadas (muitas colunas podem indicar falta de normalização)
3. Considerar separar concerns em tabelas diferentes (DDD)

## Conclusão

A coluna `notes` **NÃO EXISTE** e **NÃO É NECESSÁRIA**. O erro reportado provavelmente vem de:
1. Código antigo que não foi atualizado
2. Documentação desatualizada
3. Confusão com a coluna `observation`

**Ação**: Não adicionar `notes`, mas adicionar constraints de validação.
