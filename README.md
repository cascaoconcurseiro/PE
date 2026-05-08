# Pé de Meia 💰

> Sistema de gestão financeira pessoal com suporte a transações compartilhadas, cartões de crédito e análise de fluxo de caixa.

## 🚀 Quick Start

### Pré-requisitos
- Node.js 22.11.0 (use `nvm use` se tiver nvm instalado)
- npm 10+ ou pnpm 9+
- Conta Supabase

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/cascaoconcurseiro/PE.git
cd PE/producao

# 2. Instale as dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves do Supabase

# 4. Inicie o desenvolvimento
npm run dev
```

## 📁 Estrutura do Projeto

```
producao/
├── src/                          # Código fonte
│   ├── components/              # Componentes React
│   ├── core/                    # Lógica financeira
│   ├── services/                # Serviços (Supabase, etc)
│   ├── types.ts                 # Tipos TypeScript
│   └── App.tsx                  # Componente raiz
├── supabase/
│   └── migrations/              # Migrações do banco
├── public/                      # Assets estáticos
├── index.html                   # HTML principal
├── vite.config.ts              # Configuração Vite
├── tsconfig.json               # Configuração TypeScript
├── tailwind.config.js          # Configuração Tailwind
└── package.json                # Dependências
```

## 📚 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run build            # Build para produção
npm run preview          # Pré-visualizar build

# Testes & Qualidade
npm run test             # Executar testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Coverage de testes
npm run lint             # Verificar lint
npm run typecheck        # Verificar tipos TypeScript

# Cleanup & Refactoring
npm run refactor         # Executar refatoração
npm run cleanup:analyze  # Analisar limpeza necessária
npm run cleanup:plan     # Planejar limpeza
npm run cleanup:execute  # Executar limpeza
```

## 🔐 Segurança

### Variáveis de Ambiente

⚠️ **NUNCA** faça commit de `.env.local` ou `.env.production`

```bash
# Seu .gitignore já protege isso:
*.local
.env.production
```

Variáveis seguras:
- `VITE_SUPABASE_URL` - URL do projeto (pública)
- `VITE_SUPABASE_ANON_KEY` - Chave anônima (controlada por RLS)

### RLS (Row Level Security)

Todas as políticas de acesso são gerenciadas via Supabase RLS.

## 🧪 Testes

```bash
# Rodar testes uma vez
npm run test

# Modo watch (rerun ao salvar)
npm run test:watch

# Com coverage
npm run test:coverage
```

## 📦 Deploy

### Vercel (Recomendado)

1. Push para GitHub
2. Conecte repositório no [Vercel](https://vercel.com)
3. Defina variáveis de ambiente em Settings → Environment Variables
4. Deploy automático

### Manualmente

```bash
# Build para produção
npm run build

# Arquivos estão em ./dist
```

## 🤝 Como Contribuir

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para:
- Como reportar bugs
- Como sugerir features
- Padrões de código
- Processo de pull request

## 📄 Licença

MIT License - veja [LICENSE](./LICENSE)

## 💬 Suporte

- 📖 [Documentação](./producao/docs)
- 🐛 [Issues](https://github.com/cascaoconcurseiro/PE/issues)
- 💬 [Discussions](https://github.com/cascaoconcurseiro/PE/discussions)

## 🎯 Status

- ✅ Backend: Saudável
- ✅ Frontend: Estável
- ✅ Documentação: Completa
- ✅ Testes: Configurados
- ✅ Deploy: Pronto

---

**Feito com ❤️ por [Wesley Lima](https://github.com/cascaoconcurseiro)**
