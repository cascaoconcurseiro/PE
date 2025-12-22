/**
 * Serviço CRUD genérico para consolidar operações repetitivas
 * Substitui múltiplos métodos específicos por abstração configurável
 * Reduz ~300 linhas de métodos CRUD duplicados
 * Validates: Requirements 4.1, 4.2, 4.4
 */

import { supabase } from '../../integrations/supabase/client';
import { logger } from '../../utils/logger';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

/**
 * Schema de mapeamento para conversão entre formatos App e DB
 */
export interface MappingSchema {
    tableName: string;
    fields: Record<string, string>; // appField -> dbField
    nullableUUIDs?: string[]; // Campos UUID que podem ser null
    orderBy?: {
        field: string;
        ascending?: boolean;
    };
    relationships?: {
        [key: string]: {
            table: string;
            foreignKey: string;
            select?: string;
        };
    };
}

/**
 * Opções para operações CRUD
 */
export interface CRUDOptions {
    includeDeleted?: boolean;
    orderBy?: {
        field: string;
        ascending?: boolean;
    };
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
    data: T[];
    count: number;
    hasMore: boolean;
}

// ============================================================================
// CLASSE PRINCIPAL
// ============================================================================

/**
 * Serviço CRUD genérico que consolida operações repetitivas
 */
export class GenericCRUDService<T = any> {
    constructor(private schema: MappingSchema) {}

    // ========================================================================
    // MÉTODOS AUXILIARES
    // ========================================================================

