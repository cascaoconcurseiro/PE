# Design Document: Dashboard Smooth Transitions

## Overview

Este documento descreve o design técnico para eliminar atrasos e melhorar a fluidez das transições no dashboard financeiro. As principais mudanças incluem:

1. Remover debounce desnecessário que causa atraso de 100ms
2. Implementar transições coordenadas entre componentes
3. Otimizar cache para carregamento instantâneo
4. Melhorar feedback visual durante transições

## Architecture

### Current Problems

**Problema 1: Debounce Desnecessário**
- `useOptimizedFinancialDashboard` usa `useDebounce(currentDate, 100)` que adiciona 100ms de atraso
- Isso faz o fluxo de caixa demorar para atualizar ao mudar de mês

**Problema 2: Transições Não Coordenadas**
- `SmoothMonthSelector` tem seu próprio delay de 150ms
- `startTransition` no hook adiciona mais atraso
- Múltiplos componentes atualizam em momentos diferentes causando "piscar"

**Problema 3: Cache Ineficiente**
- Cache usa `JSON.stringify` para gerar chaves, que é lento
- Não há estratégia de invalidação inteligente
- Cache pode crescer indefinidamente

### Proposed Solution

**Solução 1: Remover Debounce, Usar Transições React**
- Remover `useDebounce` do hook
- Usar `useDeferredValue` do React 18 para priorizar atualizações críticas
- Manter UI responsiva enquanto cálculos pesados acontecem em background

**Solução 2: Estado de Transição Global**
- Criar contexto de transição compartilhado
- Coordenar todas as atualizações através de um único estado
- Garantir que todos os componentes transicionem juntos

**Solução 3: Cache Otimizado**
- Usar chaves de cache simples (strings concatenadas)
- Implementar LRU (Least Recently Used) para limpeza automática
- Pré-calcular meses adjacentes para navegação instantânea

## Components and Interfaces

### 1. TransitionContext

Contexto React para coordenar transições globais:

```typescript
interface TransitionState {
  isTransitioning: boolean;
  currentMonth: string; // "YYYY-MM"
  previousData: DashboardData | null;
}

interface TransitionContextValue {
  state: TransitionState;
  startTransition: (newMonth: Date) => void;
  endTransition: () => void;
}
```

### 2. Optimized useFinancialDashboard Hook

Hook refatorado sem debounce:

```typescript
interface UseFinancialDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  trips?: Trip[];
  projectedAccounts?: Account[];
  currentDate: Date;
  spendingView: 'CATEGORY' | 'SOURCE';
}

interface DashboardData {
  currentBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  healthStatus: HealthStatus;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  cashFlowData: CashFlowDataItem[];
  hasCashFlowData: boolean;
  incomeSparkline: number[];
  expenseSparkline: number[];
  upcomingBills: Transaction[];
  spendingChartData: SpendingChartItem[];
}

function useFinancialDashboard(props: UseFinancialDashboardProps): {
  data: DashboardData;
  isCalculating: boolean;
}
```

### 3. LRU Cache Implementation

Cache com limite de tamanho e remoção automática:

```typescript
class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  
  constructor(maxSize: number);
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  clear(): void;
}
```

### 4. Smooth Month Selector (Refactored)

Seletor sem delays artificiais:

```typescript
interface SmoothMonthSelectorProps {
  currentDate: Date;
  onMonthChange: (newDate: Date) => void;
  isTransitioning: boolean;
}
```

## Data Models

### Cache Key Structure

```typescript
type CacheKey = string; // Format: "calculation_type:YYYY-MM:hash"

// Examples:
// "projection:2024-12:abc123"
// "cashflow:2024-12:def456"
// "spending:2024-12:category:ghi789"
```

### Dashboard Data Structure

