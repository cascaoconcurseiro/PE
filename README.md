# Pé de Meia - Projeto Organizado

## 📁 Estrutura Atual

```
PE/
├── .git/              # Histórico Git (manter se precisar do histórico)
├── producao/          # ✅ SISTEMA COMPLETO - USAR ESTA PASTA
└── deletar/           # 🗑️ ARQUIVOS DESNECESSÁRIOS - PODE DELETAR
```

---

## ✅ `producao/` - PASTA PRINCIPAL

**Esta é a única pasta que você precisa!**

Contém o sistema completo e funcional:
- Código fonte (src/)
- Apps mobile (android/, ios/)
- Migrations do banco (supabase/migrations/)
- Assets (public/)
- Todas as configurações
- Arquivos de ambiente

**Como usar:**
```bash
cd producao
npm install
npm run dev
```

---

## 🗑️ `deletar/` - PODE DELETAR TUDO

Contém arquivos desnecessários:
- Cópias antigas de src/, android/, ios/, public/, supabase/
- node_modules/ (pode reinstalar)
- dist/ (pode recriar com build)
- Documentação
- Backups
- Scripts
- Specs antigas
- Debug/logs
- Arquivos de configuração duplicados

**Para deletar:**
```bash
Remove-Item -Recurse -Force deletar
```

---

## 🔄 Próximos Passos

### Opção 1: Usar apenas a pasta producao/
1. Entre em `producao/`
2. Execute `npm install`
3. Configure `.env.local` com suas credenciais
4. Execute `npm run dev`
5. Delete a pasta `deletar/`
6. (Opcional) Delete `.git/` se não precisar do histórico

### Opção 2: Substituir o projeto atual
1. Copie o conteúdo de `producao/` para outro lugar
2. Delete esta pasta PE/ inteira
3. Use a cópia de `producao/` como seu projeto

---

## ⚠️ Sobre o `.git/`

A pasta `.git/` contém o histórico de commits do Git.

**Manter se:**
- Você quer preservar o histórico de commits
- Você usa Git para controle de versão
- Você faz push/pull para repositórios remotos

**Deletar se:**
- Você não precisa do histórico
- Você vai começar um novo repositório
- Você quer economizar espaço

---

## 📊 Resumo

| Pasta | Tamanho | Arquivos | Status |
|-------|---------|----------|--------|
| `producao/` | 60.6 MB | 1.497 | ✅ MANTER |
| `deletar/` | 0.91 GB | 91.094 | 🗑️ DELETAR |
| `.git/` | Variável | Variável | ⚠️ Você decide |

---

## 🎯 Resultado

**Antes:** Projeto desorganizado com arquivos espalhados
**Depois:** Apenas 2 pastas - uma para usar, outra para deletar

**Sistema 100% funcional na pasta `producao/`!** 🎉
