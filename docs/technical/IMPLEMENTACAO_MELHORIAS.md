# 🚀 GUIA DE IMPLEMENTAÇÃO DAS MELHORIAS

**Passo a passo para implementar as melhorias críticas**

---

## PASSO 1: Instalar Dependências

```bash
npm install decimal.js @types/decimal.js
```

---

## PASSO 2: Refatorar financialPrecision.ts

1. Abrir `src/services/financialPrecision.ts`
2. Substituir todo o conteúdo pelo código melhorado (ver `MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md`)
3. Testar: `npm run build`

---

## PASSO 3: Atualizar Imports

Buscar e substituir em todos os arquivos:

```typescript
// ANTES
import { round2dec } from './balanceEngine';
const round2dec = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

// DEPOIS
import { FinancialPrecision, round2dec } from './financialPrecision';
```

---

## PASSO 4: Refatorar balanceEngine.ts

1. Abrir `src/services/balanceEngine.ts`
2. Remover função `round2dec` local (linha 5)
3. Importar `FinancialPrecision`
4. Substituir todas as operações matemáticas por métodos de `FinancialPrecision`

---

## PASSO 5: Criar IntegrityService

1. Criar `src/services/integrityService.ts`
2. Copiar código de `MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md`
3. Integrar no `useDataStore.ts` para verificação periódica

---

## PASSO 6: Testar

```bash
# Executar testes
npm test

# Verificar build
npm run build

# Testar no navegador
npm run dev
```

---

## ⚠️ ATENÇÃO

- Fazer backup antes de começar
- Testar cada passo individualmente
- Verificar se não quebrou funcionalidades existentes