```typescript
interface DashboardData {
  // Critical data (calculated first)
  currentBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  monthlyIncome: number;
  monthlyExpense: number;
  healthStatus: HealthStatus;
  
  // Secondary data (calculated in background)
  netWorth: number;
  cashFlowData: CashFlowDataItem[];
  hasCashFlowData: boolean;
  incomeSparkline: number[];
  expenseSparkline: number[];
  upcomingBills: Transaction[];
  spendingChartData: SpendingChartItem[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Response Time Under Threshold

*For any* month change operation, the time from user action to data update should be less than 100ms for critical data (balance, projection).

**Validates: Requirements 1.1**

### Property 2: Correct Month Data Loading

*For any* month selected through the date input, the dashboard should load and display data corresponding exactly to that month.

**Validates: Requirements 1.3**

### Property 3: Data Persistence During Loading

*For any* calculation in progress, the previous month's data should remain visible in the UI until new data is ready.

**Validates: Requirements 1.4, 5.2**

### Property 4: Single Loading State

*For any* dashboard update, only one global loading state should be active at a time to prevent multiple flashes.

**Validates: Requirements 2.3**

### Property 5: Click Debouncing

*For any* sequence of rapid month changes, only the last requested month should trigger a calculation.

**Validates: Requirements 2.4, 5.4**

### Property 6: Cache Hit on Revisit

*For any* previously visited month, returning to that month should retrieve data from cache without recalculation.

**Validates: Requirements 3.1, 3.4**

### Property 7: Calculation Priority

*For any* dashboard update, critical calculations (balance, projection) should complete before secondary calculations (charts, sparklines).

**Validates: Requirements 3.2**

### Property 8: Cache Size Limit

*For any* number of month navigations, the cache size should never exceed the configured maximum (e.g., 20 entries).

**Validates: Requirements 3.3**

### Property 9: Component-Specific Loading

*For any* calculation in progress, loading overlays should only appear on components whose data is being recalculated.

**Validates: Requirements 4.3**

### Property 10: Consistent Month Across Components

*For any* month change, all dashboard components should display data from the same month simultaneously.

**Validates: Requirements 5.1**

### Property 11: Error Handling Preserves Data

*For any* calculation error, the dashboard should maintain previous data and not display undefined or null values.

**Validates: Requirements 5.3**

## Error Handling

### Calculation Errors

- Wrap all calculations in try-catch blocks
- Use `SafeFinancialCalculator` for numeric operations
- Return previous data on error
- Log errors for debugging

### Cache Errors

- Handle cache misses gracefully
- Recalculate if cache is corrupted
- Clear cache on critical errors

### Transition Errors

- Reset transition state if stuck
- Timeout mechanism (max 5 seconds)
- Fallback to immediate update

## Testing Strategy

### Unit Tests

1. **LRU Cache Tests**
   - Test cache hit/miss behavior
   - Test size limit enforcement
   - Test LRU eviction order

2. **Cache Key Generation**
   - Test key uniqueness
   - Test key consistency

3. **Transition State Management**
   - Test state transitions
   - Test concurrent updates

### Property-Based Tests

Each property test should run minimum 100 iterations and reference its design property.

1. **Property 1: Response Time**
   - Generate random month changes
   - Measure time to first render
   - Assert < 100ms for critical data
   - **Feature: dashboard-smooth-transitions, Property 1: Response Time Under Threshold**

2. **Property 2: Correct Month Data**
   - Generate random months
   - Verify loaded data matches selected month
   - **Feature: dashboard-smooth-transitions, Property 2: Correct Month Data Loading**

3. **Property 3: Data Persistence**
   - Trigger calculations
   - Verify old data remains during loading
   - **Feature: dashboard-smooth-transitions, Property 3: Data Persistence During Loading**

4. **Property 5: Click Debouncing**
   - Generate rapid click sequences
   - Verify only last click processes
   - **Feature: dashboard-smooth-transitions, Property 5: Click Debouncing**

5. **Property 6: Cache Hit**
   - Navigate to month A, then B, then back to A
   - Verify second visit to A uses cache
   - **Feature: dashboard-smooth-transitions, Property 6: Cache Hit on Revisit**

6. **Property 7: Calculation Priority**
   - Monitor calculation order
   - Verify critical calculations complete first
   - **Feature: dashboard-smooth-transitions, Property 7: Calculation Priority**

7. **Property 8: Cache Size**
   - Navigate through many months
   - Verify cache never exceeds limit
   - **Feature: dashboard-smooth-transitions, Property 8: Cache Size Limit**

8. **Property 10: Consistent Month**
   - Change month
   - Verify all components show same month
   - **Feature: dashboard-smooth-transitions, Property 10: Consistent Month Across Components**

9. **Property 11: Error Handling**
   - Inject calculation errors
   - Verify previous data preserved
   - **Feature: dashboard-smooth-transitions, Property 11: Error Handling Preserves Data**

### Integration Tests

1. **Full Dashboard Flow**
   - Load dashboard
   - Navigate between months
   - Verify smooth transitions
   - Check data consistency

2. **Cache Performance**
   - Navigate through 50 months
   - Measure cache hit rate
   - Verify performance improvement

### Example Tests

1. **Transition CSS Classes**
   - Verify fade transition classes present
   - **Validates: Requirements 2.2**

2. **Loading State Display**
   - Verify loading indicator appears during transition
   - **Validates: Requirements 4.2, 4.4**

## Implementation Notes

### Performance Considerations

1. **Avoid JSON.stringify for Cache Keys**
   - Use simple string concatenation
   - Pre-compute hash for complex objects

2. **Memoization Strategy**
   - Use `useMemo` for expensive calculations
   - Use `useDeferredValue` for non-critical updates
   - Avoid unnecessary re-renders

3. **Prefetching**
   - Pre-calculate adjacent months (prev/next)
   - Load in background during idle time

### Accessibility

- Maintain keyboard navigation
- Announce month changes to screen readers
- Ensure loading states are announced

### Browser Compatibility

- Use React 18 features (useDeferredValue)
- Fallback for older browsers
- Test on mobile devices

## Migration Strategy

1. **Phase 1: Remove Debounce**
   - Remove `useDebounce` from hook
   - Test immediate updates

2. **Phase 2: Implement LRU Cache**
   - Replace Map with LRU cache
   - Verify cache behavior

3. **Phase 3: Add Transition Context**
   - Create context
   - Integrate with components

4. **Phase 4: Optimize Month Selector**
   - Remove artificial delays
   - Add transition coordination

5. **Phase 5: Testing & Refinement**
   - Run property tests
   - Measure performance
   - Fine-tune transitions