    /**
     * Obtém o ID do usuário atual
     */
    private async getUserId(): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
        return user.id;
    }

    /**
     * Converte dados do DB (snake_case) para App (camelCase)
     */
    private mapToApp(data: unknown): T | T[] {
        if (Array.isArray(data)) return data.map(item => this.mapToApp(item)) as T[];
        if (data === null || typeof data !== 'object') return data as T;

        const newObj: Record<string, unknown> = {};
        const dataObj = data as Record<string, unknown>;
        
        for (const key in dataObj) {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            
            // Mapeamentos específicos
            if (key === 'account_id') newObj['accountId'] = dataObj[key];
            else if (key === 'destination_account_id') newObj['destinationAccountId'] = dataObj[key];
            else if (key === 'source_transaction_id') newObj['sourceTransactionId'] = dataObj[key];
            else if (key === 'trip_id') newObj['tripId'] = dataObj[key];
            else if (key === 'user_id') newObj['userId'] = dataObj[key];
            else newObj[camelKey] = dataObj[key];
        }
        
        return newObj as T;
    }

    /**
     * Converte dados do App (camelCase) para DB (snake_case)
     */
    private mapToDB(data: Record<string, unknown>, userId: string): Record<string, unknown> {
        const newObj: Record<string, unknown> = { user_id: userId };
        const { fields, nullableUUIDs = [] } = this.schema;

        for (const [appKey, dbKey] of Object.entries(fields)) {
            if (data[appKey] !== undefined) {
                let value = data[appKey];
                
                // Sanitizar: String vazia -> NULL para UUIDs
                if (typeof value === 'string' && value === '' && nullableUUIDs.includes(dbKey)) {
                    value = null;
                }
                
                newObj[dbKey] = value;
            }
        }

        return newObj;
    }

    /**
     * Constrói query base com filtros comuns
     */
    private buildBaseQuery(options: CRUDOptions = {}) {
        let query = supabase.from(this.schema.tableName).select('*');

        // Filtro por usuário (sempre aplicado)
        query = query.eq('user_id', '{{userId}}'); // Placeholder para substituição

        // Filtro de deletados
        if (!options.includeDeleted) {
            query = query.eq('deleted', false);
        }

        // Filtros customizados
        if (options.filters) {
            for (const [key, value] of Object.entries(options.filters)) {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            }
        }

        return query;
    }

    // ========================================================================
    // OPERAÇÕES CRUD
    // ========================================================================

    /**
     * Busca todos os registros
     */
    async getAll(options: CRUDOptions = {}): Promise<T[]> {
        try {
            const userId = await this.getUserId();
            let query = this.buildBaseQuery(options);
            
            // Substituir placeholder do userId
            const queryStr = query.toString().replace('{{userId}}', userId);
            query = supabase.from(this.schema.tableName).select('*')
                .eq('user_id', userId);

            if (!options.includeDeleted) {
                query = query.eq('deleted', false);
            }

            // Aplicar filtros
            if (options.filters) {
                for (const [key, value] of Object.entries(options.filters)) {
                    if (value !== undefined && value !== null) {
                        query = query.eq(key, value);
                    }
                }
            }

            // Ordenação
            const orderBy = options.orderBy || this.schema.orderBy;
            if (orderBy) {
                query = query.order(orderBy.field, { ascending: orderBy.ascending ?? true });
            } else {
                // Ordenação padrão
                if (this.schema.tableName === 'transactions' || this.schema.tableName === 'snapshots') {
                    query = query.order('date', { ascending: false });
                } else {
                    query = query.order('created_at', { ascending: true });
                }
            }

            // Paginação
            if (options.limit) {
                query = query.limit(options.limit);
                if (options.offset) {
                    query = query.range(options.offset, options.offset + options.limit - 1);
                }
            }

            const { data, error } = await query;

            if (error) {
                logger.error(`CRUD fetch error on ${this.schema.tableName}`, error);
                if (error.code === '42703') { // Coluna indefinida
                    logger.warn(`Column missing in ${this.schema.tableName}. DB Schema might need update.`);
                    return [];
                }
                throw error;
            }

            return this.mapToApp(data) as T[];
        } catch (error) {
            logger.error(`Error in getAll for ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Busca registros com paginação
     */
    async getPaginated(page: number = 1, pageSize: number = 50, options: CRUDOptions = {}): Promise<PaginatedResult<T>> {
        try {
            const userId = await this.getUserId();
            const offset = (page - 1) * pageSize;

            // Query para dados
            let dataQuery = supabase.from(this.schema.tableName).select('*')
                .eq('user_id', userId);

            // Query para contagem
            let countQuery = supabase.from(this.schema.tableName).select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (!options.includeDeleted) {
                dataQuery = dataQuery.eq('deleted', false);
                countQuery = countQuery.eq('deleted', false);
            }

            // Aplicar filtros
            if (options.filters) {
                for (const [key, value] of Object.entries(options.filters)) {
                    if (value !== undefined && value !== null) {
                        dataQuery = dataQuery.eq(key, value);
                        countQuery = countQuery.eq(key, value);
                    }
                }
            }

            // Ordenação e paginação
            const orderBy = options.orderBy || this.schema.orderBy;
            if (orderBy) {
                dataQuery = dataQuery.order(orderBy.field, { ascending: orderBy.ascending ?? true });
            }

            dataQuery = dataQuery.range(offset, offset + pageSize - 1);

            const [{ data, error: dataError }, { count, error: countError }] = await Promise.all([
                dataQuery,
                countQuery
            ]);

            if (dataError) throw dataError;
            if (countError) throw countError;

            return {
                data: this.mapToApp(data) as T[],
                count: count || 0,
                hasMore: offset + pageSize < (count || 0)
            };
        } catch (error) {
            logger.error(`Error in getPaginated for ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Busca por ID
     */
    async getById(id: string): Promise<T | null> {
        try {
            const userId = await this.getUserId();
            
            const { data, error } = await supabase
                .from(this.schema.tableName)
                .select('*')
                .eq('user_id', userId)
                .eq('id', id)
                .eq('deleted', false)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw error;
            }

            return this.mapToApp(data) as T;
        } catch (error) {
            logger.error(`Error in getById for ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Cria novo registro
     */
    async create(item: Omit<T, 'id'> & Record<string, any>): Promise<string> {
        try {
            const userId = await this.getUserId();
            const dbData = this.mapToDB(item, userId);

            const { data, error } = await supabase
                .from(this.schema.tableName)
                .insert(dbData)
                .select('id')
                .single();

            if (error) throw error;

            logger.info(`Created ${this.schema.tableName} with ID: ${data.id}`);
            return data.id;
        } catch (error) {
            logger.error(`Error creating ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Atualiza registro existente
     */
    async update(id: string, updates: Partial<T> & Record<string, any>): Promise<void> {
        try {
            const userId = await this.getUserId();
            const dbData = this.mapToDB(updates, userId);
            
            // Remove user_id do update (não deve ser alterado)
            delete dbData.user_id;
            
            // Adiciona timestamp de atualização
            dbData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from(this.schema.tableName)
                .update(dbData)
                .eq('user_id', userId)
                .eq('id', id);

            if (error) throw error;

            logger.info(`Updated ${this.schema.tableName} with ID: ${id}`);
        } catch (error) {
            logger.error(`Error updating ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Deleta registro (soft delete)
     */
    async delete(id: string): Promise<void> {
        try {
            const userId = await this.getUserId();

            const { error } = await supabase
                .from(this.schema.tableName)
                .update({ 
                    deleted: true, 
                    updated_at: new Date().toISOString() 
                })
                .eq('user_id', userId)
                .eq('id', id);

            if (error) throw error;

            logger.info(`Soft deleted ${this.schema.tableName} with ID: ${id}`);
        } catch (error) {
            logger.error(`Error deleting ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Deleta registro permanentemente
     */
    async hardDelete(id: string): Promise<void> {
        try {
            const userId = await this.getUserId();

            const { error } = await supabase
                .from(this.schema.tableName)
                .delete()
                .eq('user_id', userId)
                .eq('id', id);

            if (error) throw error;

            logger.info(`Hard deleted ${this.schema.tableName} with ID: ${id}`);
        } catch (error) {
            logger.error(`Error hard deleting ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Criação em lote
     */
    async bulkCreate(items: Array<Omit<T, 'id'> & Record<string, any>>): Promise<string[]> {
        try {
            const userId = await this.getUserId();
            const dbItems = items.map(item => this.mapToDB(item, userId));

            const { data, error } = await supabase
                .from(this.schema.tableName)
                .insert(dbItems)
                .select('id');

            if (error) throw error;

            const ids = data.map(item => item.id);
            logger.info(`Bulk created ${ids.length} ${this.schema.tableName} records`);
            return ids;
        } catch (error) {
            logger.error(`Error bulk creating ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Atualização em lote
     */
    async bulkUpdate(updates: Array<{ id: string } & Partial<T> & Record<string, any>>): Promise<void> {
        try {
            const userId = await this.getUserId();
            
            // Supabase não suporta bulk update diretamente, fazemos sequencialmente
            const promises = updates.map(update => {
                const { id, ...data } = update;
                return this.update(id, data);
            });

            await Promise.all(promises);
            logger.info(`Bulk updated ${updates.length} ${this.schema.tableName} records`);
        } catch (error) {
            logger.error(`Error bulk updating ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Busca com filtros customizados
     */
    async findWhere(filters: Record<string, any>, options: CRUDOptions = {}): Promise<T[]> {
        return this.getAll({
            ...options,
            filters: { ...options.filters, ...filters }
        });
    }

    /**
     * Conta registros
     */
    async count(filters?: Record<string, any>): Promise<number> {
        try {
            const userId = await this.getUserId();
            
            let query = supabase
                .from(this.schema.tableName)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('deleted', false);

            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null) {
                        query = query.eq(key, value);
                    }
                }
            }

            const { count, error } = await query;

            if (error) throw error;
            return count || 0;
        } catch (error) {
            logger.error(`Error counting ${this.schema.tableName}`, error);
            throw error;
        }
    }

    /**
     * Verifica se registro existe
     */
    async exists(id: string): Promise<boolean> {
        try {
            const item = await this.getById(id);
            return item !== null;
        } catch (error) {
            logger.error(`Error checking existence in ${this.schema.tableName}`, error);
            return false;
        }
    }
}

// ============================================================================
// FACTORY E SCHEMAS PRÉ-DEFINIDOS
// ============================================================================

/**
 * Factory para criar instâncias do serviço CRUD
 */
export class CRUDServiceFactory {
    private static instances = new Map<string, GenericCRUDService>();

    static create<T>(schema: MappingSchema): GenericCRUDService<T> {
        const key = schema.tableName;
        
        if (!this.instances.has(key)) {
            this.instances.set(key, new GenericCRUDService<T>(schema));
        }
        
        return this.instances.get(key) as GenericCRUDService<T>;
    }

    static clearCache(): void {
        this.instances.clear();
    }
}

// ============================================================================
// SCHEMAS COMUNS
// ============================================================================

export const CommonSchemas = {
    accounts: {
        tableName: 'accounts',
        fields: {
            id: 'id',
            name: 'name',
            type: 'type',
            balance: 'balance',
            initialBalance: 'initial_balance',
            currency: 'currency',
            isInternational: 'is_international',
            limit: 'credit_limit',
            closingDay: 'closing_day',
            dueDay: 'due_day',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deleted: 'deleted'
        },
        nullableUUIDs: [],
        orderBy: { field: 'name', ascending: true }
    } as MappingSchema,

    trips: {
        tableName: 'trips',
        fields: {
            id: 'id',
            name: 'name',
            startDate: 'start_date',
            endDate: 'end_date',
            currency: 'currency',
            budget: 'budget',
            imageUrl: 'image_url',
            participants: 'participants',
            itinerary: 'itinerary',
            checklist: 'checklist',
            shoppingList: 'shopping_list',
            exchangeEntries: 'exchange_entries',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deleted: 'deleted'
        },
        nullableUUIDs: [],
        orderBy: { field: 'start_date', ascending: false }
    } as MappingSchema,

    familyMembers: {
        tableName: 'family_members',
        fields: {
            id: 'id',
            name: 'name',
            email: 'email',
            role: 'role',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deleted: 'deleted'
        },
        nullableUUIDs: [],
        orderBy: { field: 'name', ascending: true }
    } as MappingSchema,

    customCategories: {
        tableName: 'custom_categories',
        fields: {
            id: 'id',
            name: 'name',
            icon: 'icon',
            color: 'color',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deleted: 'deleted'
        },
        nullableUUIDs: [],
        orderBy: { field: 'name', ascending: true }
    } as MappingSchema
};

// ============================================================================
// INSTÂNCIAS PRÉ-CONFIGURADAS
// ============================================================================

export const accountsCRUD = CRUDServiceFactory.create(CommonSchemas.accounts);
export const tripsCRUD = CRUDServiceFactory.create(CommonSchemas.trips);
export const familyMembersCRUD = CRUDServiceFactory.create(CommonSchemas.familyMembers);
export const customCategoriesCRUD = CRUDServiceFactory.create(CommonSchemas.customCategories);