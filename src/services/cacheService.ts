/**
 * Serviço de Cache para Dados Financeiros
 *
 * Implementa cache em memória com TTL para otimizar performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class FinancialCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Obtém valor do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Define valor no cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Remove valor do cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalida cache por prefixo
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtém ou calcula valor (cache-aside pattern)
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await computeFn();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Obtém ou calcula valor síncrono
   */
  getOrComputeSync<T>(
    key: string,
    computeFn: () => T,
    ttl: number = this.DEFAULT_TTL
  ): T {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = computeFn();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Instância singleton
export const financialCache = new FinancialCache();

// Chaves de cache padronizadas
export const CacheKeys = {
  ACCOUNTS: 'accounts',
  TRANSACTIONS: (period: string) => `transactions:${period}`,
  BALANCES: 'balances',
  PROJECTIONS: (date: string) => `projections:${date}`,
  TRIP_DEBTS: (tripId: string) => `trip_debts:${tripId}`,
  MONTHLY_CASHFLOW: (year: number) => `cashflow:${year}`,
} as const;

// TTLs específicos
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minuto
  MEDIUM: 5 * 60 * 1000, // 5 minutos
  LONG: 15 * 60 * 1000, // 15 minutos
  VERY_LONG: 60 * 60 * 1000, // 1 hora
} as const;
