# Baseline Metrics - Sistema Financeiro

**Data da Análise:** ${new Date().toISOString().split('T')[0]}

## 📊 Métricas Gerais

- **Total de Arquivos:** 227
- **Total de Linhas:** 46.052
- **Complexidade Total:** 7.122
- **Complexidade Média:** 31.37

## 📁 Distribuição por Categoria

| Categoria | Arquivos | Linhas | % do Total |
|-----------|----------|--------|------------|
| Componentes (TSX) | 104 | 17.365 | 37.7% |
| Serviços/Core | 33 | 8.168 | 17.7% |
| Testes | 23 | 7.177 | 15.6% |
| Hooks | 26 | 5.992 | 13.0% |
| Utilitários | 17 | 2.856 | 6.2% |
| Tipos | 8 | 1.988 | 4.3% |
| Outros | 16 | 2.506 | 5.4% |

## 🔥 Arquivos Mais Complexos (Top 10)

1. **database.types.ts** - Complexidade: 250 | Linhas: 676
2. **financialLogic.ts** - Complexidade: 174 | Linhas: 626
3. **supabaseService.ts** - Complexidade: 170 | Linhas: 726
4. **TransactionForm.tsx** - Complexidade: 150 | Linhas: 717
5. **useDataStore.ts** - Complexidade: 144 | Linhas: 821
6. **useTransactionForm.ts** - Complexidade: 124 | Linhas: 380
7. **FinancialDataValidation.ts** - Complexidade: 124 | Linhas: 528
8. **SafeFinancialCalculations.ts** - Complexidade: 108 | Linhas: 533
9. **useTransactionStore.ts** - Complexidade: 106 | Linhas: 449
10. **ComplexityAnalyzer.ts** - Complexidade: 101 | Linhas: 406

## 🔍 Padrões Identificados

- **Interfaces Props:** 109 interfaces
- **Hooks Customizados:** 31 hooks
- **useState Declarations:** 139 declarações
- **Imports Mais Comuns:**
  - lucide-react: 86 arquivos
  - ../types: 56 arquivos
  - ../../types: 51 arquivos
  - ../../utils: 41 arquivos

## 📈 Distribuição de Complexidade

- **Baixa (≤10):** 72 arquivos (31.7%)
- **Média (11-25):** 59 arquivos (26.0%)
- **Alta (26-50):** 51 arquivos (22.5%)
- **Muito Alta (>50):** 45 arquivos (19.8%)

## 🎯 Estimativa de Redução

### Por Estratégia

1. **Consolidação de Padrões:** ~11.034 linhas
   - Hooks similares: ~2.100 linhas
   - Componentes repetitivos: ~6.078 linhas
   - Serviços duplicados: ~2.856 linhas

2. **Eliminação de Código Morto:** ~2.303 linhas
   - Imports não utilizados
   - Funções órfãs
   - Tipos duplicados

3. **Otimização de Testes:** ~500 linhas
   - Consolidação de testes redundantes
   - Otimização de mocks

### Total Estimado

- **Redução Total:** ~13.337 linhas (29.0% do código)
- **Linhas Finais:** ~32.715 linhas
- **Meta do Projeto:** 25-40% (11.000-18.000 linhas)

## 🏆 Arquivos Prioritários para Refatoração

### Fase 1: Hooks (Redução estimada: ~1.500 linhas)
- useDataStore.ts: 821 → ~500 linhas (-321)
- useTransactionForm.ts: 380 → ~250 linhas (-130)
- useTransactionStore.ts: 449 → ~300 linhas (-149)
- Outros hooks: ~900 linhas de consolidação

### Fase 2: Serviços (Redução estimada: ~800 linhas)
- supabaseService.ts: 726 → ~400 linhas (-326)
- SharedTransactionManager.ts: 486 → ~350 linhas (-136)
- Outros serviços: ~338 linhas

### Fase 3: Componentes (Redução estimada: ~1.000 linhas)
- TransactionForm.tsx: 717 → ~450 linhas (-267)
- Consolidação de Props: ~200 linhas
- Abstrações de modais: ~300 linhas
- Outros componentes: ~233 linhas

### Fase 4: Código Morto (Redução estimada: ~2.303 linhas)
- Imports não utilizados
- Funções órfãs
- Tipos duplicados

## 📊 Metas de Complexidade

- **Complexidade Média Atual:** 31.37
- **Meta Pós-Refatoração:** ~21.96 (30% de redução)
- **Arquivos Críticos (>50):** 45 → Meta: <20

## ✅ Próximos Passos

1. ✅ Análise completa realizada
2. ⏭️ Consolidação de Hooks
3. ⏭️ Abstrações de Componentes
4. ⏭️ Otimização de Serviços
5. ⏭️ Eliminação de Código Morto
6. ⏭️ Validação Final