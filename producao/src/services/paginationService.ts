/**
 * Serviço de Paginação Inteligente
 * 
 * Implementa carregamento eficiente de dados com suporte a filtros,
 * ordenação e metadados de navegação para otimizar performance.
 */

import { supabase } from '../integrations/supabase/client';
import { Transaction, Account } from '../types';
import { logger } from '../utils/logger';

export interface PaginationConfig {
  pageSize: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
  pageSize: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  cacheKey: string;
  generatedAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}

class PaginationService {
  private readonly DEFAULT_PAGE_SIZE = 50;
  private readonly MAX_PAGE_SIZE = 200;

  /**
   * Busca transações com paginação otimizada
   */
  async getTransactionsPaginated(
    userId: string,
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const pageSize = Math.min(config.pageSize || this.DEFAULT_PAGE_SIZE, this.MAX_PAGE_SIZE);
    const sortField = config.sortField || 'date';
    const sortDirection = config.sortDirection || 'desc';
    const offset = (page - 1) * pageSize;

    try {
      // Build base query
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('deleted', false);

      // Apply filters
      if (config.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (key === 'dateFrom') {
              query = query.gte('date', value);
            } else if (key === 'dateTo') {
              query = query.lte('date', value);
            } else if (key === 'accountId') {
              query = query.eq('account_id', value);
            } else if (key === 'type') {
              query = query.eq('type', value);
            } else if (key === 'category') {
              query = query.eq('category', value);
            } else if (key === 'tripId') {
              query = query.eq('trip_id', value);
            } else if (key === 'isShared') {
              query = query.eq('is_shared', value);
            } else if (key === 'search') {
              // Full-text search on description
              query = query.ilike('description', `%${value}%`);
            }
          }
        });
      }

      // Apply sorting and pagination
      query = query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching paginated transactions', error);
        throw error;
      }

      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / pageSize);
      const cacheKey = this.generateCacheKey('transactions', userId, page, config);

      const pagination: PaginationMetadata = {
        currentPage: page,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        pageSize,
        sortField,
        sortDirection,
        cacheKey,
        generatedAt: new Date()
      };

      return {
        data: data || [],
        pagination
      };

    } catch (error) {
      logger.error('Failed to fetch paginated transactions', error);
      throw error;
    }
  }

  /**
   * Busca transações de uma conta específica com paginação
   */
  async getAccountTransactions(
    accountId: string,
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const userId = await this.getCurrentUserId();
    
    const enhancedConfig = {
      ...config,
      filters: {
        ...config.filters,
        accountId
      }
    };

    return this.getTransactionsPaginated(userId, page, enhancedConfig);
  }

  /**
   * Busca transações de uma viagem com paginação
   */
  async getTripTransactions(
    tripId: string,
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const userId = await this.getCurrentUserId();
    
    const enhancedConfig = {
      ...config,
      filters: {
        ...config.filters,
        tripId
      }
    };

    return this.getTransactionsPaginated(userId, page, enhancedConfig);
  }

  /**
   * Busca transações compartilhadas com paginação
   */
  async getSharedTransactions(
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const userId = await this.getCurrentUserId();
    
    const enhancedConfig = {
      ...config,
      filters: {
        ...config.filters,
        isShared: true
      }
    };

    return this.getTransactionsPaginated(userId, page, enhancedConfig);
  }

  /**
   * Busca transações por período com paginação otimizada
   */
  async getTransactionsByDateRange(
    startDate: string,
    endDate: string,
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const userId = await this.getCurrentUserId();
    
    const enhancedConfig = {
      ...config,
      filters: {
        ...config.filters,
        dateFrom: startDate,
        dateTo: endDate
      }
    };

    return this.getTransactionsPaginated(userId, page, enhancedConfig);
  }

  /**
   * Busca com texto livre (search)
   */
  async searchTransactions(
    searchTerm: string,
    page: number = 1,
    config: Partial<PaginationConfig> = {}
  ): Promise<PaginatedResult<Transaction>> {
    const userId = await this.getCurrentUserId();
    
    const enhancedConfig = {
      ...config,
      filters: {
        ...config.filters,
        search: searchTerm
      }
    };

    return this.getTransactionsPaginated(userId, page, enhancedConfig);
  }

  /**
   * Gera chave de cache única para a consulta
   */
  private generateCacheKey(
    type: string,
    userId: string,
    page: number,
    config: Partial<PaginationConfig>
  ): string {
    // Criar um objeto com todos os parâmetros relevantes, incluindo valores undefined
    const keyData = {
      type,
      userId,
      page,
      pageSize: config.pageSize || this.DEFAULT_PAGE_SIZE,
      sortField: config.sortField || 'date',
      sortDirection: config.sortDirection || 'desc',
      // Serializar filtros de forma mais robusta
      filters: JSON.stringify(config.filters || {}, Object.keys(config.filters || {}).sort())
    };
    
    // Serializar de forma determinística
    const configStr = JSON.stringify(keyData, Object.keys(keyData).sort());
    
    // Criar hash mais robusto
    const hash = btoa(configStr).replace(/[^a-zA-Z0-9]/g, '');
    return `${type}_${userId}_p${page}_${hash}`;
  }

  /**
   * Obtém ID do usuário atual
   */
  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  /**
   * Calcula estatísticas de paginação para otimização
   */
  getOptimalPageSize(totalItems: number, targetLoadTime: number = 1000): number {
    // Heurística: ajustar tamanho da página baseado no total de itens
    if (totalItems < 100) return 25;
    if (totalItems < 500) return 50;
    if (totalItems < 2000) return 75;
    return 100;
  }

  /**
   * Valida configuração de paginação
   */
  validateConfig(config: Partial<PaginationConfig>, page?: number): void {
    if (config.pageSize !== undefined && (config.pageSize < 1 || config.pageSize > this.MAX_PAGE_SIZE)) {
      throw new Error(`Page size must be between 1 and ${this.MAX_PAGE_SIZE}`);
    }

    if (page !== undefined && page < 1) {
      throw new Error('Page must be greater than 0');
    }

    if (config.sortDirection && !['asc', 'desc'].includes(config.sortDirection)) {
      throw new Error('Sort direction must be "asc" or "desc"');
    }

    const validSortFields = ['date', 'amount', 'description', 'category', 'created_at'];
    if (config.sortField && !validSortFields.includes(config.sortField)) {
      throw new Error(`Sort field must be one of: ${validSortFields.join(', ')}`);
    }
  }
}

// Export singleton instance
export const paginationService = new PaginationService();