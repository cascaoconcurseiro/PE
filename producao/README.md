# Pé de Meia - Sistema de Produção

Esta pasta contém **APENAS** os arquivos essenciais para o funcionamento do sistema em produção.

## Estrutura

```
producao/
├── src/                    # Código fonte da aplicação
├── public/                 # Assets públicos (ícones, favicon)
├── android/                # App Android (Capacitor)
├── ios/                    # App iOS (Capacitor)
├── supabase/
│   └── migrations/         # Migrations do banco de dados
├── package.json            # Dependências do projeto
├── package-lock.json       # Lock file do npm
├── pnpm-lock.yaml         # Lock file do pnpm
├── tsconfig.json          # Configuração TypeScript
├── vite.config.ts         # Configuração Vite
├── vitest.config.ts       # Configuração de testes
├── capacitor.config.ts    # Configuração Capacitor
├── tailwind.config.js     # Configuração Tailwind CSS
├── postcss.config.js      # Configuração PostCSS
├── index.html             # HTML principal
├── .gitignore             # Arquivos ignorados pelo Git
├── .env.example           # Exemplo de variáveis de ambiente
└── .env.production        # Variáveis de ambiente de produção
```

## Como usar

1. Copie esta pasta para onde desejar
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente (copie .env.example para .env.local)
4. Execute em desenvolvimento: `npm run dev`
5. Build para produção: `npm run build`

## Observações

- **node_modules/** e **dist/** não foram copiados (são gerados automaticamente)
- Toda documentação, backups, logs e arquivos temporários estão na pasta **deletar/**
- Esta é uma versão limpa e pronta para deploy
