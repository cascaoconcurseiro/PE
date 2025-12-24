# Phase 8: Integration Testing - Implementation Plan

**Data:** 2024-12-24  
**Status:** 📋 PLANEJADO  
**Prioridade:** MÉDIA (Recomendado pós-produção)

---

## Resumo Executivo

Esta fase documenta o plano de implementação de testes de integração para o sistema financeiro. Os testes validarão fluxos end-to-end críticos.

**Decisão:** Implementar **após** deployment de produção inicial, pois:
- Backend está validado e saudável
- Health checks estão ativos
- Sistema está funcional
- Testes automatizados aumentarão confiança em mudanças futuras

---

## Task 15.1: Setup Integration Test Environment

### Ferramentas Recomendadas

**1. Vitest** (já configurado no projeto)
```bash
npm install -D vitest @vitest/ui
```

**2. Supabase Local** (para testes isolados)
```bash
npx supabase init
npx supabase start
```

**3. Testing Library** (para testes de componentes)
```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

### Configuração

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/types'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**src/tests/setup.ts:**
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup após cada teste
afterEach(() => {
  cleanup()
})

// Setup Supabase mock
beforeAll(() => {
  // Configurar Supabase local ou mock
})

afterAll(() => {
  // Cleanup global
})
```

### Dados de Teste

**src/tests/fixtures/testData.ts:**
```typescript
export const testUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com'
}

export const testAccount = {
  id: '00000000-0000-0000-0000-000000000002',
  user_id: testUser.id,
  name: 'Test Account',
  type: 'checking',
  initial_balance: 1000.00
}

export const testCategory = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Test Category',
  type: 'expense'
}
```

---

## Testes de Integração Planejados

### Test 1: Simple Transaction Flow

**Objetivo:** Validar criação de transação simples e lançamentos no ledger

**Fluxo:**
1. Criar transação de receita
2. Verificar lançamento no ledger
3. Verificar saldo da conta

**Código:**
```typescript
describe('Simple Transaction Flow', () => {
  it('should create transaction and ledger entries', async () => {
    // 1. Criar transação
    const transaction = await createTransaction({
      user_id: testUser.id,
      account_id: testAccount.id,
      amount: 100.00,
      type: 'income',
      description: 'Test Income'
    })
    
    expect(transaction).toBeDefined()
    
    // 2. Verificar lançamentos no ledger
    const ledgerEntries = await getLedgerEntries(transaction.id)
    expect(ledgerEntries).toHaveLength(2) // Debit + Credit
    
    // 3. Verificar saldo
    const balance = await getAccountBalance(testUser.id, testAccount.id)
    expect(balance).toBe(1100.00) // 1000 + 100
  })
})
```

### Test 2: Installment Transaction Flow

**Objetivo:** Validar transação parcelada

**Fluxo:**
1. Criar despesa parcelada (3x)
2. Verificar múltiplos lançamentos
3. Verificar saldo por parcela

### Test 3: Shared Transaction Flow

**Objetivo:** Validar transação compartilhada

**Fluxo:**
1. Usuário A cria despesa compartilhada
2. Usuário B aceita
3. Verificar lançamentos corretos (Receivables/Payables)
4. Verificar cash flow sem duplicação

### Test 4: Cash Flow Calculation

**Objetivo:** Validar cálculo de cash flow

**Fluxo:**
1. Criar múltiplas transações
2. Calcular cash flow
3. Verificar sem duplicação
4. Verificar valores corretos

### Test 5: Trip Management

**Objetivo:** Validar gestão de viagens

**Fluxo:**
1. Criar viagem
2. Adicionar despesas à viagem
3. Verificar separação por contexto
4. Calcular total da viagem

---

## CI/CD Integration

### GitHub Actions Workflow

**.github/workflows/test.yml:**
```yaml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup Supabase
        run: |
          npx supabase init
          npx supabase start
          npx supabase db push
      
      - name: Run tests
        run: npm run test:integration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Checkpoint 16: Validate Integration Tests

### Critérios de Sucesso

**1. Todos os Testes Passam**
- ✅ Simple transaction
- ✅ Installment transaction
- ✅ Shared transaction
- ✅ Cash flow calculation
- ✅ Trip management

**2. Cobertura de Código**
- Target: > 80% para funções críticas
- Backend RPCs: 100%
- Componentes principais: > 70%

**3. CI/CD Funcionando**
- ✅ Testes executam automaticamente
- ✅ PRs bloqueados se testes falharem
- ✅ Coverage report gerado

---

## Cronograma de Implementação

### Semana 1: Setup
- Configurar ambiente de testes
- Configurar Supabase local
- Criar fixtures de dados

### Semana 2: Testes Básicos
- Test 1: Simple transaction
- Test 2: Installment transaction
- Test 4: Cash flow

### Semana 3: Testes Avançados
- Test 3: Shared transaction
- Test 5: Trip management

### Semana 4: CI/CD
- Configurar GitHub Actions
- Configurar coverage reports
- Documentar processo

---

## Priorização

**Alta Prioridade:**
1. Simple transaction flow
2. Cash flow calculation
3. Shared transaction flow

**Média Prioridade:**
4. Installment transaction flow
5. Trip management

**Baixa Prioridade:**
6. Credit card flow
7. Reports generation

---

## Recursos Necessários

**Tempo Estimado:** 2-3 semanas  
**Desenvolvedores:** 1-2  
**Ferramentas:** Vitest, Supabase Local, GitHub Actions

---

## Benefícios

**1. Confiança em Mudanças**
- Detectar regressões automaticamente
- Validar refatorações
- Garantir qualidade

**2. Documentação Viva**
- Testes servem como exemplos
- Documentam comportamento esperado
- Facilitam onboarding

**3. Velocidade de Desenvolvimento**
- Menos bugs em produção
- Feedback rápido
- Deploy com confiança

---

## Conclusão

**Status:** 📋 PLANEJADO

A implementação de testes de integração é **recomendada** mas **não bloqueadora** para produção. O sistema está validado e funcional.

**Recomendação:** Implementar após deployment inicial de produção, como parte do processo de melhoria contínua.

---

**Documento Criado Por:** Kiro AI  
**Data:** 2024-12-24  
**Status:** Aguardando implementação pós-produção
