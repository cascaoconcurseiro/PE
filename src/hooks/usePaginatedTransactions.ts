/**
 * Hook para gerenciar transações paginadas
 * 
 * Fornece interface React para o PaginationService com
 * gerenciamento de estado, cache e loading.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction } from '../types';
import { 
  paginationService, 
  PaginationConfig, 
  PaginatedResult,
  PaginationMetadata 
} from '../services/paginationService';
import { financialCache, CacheKeys, CacheTTL } from '../services/cacheService';
import { logger } from '../utils/logger';

interface UsePaginatedTransactionsOptions {
  initialPage?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  enableCache?: boolean;
  autoLoad?: boolean;
}

interface UsePaginatedTransactionsResult {
  transactions: Transaction[];
  pagination: PaginationMetadata | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  refresh: () => Promise<void>;
  setFilters: (filters: Record<string, any>) => void;
  setSort: (field: string, direction: 'asc' | 'desc') => void;
  
  // Utilities
  hasMore: boolean;
  canGoBack: boolean;
  totalPages: number;
  currentPage: number;
}

export const usePaginatedTransactions = (
  userId: string,
  options: UsePaginatedTransactionsOptions = {}
): UsePaginatedTransactionsResult => {
  const {
    initialPage = 1,
    pageSize = 50,
    sortField = 'date',
    sortDirection = 'desc',
    filters: initialFilters = {},
    enableCache = true,
    autoLoad = true
  } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filters, setFiltersState] = useState(initialFilters);
  const [sort, setSortState] = useState({ field: sortField, direction: sortDirection });

  // Prevent duplicate requests
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Carrega página de transações
   */
  const loadPage = useCallback(async (page: number) => {
    // Prevent duplicate requests
    if (loadingRef.current) {
      logger.debug('Skipping duplicate pagination request');
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const config: Partial<PaginationConfig> = {
        pageSize,
        sortField: sort.field,
        sortDirection: sort.direction,
        filters
      };

      // Check cache first
      const cacheKey = `transactions_${userId}_p${page}_${JSON.stringify(config)}`;
      
      if (enableCache) {
        const cached = financialCache.get<PaginatedResult<Transaction>>(cacheKey);
        if (cached) {
          logger.debug('Using cached paginated transactions', { page, cacheKey });
          setTransactions(cached.data);
          setPagination(cached.pagination);
          setCurrentPage(page);
          setLoading(false);
          loadingRef.current = false;
          return;
        }
      }

      // Fetch from service
      const result = await paginationService.getTransactionsPaginated(
        userId,
        page,
        config
      );

      // Cache result
      if (enableCache) {
        financialCache.set(cacheKey, result, CacheTTL.MEDIUM);
      }

      setTransactions(result.data);
      setPagination(result.pagination);
      setCurrentPage(page);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.debug('Pagination request aborted');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar transações';
      logger.error('Failed to load paginated transactions', err);
      setError(errorMessage);
      setTransactions([]);
      setPagination(null);

    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [userId, pageSize, sort, filters, enableCache]);

  /**
   * Navega para próxima página
   */
  const nextPage = useCallback(async () => {
    if (pagination?.hasNext) {
      await loadPage(currentPage + 1);
    }
  }, [pagination, currentPage, loadPage]);

  /**
   * Navega para página anterior
   */
  const previousPage = useCallback(async () => {
    if (pagination?.hasPrevious) {
      await loadPage(currentPage - 1);
    }
  }, [pagination, currentPage, loadPage]);

  /**
   * Recarrega página atual
   */
  const refresh = useCallback(async () => {
    // Invalidate cache
    if (enableCache) {
      financialCache.invalidateByPrefix(`transactions_${userId}`);
    }
    await loadPage(currentPage);
  }, [currentPage, loadPage, userId, enableCache]);

  /**
   * Atualiza filtros e recarrega primeira página
   */
  const setFilters = useCallback((newFilters: Record<string, any>) => {
    setFiltersState(newFilters);
    setCurrentPage(1);
  }, []);

  /**
   * Atualiza ordenação e recarrega primeira página
   */
  const setSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortState({ field, direction });
    setCurrentPage(1);
  }, []);

  // Auto-load on mount or when dependencies change
  useEffect(() => {
    if (autoLoad && userId) {
      loadPage(currentPage);
    }
  }, [userId, currentPage, filters, sort, autoLoad, loadPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    transactions,
    pagination,
    loading,
    error,
    
    loadPage,
    nextPage,
    previousPage,
    refresh,
    setFilters,
    setSort,
    
    hasMore: pagination?.hasNext || false,
    canGoBack: pagination?.hasPrevious || false,
    totalPages: pagination?.totalPages || 0,
    currentPage
  };
};

/**
 * Hook especializado para transações de conta
 */
export const usePaginatedAccountTransactions = (
  accountId: string,
  options: UsePaginatedTransactionsOptions = {}
) => {
  const enhancedOptions = {
    ...options,
    filters: {
      ...options.filters,
      accountId
    }
  };

  return usePaginatedTransactions(accountId, enhancedOptions);
};

/**
 * Hook especializado para transações de viagem
 */
export const usePaginatedTripTransactions = (
  tripId: string,
  options: UsePaginatedTransactionsOptions = {}
) => {
  const enhancedOptions = {
    ...options,
    filters: {
      ...options.filters,
      tripId
    }
  };

  return usePaginatedTransactions(tripId, enhancedOptions);
};