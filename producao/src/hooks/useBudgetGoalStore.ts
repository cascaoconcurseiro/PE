/**
 * Hook para gerenciamento de orçamentos e metas
 * Extraído do useDataStore para melhor separação de responsabilidades
 */

import { useState, useCallback } from 'react';
import { Budget, Goal } from '../types';
import { supabaseService } from '../core/services/supabaseService';
import { logger } from '../services/logger';

interface UseBudgetGoalStoreProps {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    isOnline: boolean;
}

export const useBudgetGoalStore = ({ onSuccess, onError, isOnline }: UseBudgetGoalStoreProps) => {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // ========== BUDGETS ==========

    const fetchBudgets = useCallback(async () => {
        try {
            const data = await supabaseService.getBudgets();
            setBudgets(data);
            return data;
        } catch (error) {
            logger.error('Erro ao carregar orçamentos', error);
            throw error;
        }
    }, []);

    const addBudget = useCallback(async (budget: Omit<Budget, 'id'>) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.create('budgets', { id: crypto.randomUUID(), ...budget });
            await fetchBudgets();
            onSuccess('Orçamento salvo!');
        } catch (error) {
            logger.error('Erro ao criar orçamento', error);
            onError((error as Error).message || 'Erro ao criar orçamento');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, fetchBudgets, onSuccess, onError]);

    const updateBudget = useCallback(async (budget: Budget) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.update('budgets', budget);
            setBudgets(prev => prev.map(b => b.id === budget.id ? budget : b));
            onSuccess('Orçamento atualizado!');
        } catch (error) {
            logger.error('Erro ao atualizar orçamento', error);
            onError((error as Error).message || 'Erro ao atualizar orçamento');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const deleteBudget = useCallback(async (id: string) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.delete('budgets', id);
            setBudgets(prev => prev.filter(b => b.id !== id));
            onSuccess('Orçamento removido.');
        } catch (error) {
            logger.error('Erro ao remover orçamento', error);
            onError((error as Error).message || 'Erro ao remover orçamento');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    // ========== GOALS ==========

    const fetchGoals = useCallback(async () => {
        try {
            const data = await supabaseService.getGoals();
            setGoals(data);
            return data;
        } catch (error) {
            logger.error('Erro ao carregar metas', error);
            throw error;
        }
    }, []);

    const addGoal = useCallback(async (goal: Omit<Goal, 'id'>) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.create('goals', { id: crypto.randomUUID(), ...goal });
            await fetchGoals();
            onSuccess('Meta criada!');
        } catch (error) {
            logger.error('Erro ao criar meta', error);
            onError((error as Error).message || 'Erro ao criar meta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, fetchGoals, onSuccess, onError]);

    const updateGoal = useCallback(async (goal: Goal) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.update('goals', goal);
            setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
            onSuccess('Meta atualizada!');
        } catch (error) {
            logger.error('Erro ao atualizar meta', error);
            onError((error as Error).message || 'Erro ao atualizar meta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const deleteGoal = useCallback(async (id: string) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.delete('goals', id);
            setGoals(prev => prev.filter(g => g.id !== id));
            onSuccess('Meta excluída.');
        } catch (error) {
            logger.error('Erro ao excluir meta', error);
            onError((error as Error).message || 'Erro ao excluir meta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    return {
        // Budgets
        budgets,
        setBudgets,
        fetchBudgets,
        addBudget,
        updateBudget,
        deleteBudget,

        // Goals
        goals,
        setGoals,
        fetchGoals,
        addGoal,
        updateGoal,
        deleteGoal,

        isLoading
    };
};
