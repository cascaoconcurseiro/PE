# 🤝 Contribuindo para o Pé de Meia

Primeiro, obrigado por considerar contribuir! Aqui estão as diretrizes.

## 📋 Código de Conduta

Este projeto adere ao [Contributor Covenant](https://www.contributor-covenant.org/).

Por favor:
- Seja respeitoso
- Aceite crítica construtiva
- Foque no que é melhor para a comunidade

## 🐛 Como Reportar Bugs

### Antes de Reportar

- Verifique se o bug já foi reportado
- Tente reproduzir em um ambiente limpo
- Colete informações:
  - Versão do Node.js (`node --version`)
  - Versão do npm (`npm --version`)
  - Sistema operacional
  - Passos para reproduzir
  - Comportamento esperado vs observado

### Reportando

1. Abra uma [Issue](https://github.com/cascaoconcurseiro/PE/issues/new)
2. Use título descritivo
3. Descreva problema com máximo detalhe
4. Forneça exemplo específico
5. Descreva comportamento observado e esperado

## 💡 Como Sugerir Features

1. Verifique se a feature já foi sugerida
2. Use título claro e descritivo
3. Forneça descrição detalhada da feature
4. Liste exemplos de como seria usado
5. Mencione por que seria útil

## 🔧 Setup de Desenvolvimento

### 1. Fork & Clone

```bash
git clone https://github.com/seu-usuario/PE.git
cd PE
git remote add upstream https://github.com/cascaoconcurseiro/PE.git
```

### 2. Setup Node.js

```bash
# Se usar nvm
nvm use

# Se não tiver nvm, instale Node.js 22.11.0
```

### 3. Instale Dependências

```bash
cd producao
npm install
```

### 4. Configure Ambiente

```bash
cp .env.example .env.local
# Edite com suas credenciais do Supabase
```

### 5. Inicie Desenvolvimento

```bash
npm run dev
```

## 📝 Padrões de Código

### TypeScript

- ✅ Use tipos explícitos
- ✅ Evite `any`
- ✅ Use interfaces para objetos
- ❌ Não use `as any`

```typescript
// ✅ Bom
interface User {
  id: string;
  name: string;
}

function getUser(id: string): User {
  // ...
}

// ❌ Ruim
function getUser(id: any): any {
  // ...
}
```

### React

- ✅ Use functional components
- ✅ Use hooks
- ✅ Memoize quando necessário
- ✅ Componentes pequenos e reutilizáveis

```typescript
// ✅ Bom
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false,
}) => (
  <button onClick={onClick} disabled={disabled}>
    {label}
  </button>
);

export default Button;
```

### Lint & Format

```bash
# Lint e fix automaticamente
npm run lint:fix

# Prettier
npx prettier --write src

# TypeScript check
npm run typecheck
```

## 🔀 Processo de Pull Request

### 1. Crie uma Branch

```bash
git checkout -b feature/sua-feature
# ou
git checkout -b fix/seu-bug
```

### 2. Commite Suas Mudanças

```bash
git add .
git commit -m "tipo: descrição"
```

### Tipos de Commit

- `feat:` Nova feature
- `fix:` Correção de bug
- `docs:` Mudanças em documentação
- `style:` Formatação (sem mudança lógica)
- `refactor:` Refatoração de código
- `perf:` Melhorias de performance
- `test:` Adicionar/atualizar testes
- `chore:` Atualizar dependências, config, etc

```bash
# Exemplos
git commit -m "feat: Adicionar suporte a múltiplas moedas"
git commit -m "fix: Corrigir cálculo de saldo projetado"
git commit -m "docs: Atualizar README com novo setup"
```

### 3. Push e Abra PR

```bash
git push origin feature/sua-feature
```

Depois abra um Pull Request no GitHub.

### 4. Checklist Pré-PR

- [ ] Código segue padrões do projeto
- [ ] Testes passam: `npm run test`
- [ ] Lint passa: `npm run lint`
- [ ] TypeScript passa: `npm run typecheck`
- [ ] Build funciona: `npm run build`
- [ ] Commit message segue convenção
- [ ] Descrição de PR é clara
- [ ] Referencia issues relacionadas

### 5. Code Review

- Mantenedores revisarão seu código
- Pode haver sugestões ou mudanças
- Seja receptivo e respeitoso

## 📖 Documentação

### README

- Descreva o que sua mudança faz
- Adicione exemplos de uso
- Atualize documentação existente

### Testes

- Escreva testes para novas features
- Atualize testes para mudanças
- Mantenha coverage acima de 80%

```bash
npm run test:coverage
```

## ✅ Checklist Final

Antes de submeter PR:

```bash
# 1. Format code
npm run lint:fix

# 2. Type check
npm run typecheck

# 3. Run tests
npm run test

# 4. Build
npm run build
```

## 🙏 Obrigado!

Sua contribuição é muito valiosa. Agradecemos por melhorar este projeto!

---

**Dúvidas?** Abra uma [Discussion](https://github.com/cascaoconcurseiro/PE/discussions)!
