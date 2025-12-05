import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, SyncStatus, UserProfile, Snapshot
} from '../types';
import { parseDate } from '../utils';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../integrations/supabase/client';
import { processRecurringTransactions } from '../services/recurrenceEngine';
import { checkDataConsistency } from '../services/financialLogic';

export const useDataStore = () => {
    const { addToast } = useToast();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [dataInconsistencies, setDataInconsistencies] = useState<string[]>([]);
    const isInitialized = useRef(false);

    // --- ACTIONS DEFINED EARLY FOR USAGE IN FETCH ---
    // We need to define these before fetchData so we can pass them to recurrence engine,
    // BUT fetchData is called by these. Circular dependency?
    // Solution: Define internal handlers that don't call fetchData, or just let the cycle happen (it breaks naturally).
    // Actually, processRecurringTransactions calls onAdd/onUpdate.
    // If we pass the public handlers, they call refresh() -> fetchData().
    // This is safe as long as recurrence engine doesn't generate infinitely.

    // Wrapper for async operations to handle errors
    const performOperation = async (operation: () => Promise<void>, successMessage?: string) => {
        try {
            await operation();
            if (successMessage) addToast(successMessage, 'success');
            refresh();
        } catch (error: any) {
            console.error("Operation failed:", error);
            addToast(`Erro: ${error.message || 'Falha na operação'}`, 'error');
        }
    };

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        await performOperation(async () => {
            const now = new Date().toISOString();
            const totalInstallments = Number(newTx.totalInstallments);
            const txsToCreate: any[] = [];

            if (newTx.isInstallment && totalInstallments > 1) {
                const baseDate = parseDate(newTx.date);
                const seriesId = crypto.randomUUID();
                const baseInstallmentValue = Math.floor((newTx.amount / totalInstallments) * 100) / 100;
                let accumulatedAmount = 0;
                let accumulatedSharedAmounts: { [memberId: string]: number } = {};

                // Initialize accumulated amounts for each shared member
                if (newTx.sharedWith) {
                    newTx.sharedWith.forEach(s => {
                        accumulatedSharedAmounts[s.memberId] = 0;
                    });
                }

                for (let i = 0; i < totalInstallments; i++) {
                    // FIX: Calcular mês/ano corretamente para evitar problemas com dias 29, 30, 31
                    const targetMonth = baseDate.getMonth() + i;
                    const targetYear = baseDate.getFullYear() + Math.floor(targetMonth / 12);
                    const finalMonth = targetMonth % 12;

                    // Criar data sempre com dia 1 primeiro para evitar overflow de mês
                    const nextDate = new Date(targetYear, finalMonth, 1);

                    // Ajustar para o dia correto (ou último dia do mês se não existir)
                    const targetDay = baseDate.getDate();
                    const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                    nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                    // Preservar hora original
                    nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds());

                    let currentAmount = baseInstallmentValue;
                    if (i === totalInstallments - 1) {
                        // Last installment: adjust to match exact total
                        currentAmount = Number((newTx.amount - accumulatedAmount).toFixed(2));
                    }
                    accumulatedAmount += currentAmount;

                    // Calculate shared amounts with rounding correction on last installment
                    const currentSharedWith = newTx.sharedWith?.map(s => {
                        let assignedAmount = Number(((s.assignedAmount / newTx.amount) * currentAmount).toFixed(2));

                        if (i === totalInstallments - 1) {
                            // Last installment: adjust to match exact total for this member
                            const totalAssigned = accumulatedSharedAmounts[s.memberId] || 0;
                            assignedAmount = Number((s.assignedAmount - totalAssigned).toFixed(2));
                        } else {
                            // Accumulate for correction on last installment
                            accumulatedSharedAmounts[s.memberId] = (accumulatedSharedAmounts[s.memberId] || 0) + assignedAmount;
                        }

                        return {
                            ...s,
                            assignedAmount
                        };
                    });

                    txsToCreate.push({
                        ...newTx,
                        id: crypto.randomUUID(),
                        amount: currentAmount,
                        originalAmount: newTx.amount,
                        sharedWith: currentSharedWith,
                        seriesId: seriesId,
                        date: nextDate.toISOString().split('T')[0],
                        currentInstallment: i + 1,
                        totalInstallments: totalInstallments,
                        description: `${newTx.description} (${i + 1}/${totalInstallments})`,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            } else {
                txsToCreate.push({
                    ...newTx,
                    id: crypto.randomUUID(),
                    createdAt: now,
                    updatedAt: now
                });
            }

            await supabaseService.bulkCreate('transactions', txsToCreate);
        }, 'Transação salva!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await performOperation(async () => {
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        }, 'Transação atualizada!');
    };

    // --- FETCH DATA FROM SUPABASE ---
    const fetchData = useCallback(async (forceLoading = false) => {
        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setIsLoading(false);
            return;
        }

        if (!isInitialized.current || forceLoading) {
            setIsLoading(true);
        }

        try {
            const [
                accs, txs, trps, bdgts, gls, fam, assts, snaps, cats
            ] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions(),
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]);

            setAccounts(accs);
            setTransactions(txs);
            setTrips(trps);
            setBudgets(bdgts);
            setGoals(gls);
            setFamilyMembers(fam);
            setAssets(assts);
            setSnapshots(snaps);
            setCustomCategories(cats);

            // ✅ VALIDAÇÃO: Verificar consistência de dados
            const issues = checkDataConsistency(accs, txs);
            setDataInconsistencies(issues); // Armazenar para exibição posterior

            if (issues.length > 0) {
                console.warn('⚠️ PROBLEMAS DE CONSISTÊNCIA DETECTADOS:');
                issues.forEach(issue => console.warn(`  - ${issue}`));

                // Mostrar detalhes da primeira inconsistência
                const firstIssue = issues[0];
                const moreIssues = issues.length > 1 ? ` (+${issues.length - 1} mais)` : '';
                addToast(`⚠️ Inconsistência: ${firstIssue}${moreIssues}`, 'warning');
            }

            // Run Recurrence Engine
            // We pass the handlers directly. Since they are defined in the component scope, 
            // we need to be careful about closure staleness, but 'performOperation' uses the latest state?
            // Actually, handleAddTransaction doesn't use state, it just writes to DB. Safe.
            processRecurringTransactions(txs, handleAddTransaction, handleUpdateTransaction);

            isInitialized.current = true;
        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
            addToast("Erro ao carregar dados da nuvem.", 'error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- ACTIONS ---

    const handleLogin = async (userProfile: UserProfile) => {
        setUser(userProfile);
        fetchData(true);
    };

    const handleLogout = async () => {
        setUser(null);
        setAccounts([]);
        setTransactions([]);
        isInitialized.current = false;
    };

    const refresh = () => fetchData(false);

    const handleDeleteTransaction = async (id: string, deleteScope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        await performOperation(async () => {
            // ✅ SOFT DELETE: Marcar transações como deletadas ao invés de excluir fisicamente
            // Isso mantém histórico e permite auditoria
            if (deleteScope === 'SERIES') {
                const tx = transactions.find(t => t.id === id);
                if (tx && tx.seriesId) {
                    // Find all transactions in this series
                    const seriesTxs = transactions.filter(t => t.seriesId === tx.seriesId);
                    console.log(`🗑️ Marcando ${seriesTxs.length} transações da série como deletadas...`);
                    for (const t of seriesTxs) {
                        await supabaseService.update('transactions', {
                            ...t,
                            deleted: true,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`  ✅ Transação marcada como deletada: ${t.description}`);
                    }
                } else {
                    // Fallback if no seriesId found
                    const tx = transactions.find(t => t.id === id);
                    if (tx) {
                        await supabaseService.update('transactions', {
                            ...tx,
                            deleted: true,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`✅ Transação marcada como deletada: ${tx.description}`);
                    }
                }
            } else {
                const tx = transactions.find(t => t.id === id);
                if (tx) {
                    await supabaseService.update('transactions', {
                        ...tx,
                        deleted: true,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`✅ Transação marcada como deletada: ${tx.description}`);
                }
            }
        }, 'Transação excluída.');
    };

    const handleAnticipateInstallments = async (ids: string[], targetDate: string, targetAccountId?: string) => {
        await performOperation(async () => {
            const txsToUpdate = transactions.filter(t => ids.includes(t.id)).map(t => ({
                ...t,
                date: targetDate,
                accountId: targetAccountId || t.accountId,
                description: t.description.includes('(Antecipado)') ? t.description : `${t.description} (Antecipado)`,
                updatedAt: new Date().toISOString()
            }));

            for (const tx of txsToUpdate) {
                await supabaseService.update('transactions', tx);
            }
        }, 'Parcelas antecipadas!');
    };

    // --- GENERIC HANDLERS ---
    const handleAddAccount = async (acc: any) => performOperation(async () => { await supabaseService.create('accounts', { ...acc, id: crypto.randomUUID() }); }, 'Conta criada!');
    const handleUpdateAccount = async (acc: any) => performOperation(async () => { await supabaseService.update('accounts', acc); }, 'Conta atualizada!');
    const handleDeleteAccount = async (id: string) => performOperation(async () => {
        // ✅ SOFT DELETE: Marcar transações como deletadas ao invés de excluir fisicamente
        // Isso mantém histórico e permite auditoria
        const accountTxs = transactions.filter(t => t.accountId === id || t.destinationAccountId === id);

        console.log(`🗑️ Excluindo conta ${id} e marcando ${accountTxs.length} transações como deletadas...`);

        for (const tx of accountTxs) {
            await supabaseService.update('transactions', {
                ...tx,
                deleted: true,
                updatedAt: new Date().toISOString()
            });
            console.log(`  ✅ Transação marcada como deletada: ${tx.description}`);
        }

        // Then delete the account itself
        await supabaseService.delete('accounts', id);

        console.log(`✅ Conta ${id} excluída com sucesso!`);
    }, 'Conta e transações excluídas.');

    const handleAddTrip = async (trip: any) => performOperation(async () => { await supabaseService.create('trips', { ...trip, id: crypto.randomUUID() }); }, 'Viagem criada!');
    const handleUpdateTrip = async (trip: any) => performOperation(async () => { await supabaseService.update('trips', trip); }, 'Viagem atualizada!');
    const handleDeleteTrip = async (id: string) => performOperation(async () => { await supabaseService.delete('trips', id); }, 'Viagem excluída.');

    const handleAddMember = async (m: any) => performOperation(async () => { await supabaseService.create('family_members', { ...m, id: crypto.randomUUID() }); }, 'Membro adicionado!');
    const handleDeleteMember = async (id: string) => performOperation(async () => { await supabaseService.delete('family_members', id); }, 'Membro removido.');

    const handleAddCategory = async (name: string) => performOperation(async () => { await supabaseService.create('custom_categories', { id: crypto.randomUUID(), name }); }, 'Categoria adicionada!');
    const handleDeleteCategory = async (id: string) => performOperation(async () => { await supabaseService.delete('custom_categories', id); }, 'Categoria removida.');

    const handleAddBudget = async (b: any) => performOperation(async () => { await supabaseService.create('budgets', { ...b, id: crypto.randomUUID() }); }, 'Orçamento salvo!');
    const handleUpdateBudget = async (b: any) => performOperation(async () => { await supabaseService.update('budgets', b); }, 'Orçamento atualizado!');
    const handleDeleteBudget = async (id: string) => performOperation(async () => { await supabaseService.delete('budgets', id); }, 'Orçamento removido.');

    const handleAddGoal = async (g: any) => performOperation(async () => { await supabaseService.create('goals', { ...g, id: crypto.randomUUID() }); }, 'Meta criada!');
    const handleUpdateGoal = async (g: any) => performOperation(async () => { await supabaseService.update('goals', g); }, 'Meta atualizada!');
    const handleDeleteGoal = async (id: string) => performOperation(async () => { await supabaseService.delete('goals', id); }, 'Meta excluída.');

    const handleAddAsset = async (a: any) => performOperation(async () => { await supabaseService.create('assets', { ...a, id: crypto.randomUUID() }); }, 'Ativo adicionado!');
    const handleUpdateAsset = async (a: any) => performOperation(async () => { await supabaseService.update('assets', a); }, 'Ativo atualizado!');
    const handleDeleteAsset = async (id: string) => performOperation(async () => { await supabaseService.delete('assets', id); }, 'Ativo removido.');

    const handleAddSnapshot = async (s: any) => performOperation(async () => { await supabaseService.create('snapshots', { ...s, id: crypto.randomUUID() }); });

    return {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading, dataInconsistencies,
        handlers: {
            handleLogin, handleLogout,
            handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction, handleAnticipateInstallments,
            handleAddAccount, handleUpdateAccount, handleDeleteAccount,
            handleAddTrip, handleUpdateTrip, handleDeleteTrip,
            handleAddMember, handleDeleteMember,
            handleAddCategory, handleDeleteCategory,
            handleAddBudget, handleUpdateBudget, handleDeleteBudget,
            handleAddGoal, handleUpdateGoal, handleDeleteGoal,
            handleAddAsset, handleUpdateAsset, handleDeleteAsset,
            handleAddSnapshot
        }
    };
};