#!/bin/bash

# ==============================================================================
# Script: Regenerate TypeScript Types from Supabase
# Descrição: Regenera os tipos TypeScript a partir do schema do Supabase
# Uso: ./scripts/regenerate-types.sh
# ==============================================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[INFO]${NC} Regenerando tipos TypeScript do Supabase..."

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Supabase CLI não encontrado. Instalando..."
    npm install -g supabase
fi

# Navegar para diretório do projeto
cd "$(dirname "$0")/.."

# Verificar se Supabase está configurado
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${YELLOW}[WARN]${NC} Supabase não está inicializado. Inicializando..."
    supabase init
fi

# Gerar tipos
echo -e "${GREEN}[INFO]${NC} Gerando tipos a partir do schema..."
supabase gen types typescript --local > src/types/database.types.ts

echo -e "${GREEN}[INFO]${NC} ✓ Tipos TypeScript regenerados com sucesso!"
echo -e "${GREEN}[INFO]${NC} Arquivo: src/types/database.types.ts"

# Validar que arquivo foi criado
if [ -f "src/types/database.types.ts" ]; then
    LINES=$(wc -l < src/types/database.types.ts)
    echo -e "${GREEN}[INFO]${NC} Arquivo contém $LINES linhas"
else
    echo -e "${YELLOW}[WARN]${NC} Arquivo não foi criado!"
    exit 1
fi

echo -e "${GREEN}[INFO]${NC} Próximos passos:"
echo -e "${GREEN}[INFO]${NC} 1. Revisar src/types/database.types.ts"
echo -e "${GREEN}[INFO]${NC} 2. Corrigir imports quebrados no código"
echo -e "${GREEN}[INFO]${NC} 3. Executar testes"

exit 0
