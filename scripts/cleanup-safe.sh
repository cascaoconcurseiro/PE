#!/bin/bash
# Script para limpeza segura de arquivos de debug e temporários
# Execute com cuidado: git status antes de executar

echo "🧹 Limpeza Segura de Arquivos de Debug"
echo "======================================"
echo ""

# Criar diretório de backup
mkdir -p .cleanup-backup

# Arquivos que podem ser removidos com segurança
FILES_TO_REMOVE=(
    "debug_data_dump.sql"
    "debug_inspect.sql"
    "errors_v2.txt"
    "errors.log"
    "errors.txt"
    "fix_phantom.sql"
    "force-link-trips-v2.sql"
    "force-link-trips.sql"
    "deployment.log"
    "lighthouse-report.json"
    "metadata.json"
)

echo "📦 Fazendo backup dos arquivos..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" ".cleanup-backup/$file"
        echo "  ✓ Backup: $file"
    fi
done

echo ""
echo "🗑️  Removendo arquivos..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✓ Removido: $file"
    fi
done

echo ""
echo "✅ Limpeza concluída!"
echo "📦 Backup salvo em: .cleanup-backup/"
echo ""
echo "⚠️  Para reverter:"
echo "   cp .cleanup-backup/* ."

