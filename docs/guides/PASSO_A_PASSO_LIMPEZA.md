# 📋 PASSO A PASSO - LIMPEZA DO SISTEMA

**Para quem não sabe programação - Instruções Simples**

---

## ✅ O QUE JÁ FOI FEITO AUTOMATICAMENTE

1. ✅ **Arquivos de debug removidos** (com backup)
2. ✅ **Migrations antigas arquivadas** (movidas para pasta de arquivo)

---

## 📝 COMO EXECUTAR OS SCRIPTS (SE PRECISAR NOVAMENTE)

### Opção 1: Pelo Terminal do Cursor/VS Code

1. Abra o terminal (Ctrl + ` ou Terminal → New Terminal)
2. Digite o comando e pressione Enter:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\cleanup-safe.ps1
```

3. Para arquivar migrations:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\archive-old-migrations.ps1
```

### Opção 2: Pelo Explorador de Arquivos do Windows

1. Abra o Explorador de Arquivos
2. Navegue até a pasta do projeto: `C:\Users\Wesley\dyad-apps\PE`
3. Clique com botão direito na pasta `scripts`
4. Selecione "Abrir no Terminal" ou "Abrir no PowerShell"
5. Digite:

```powershell
.\cleanup-safe.ps1
```

---

## 🔄 COMO REVERTER (SE PRECISAR)

Se você precisar recuperar os arquivos removidos:

1. Abra o terminal na pasta do projeto
2. Digite:

```powershell
Copy-Item .cleanup-backup\* .
```

Isso copia todos os arquivos de volta.

---

## 📁 ONDE ESTÃO OS ARQUIVOS ARQUIVADOS?

- **Backup de arquivos removidos:** `.cleanup-backup\`
- **Migrations antigas:** `supabase\migrations\archive\2026-01-27_consolidacao\`

---

## ⚠️ IMPORTANTE

- ✅ Os arquivos foram **movidos**, não deletados permanentemente
- ✅ Você pode reverter a qualquer momento
- ✅ As migrations antigas **já foram aplicadas no banco**, então arquivar é seguro
- ✅ O sistema continua funcionando normalmente

---

## 🎯 PRÓXIMOS PASSOS

Agora que a limpeza foi feita, você pode:

1. **Fazer commit das mudanças** (se usar Git)
2. **Continuar usando o sistema normalmente**
3. **Implementar as melhorias** descritas em `docs/LIMPEZA_E_MELHORIAS.md`

---

## ❓ DÚVIDAS?

Se algo der errado:
1. Os arquivos estão em `.cleanup-backup\` (pode copiar de volta)
2. As migrations estão em `supabase\migrations\archive\` (não precisa fazer nada)

Tudo está seguro! 🛡️

