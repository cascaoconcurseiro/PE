/**
 * useSmartNotifications - Hook que gera notificações inteligentes
 * baseadas nas configurações do usuário
 * 
 * Tipos de notificações:
 * - BILL_REMINDER: Contas a vencer (baseado em reminderDaysBefore)
 * - BUDGET_ALERT: Orçamento excedido ou próximo do limite
 * - GOAL_REMINDER: Progresso de metas
 */

import { useMemo } from 'react';
import { Transaction, TransactionType, Budget, Goal, Account } from '../types';
import { NotificationSettings } from '../types/UserSettings';

export interface SmartNotification {
    id: string;
    type: 'BILL_REMINDER' | 'BUDGET_ALERT' | 'GOAL_REMINDER';
    title: string;
    description: string;
    date: string;
    amount?: number;
    relatedId?: string; // ID da transação, orçamento ou meta
    priority: 'low' | 'medium' | 'high';
}

interface UseSmartNotificationsProps {
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
    accounts: Account[];
    currentDate: Date;
    notificationSettings: NotificationSettings;
}

export const useSmartNotifications = ({
    transactions,
    budgets,
    goals,
    accounts,
    currentDate,
    notificationSettings
}: UseSmartNotificationsProps): SmartNotification[] => {
    
    // Criar chaves estáveis para dependências
    const txCount = transactions?.length || 0;
    const budgetCount = budgets?.length || 0;
    const goalCount = goals?.length || 0;
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;
    const settingsKey = `${notificationSettings.enableBillReminders}-${notificationSettings.enableBudgetAlerts}-${notificationSettings.enableGoalReminders}-${notificationSettings.reminderDaysBefore}`;
    
    return useMemo(() => {
        if (!transactions || transactions.length === 0) return [];
        
        const notifications: SmartNotification[] = [];
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);

        // ========== 1. LEMBRETES DE VENCIMENTO ==========
        if (notificationSettings.enableBillReminders) {
            const reminderDays = notificationSettings.reminderDaysBefore || 3;
            const reminderDate = new Date(today);
            reminderDate.setDate(reminderDate.getDate() + reminderDays);

            // Buscar transações futuras (despesas) que vencem nos próximos X dias
            const upcomingBills = transactions.filter(t => {
                if (t.type !== TransactionType.EXPENSE) return false;
                if (t.deleted) return false;
                
                const txDate = new Date(t.date);
                txDate.setHours(0, 0, 0, 0);
                
                // Transação está entre hoje e a data de lembrete
                return txDate >= today && txDate <= reminderDate;
            });

            upcomingBills.forEach(bill => {
                const txDate = new Date(bill.date);
                const daysUntil = Math.ceil((txDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                let priority: 'low' | 'medium' | 'high' = 'low';
                let timeText = '';
                
                if (daysUntil === 0) {
                    priority = 'high';
                    timeText = 'vence hoje';
                } else if (daysUntil === 1) {
                    priority = 'high';
                    timeText = 'vence amanhã';
                } else if (daysUntil <= 3) {
                    priority = 'medium';
                    timeText = `vence em ${daysUntil} dias`;
                } else {
                    priority = 'low';
                    timeText = `vence em ${daysUntil} dias`;
                }

                const accountName = accounts.find(a => a.id === bill.accountId)?.name || '';

                notifications.push({
                    id: `bill-${bill.id}`,
                    type: 'BILL_REMINDER',
                    title: `💰 ${bill.description}`,
                    description: `${timeText} - ${bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${accountName ? ` (${accountName})` : ''}`,
                    date: bill.date,
                    amount: bill.amount,
                    relatedId: bill.id,
                    priority
                });
            });
        }

        // ========== 2. ALERTAS DE ORÇAMENTO ==========
        if (notificationSettings.enableBudgetAlerts && budgets.length > 0) {
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();

            // Calcular gastos por categoria no mês atual
            const monthlyExpenses = transactions.filter(t => {
                if (t.type !== TransactionType.EXPENSE) return false;
                if (t.deleted) return false;
                const txDate = new Date(t.date);
                return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            });

            const expensesByCategory: Record<string, number> = {};
            monthlyExpenses.forEach(t => {
                const cat = t.category;
                expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
            });

            budgets.forEach(budget => {
                const spent = expensesByCategory[budget.categoryId] || 0;
                const percentage = (spent / budget.amount) * 100;

                if (percentage >= 100) {
                    // Orçamento estourado
                    notifications.push({
                        id: `budget-exceeded-${budget.id}`,
                        type: 'BUDGET_ALERT',
                        title: `🚨 Orçamento Estourado`,
                        description: `${budget.categoryId}: gastou ${spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${budget.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${percentage.toFixed(0)}%)`,
                        date: new Date().toISOString(),
                        amount: spent - budget.amount,
                        relatedId: budget.id,
                        priority: 'high'
                    });
                } else if (percentage >= budget.alertThreshold) {
                    // Próximo do limite
                    notifications.push({
                        id: `budget-warning-${budget.id}`,
                        type: 'BUDGET_ALERT',
                        title: `⚠️ Orçamento Próximo do Limite`,
                        description: `${budget.categoryId}: ${percentage.toFixed(0)}% usado (${spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de ${budget.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
                        date: new Date().toISOString(),
                        amount: budget.amount - spent,
                        relatedId: budget.id,
                        priority: 'medium'
                    });
                }
            });
        }

        // ========== 3. LEMBRETES DE METAS ==========
        if (notificationSettings.enableGoalReminders && goals.length > 0) {
            goals.forEach(goal => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                const remaining = goal.targetAmount - goal.currentAmount;

                // Meta atingida
                if (progress >= 100) {
                    notifications.push({
                        id: `goal-achieved-${goal.id}`,
                        type: 'GOAL_REMINDER',
                        title: `🎉 Meta Atingida!`,
                        description: `Parabéns! Você atingiu a meta "${goal.name}"`,
                        date: new Date().toISOString(),
                        relatedId: goal.id,
                        priority: 'low'
                    });
                }
                // Meta com prazo próximo
                else if (goal.deadline) {
                    const deadlineDate = new Date(goal.deadline);
                    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysUntilDeadline <= 30 && daysUntilDeadline > 0 && progress < 80) {
                        notifications.push({
                            id: `goal-deadline-${goal.id}`,
                            type: 'GOAL_REMINDER',
                            title: `📅 Meta com Prazo Próximo`,
                            description: `"${goal.name}" vence em ${daysUntilDeadline} dias. Faltam ${remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${progress.toFixed(0)}% concluído)`,
                            date: goal.deadline,
                            amount: remaining,
                            relatedId: goal.id,
                            priority: daysUntilDeadline <= 7 ? 'high' : 'medium'
                        });
                    }
                }
                // Progresso significativo (50%, 75%)
                else if (progress >= 75 && progress < 100) {
                    notifications.push({
                        id: `goal-progress-75-${goal.id}`,
                        type: 'GOAL_REMINDER',
                        title: `🚀 Quase lá!`,
                        description: `"${goal.name}" está em ${progress.toFixed(0)}%. Faltam apenas ${remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}!`,
                        date: new Date().toISOString(),
                        amount: remaining,
                        relatedId: goal.id,
                        priority: 'low'
                    });
                }
            });
        }

        // Ordenar por prioridade e data
        return notifications.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txCount, budgetCount, goalCount, dateKey, settingsKey, accounts?.length]);
};
