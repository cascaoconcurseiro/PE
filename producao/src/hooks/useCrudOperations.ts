import { useCallback } from 'react';
import { supabaseService } from '../core/services/supabaseService';

interface CrudOperationsProps {
    performOperation: (
        operation: () => Promise<void>,
        successMessage?: string,
        options?: { backgroundRefresh?: boolean }
    ) => Promise<void>;
    setDataState: React.Dispatch<React.SetStateAction<any>>;
}

/**
 * Hook para operações CRUD genéricas
 * Extraído do useDataStore para reduzir duplicação
 * Fornece factory pattern para operações básicas
 */
export const useCrudOperations = ({
    performOperation,
    setDataState
}: CrudOperationsProps) => {

    // Factory para criar operação genérica
    const createOperation = useCallback(<T extends { id?: string }>(
        tableName: string,
        data: Omit<T, 'id'>,
        successMessage: string,
        stateKey?: string
    ) => {
        return performOperation(async () => {
            const id = crypto.randomUUID();
            const entityToCreate = { ...data, id } as T;
            
            await supabaseService.create(tableName, entityToCreate);
            
            // Atualização otimista se stateKey fornecido
            if (stateKey) {
                setDataState((prev: any) => ({
                    ...prev,
                    [stateKey]: [...prev[stateKey], entityToCreate]
                }));
            }
        }, successMessage);
    }, [performOperation, setDataState]);

    // Factory para atualizar operação genérica
    const updateOperation = useCallback(<T extends { id: string }>(
        tableName: string,
        data: T,
        successMessage: string,
        stateKey?: string
    ) => {
        return performOperation(async () => {
            const updatedData = { ...data, updatedAt: new Date().toISOString() };
            await supabaseService.update(tableName, updatedData);
            
            // Atualização otimista se stateKey fornecido
            if (stateKey) {
                setDataState((prev: any) => ({
                    ...prev,
                    [stateKey]: prev[stateKey].map((item: any) => 
                        item.id === data.id ? updatedData : item
                    )
                }));
            }
        }, successMessage);
    }, [performOperation, setDataState]);

    // Factory para deletar operação genérica
    const deleteOperation = useCallback((
        tableName: string,
        id: string,
        successMessage: string,
        stateKey?: string
    ) => {
        return performOperation(async () => {
            await supabaseService.delete(tableName, id);
            
            // Atualização otimista se stateKey fornecido
            if (stateKey) {
                setDataState((prev: any) => ({
                    ...prev,
                    [stateKey]: prev[stateKey].filter((item: any) => item.id !== id)
                }));
            }
        }, successMessage);
    }, [performOperation, setDataState]);

    // Operações específicas consolidadas
    const create = useCallback(<T extends { id?: string }>(
        tableName: string,
        data: Omit<T, 'id'>,
        successMessage: string
    ) => {
        const stateKey = getStateKey(tableName);
        return createOperation(tableName, data, successMessage, stateKey);
    }, [createOperation]);

    const update = useCallback(<T extends { id: string }>(
        tableName: string,
        data: T,
        successMessage: string
    ) => {
        const stateKey = getStateKey(tableName);
        return updateOperation(tableName, data, successMessage, stateKey);
    }, [updateOperation]);

    const deleteEntity = useCallback((
        tableName: string,
        id: string,
        successMessage: string
    ) => {
        const stateKey = getStateKey(tableName);
        return deleteOperation(tableName, id, successMessage, stateKey);
    }, [deleteOperation]);

    // Mapeamento de tabela para chave de estado
    const getStateKey = (tableName: string): string => {
        const mapping: { [key: string]: string } = {
            'accounts': 'accounts',
            'transactions': 'transactions',
            'trips': 'trips',
            'budgets': 'budgets',
            'goals': 'goals',
            'family_members': 'familyMembers',
            'assets': 'assets',
            'snapshots': 'snapshots',
            'custom_categories': 'customCategories'
        };
        return mapping[tableName] || tableName;
    };

    // Operações em lote
    const bulkCreate = useCallback(async <T extends { id?: string }>(
        tableName: string,
        items: Omit<T, 'id'>[],
        successMessage: string
    ) => {
        await performOperation(async () => {
            const itemsWithIds = items.map(item => ({
                ...item,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })) as T[];

            await supabaseService.bulkCreate(tableName, itemsWithIds);
            
            const stateKey = getStateKey(tableName);
            setDataState((prev: any) => ({
                ...prev,
                [stateKey]: [...prev[stateKey], ...itemsWithIds]
            }));
        }, successMessage);
    }, [performOperation, setDataState]);

    const bulkUpdate = useCallback(async <T extends { id: string }>(
        tableName: string,
        items: T[],
        successMessage: string
    ) => {
        await performOperation(async () => {
            const updatedItems = items.map(item => ({
                ...item,
                updatedAt: new Date().toISOString()
            }));

            await supabaseService.bulkCreate(tableName, updatedItems); // bulkCreate usa upsert
            
            const stateKey = getStateKey(tableName);
            setDataState((prev: any) => ({
                ...prev,
                [stateKey]: prev[stateKey].map((existing: any) => {
                    const updated = updatedItems.find(u => u.id === existing.id);
                    return updated || existing;
                })
            }));
        }, successMessage);
    }, [performOperation, setDataState]);

    const bulkDelete = useCallback(async (
        tableName: string,
        ids: string[],
        successMessage: string
    ) => {
        await performOperation(async () => {
            await supabaseService.bulkDelete(tableName, ids);
            
            const stateKey = getStateKey(tableName);
            setDataState((prev: any) => ({
                ...prev,
                [stateKey]: prev[stateKey].filter((item: any) => !ids.includes(item.id))
            }));
        }, successMessage);
    }, [performOperation, setDataState]);

    return {
        // Operações básicas
        create,
        update,
        delete: deleteEntity,
        
        // Operações em lote
        bulkCreate,
        bulkUpdate,
        bulkDelete,
        
        // Factories para casos customizados
        createOperation,
        updateOperation,
        deleteOperation
    };
};