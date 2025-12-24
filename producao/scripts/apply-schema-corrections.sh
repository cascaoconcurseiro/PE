#!/bin/bash

# ==============================================================================
# Script: Apply Schema Corrections Migration
# Descrição: Aplica a migration de correção de schema no Supabase
# Uso: ./scripts/apply-schema-corrections.sh [local|staging|production]
# ==============================================================================

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar ambiente
ENVIRONMENT=${1:-local}

if [ "$ENVIRONMENT" != "local" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    log_error "Ambiente inválido: $ENVIRONMENT"
    echo "Uso: $0 [local|staging|production]"
    exit 1
fi

log_info "Aplicando schema corrections no ambiente: $ENVIRONMENT"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI não está instalado"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

# Navegar para diretório do projeto
cd "$(dirname "$0")/.."

# Verificar se migration existe
MIGRATION_FILE="supabase/migrations/20260223_schema_corrections.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    log_error "Migration não encontrada: $MIGRATION_FILE"
    exit 1
fi

log_info "Migration encontrada: $MIGRATION_FILE"

# Aplicar migration baseado no ambiente
case $ENVIRONMENT in
    local)
        log_info "Aplicando migration localmente..."
        
        # Verificar se Supabase local está rodando
        if ! supabase status &> /dev/null; then
            log_warn "Supabase local não está rodando. Iniciando..."
            supabase start
        fi
        
        # Aplicar migration
        supabase db reset
        
        log_info "✓ Migration aplicada localmente com sucesso!"
        ;;
        
    staging)
        log_warn "Aplicando migration em STAGING..."
        read -p "Tem certeza? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            log_info "Operação cancelada"
            exit 0
        fi
        
        # Aplicar via Supabase CLI (requer configuração)
        supabase db push --db-url "$SUPABASE_STAGING_URL"
        
        log_info "✓ Migration aplicada em staging com sucesso!"
        ;;
        
    production)
        log_error "ATENÇÃO: Aplicando migration em PRODUCTION!"
        log_warn "Esta operação é IRREVERSÍVEL!"
        read -p "Digite 'APPLY PRODUCTION' para confirmar: " confirm
        
        if [ "$confirm" != "APPLY PRODUCTION" ]; then
            log_info "Operação cancelada"
            exit 0
        fi
        
        # Criar backup antes
        log_info "Criando backup antes da migration..."
        BACKUP_FILE="backup_pre_schema_corrections_$(date +%Y%m%d_%H%M%S).sql"
        
        # Aplicar migration
        supabase db push --db-url "$SUPABASE_PRODUCTION_URL"
        
        log_info "✓ Migration aplicada em production com sucesso!"
        log_info "Backup salvo em: $BACKUP_FILE"
        ;;
esac

# Validação pós-migration
log_info "Executando validações pós-migration..."

# Verificar constraints
log_info "Verificando constraints..."
supabase db execute --sql "
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
AND conname IN ('check_transaction_type', 'check_transaction_domain');
"

# Verificar índices
log_info "Verificando índices..."
supabase db execute --sql "
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'transactions'
AND indexname IN ('idx_transactions_type_date', 'idx_transactions_domain', 'idx_transactions_shared');
"

log_info "========================================="
log_info "SCHEMA CORRECTIONS APLICADAS COM SUCESSO"
log_info "========================================="
log_info ""
log_info "Próximos passos:"
log_info "1. Executar testes de validação"
log_info "2. Atualizar tipos TypeScript"
log_info "3. Validar que RPCs funcionam"

exit 0
