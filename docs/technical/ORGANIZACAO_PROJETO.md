# 📁 Organização do Projeto

## ✅ Estrutura Criada

### Scripts
- `scripts/deploy/` - Scripts de deploy ativos
- `scripts/archive/deploy-old/` - Scripts antigos arquivados
- `scripts/cleanup-safe.ps1` - Limpeza segura
- `scripts/archive-old-migrations.ps1` - Arquivar migrations
- `scripts/organize-all.ps1` - Organização completa

### Documentação
- `docs/guides/` - Guias práticos
- `docs/technical/` - Documentação técnica
- `docs/sql-scripts/` - Scripts SQL auxiliares
- `docs/archive/` - Documentação antiga

## 🗑️ Arquivos Removidos

- `ms-azuretools.vscode-docker-2.0.0.vsix` - Arquivo VSIX desnecessário

## 📋 Próximos Passos

1. **Organizar documentação manualmente:**
   - Mover guias para `docs/guides/`
   - Mover análises técnicas para `docs/technical/`
   - Arquivar docs antigas em `docs/archive/`

2. **Revisar código:**
   - Verificar se `balanceEngine.calculateBalances` ainda é usado
   - Remover código obsoleto
   - Limpar imports não utilizados

3. **Verificar migrations:**
   - Manter apenas migrations ativas em `supabase/migrations/`
   - Arquivar migrations antigas

## 🎯 Estrutura Final Esperada

```
PE/
├── src/                    # Código fonte
├── supabase/
│   └── migrations/        # Migrations ativas
├── scripts/
│   ├── deploy/           # Scripts de deploy
│   └── archive/          # Scripts antigos
├── docs/
│   ├── guides/           # Guias práticos
│   ├── technical/        # Documentação técnica
│   ├── sql-scripts/      # Scripts SQL
│   └── archive/          # Docs antigas
└── public/               # Arquivos estáticos
```

