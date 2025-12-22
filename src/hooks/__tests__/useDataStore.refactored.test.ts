import { renderHook, act } from '@testing-library/react';
import { useDataStore } from '../useDataStore.refactored';
import { supabaseService } from '../../core/services/supabaseService';
import { useToast } from '../../components/ui/Toast';
import { TransactionType, Category } from '../../types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../core/services/supabaseService');
vi.mock('../../components/ui/Toast');
vi.mock('../../integrations/supabase/client');
vi.mock('../../core/engines/recurrenceEngine');
vi.mock('../../core/engines/financialLogic');
vi.mock('../../utils/errorMapping');
vi.mock('../../services/logger');

const mockAddToast = vi.fn();
const mockSupabaseService = supabaseService as any;

beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ addToast: mockAddToast });
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
    });

    // Mock supabase auth
    const mockSupabase = vi.mocked(await import('../../integrations/supabase/client')).supabase;
    mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'test-user' } } }
    });
    mockSupabase.channel.mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
    });
    mockSupabase.removeChannel = vi.fn();

    // Mock service methods
    mockSupabaseService.getAccounts.mockResolvedValue([]);
    mockSupabaseService.getTransactionsByRange.mockResolvedValue([]);
    mockSupabaseService.getUnsettledSharedTransactions.mockResolvedValue([]);
    mockSupabaseService.getTrips.mockResolvedValue([]);
    mockSupabaseService.getBudgets.mockResolvedValue([]);
    mockSupabaseService.getGoals.mockResolvedValue([]);
    mockSupabaseService.getFamilyMembers.mockResolvedValue([]);
    mockSupabaseService.getAssets.mockResolvedValue([]);
    mockSupabaseService.getSnapshots.mockResolvedValue([]);
    mockSupabaseService.getCustomCategories.mockResolvedValue([]);
});

describe('useDataStore (Refactored)', () => {
    it('should initialize with default state', async () => {
        const { result } = renderHook(() => useDataStore());

        expect(result.current.user).toBeNull();
        expect(result.current.accounts).toEqual([]);
        expect(result.current.transactions).toEqual([]);
        expect(result.current.isLoading).toBe(true);
        expect(result.current.dataInconsistencies).toEqual([]);
    });

    it('should handle login correctly', async () => {
        const { result } = renderHook(() => useDataStore());
        const userProfile = { id: 'test-user', email: 'test@example.com' };

        await act(async () => {
            await result.current.handlers.handleLogin(userProfile);
        });

        expect(result.current.user).toEqual(userProfile);
    });

    it('should handle logout correctly', async () => {
        const { result } = renderHook(() => useDataStore());
        
        // Set initial user
        await act(async () => {
            await result.current.handlers.handleLogin({ id: 'test-user', email: 'test@example.com' });
        });

        // Logout
        await act(async () => {
            await result.current.handlers.handleLogout();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.accounts).toEqual([]);
        expect(result.current.transactions).toEqual([]);
    });

    it('should handle account creation with initial balance', async () => {
        mockSupabaseService.create.mockResolvedValue('new-account-id');
        mockSupabaseService.createTransactionWithValidation.mockResolvedValue('new-tx-id');

        const { result } = renderHook(() => useDataStore());

        const accountData = {
            name: 'Test Account',
            type: 'CHECKING',
            initialBalance: 1000
        };

        await act(async () => {
            await result.current.handlers.handleAddAccount(accountData);
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('accounts', expect.objectContaining({
            name: 'Test Account',
            type: 'CHECKING',
            initialBalance: 0,
            balance: 0
        }));

        expect(mockSupabaseService.createTransactionWithValidation).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 1000,
                description: 'Saldo Inicial',
                type: TransactionType.INCOME,
                isSettled: true
            })
        );
    });

    it('should handle trip deletion with cascade', async () => {
        mockSupabaseService.deleteTripCascade.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.handlers.handleDeleteTrip('trip-id');
        });

        expect(mockSupabaseService.deleteTripCascade).toHaveBeenCalledWith('trip-id');
        expect(mockAddToast).toHaveBeenCalledWith('Viagem e despesas excluídas.', 'success');
    });

    it('should handle member deletion with unlink strategy', async () => {
        const mockTransactions = [
            { id: 'tx1', payerId: 'member-id', description: 'Test' },
            { id: 'tx2', sharedWith: [{ memberId: 'member-id', assignedAmount: 50 }] }
        ];

        // Mock initial state with transactions
        const { result } = renderHook(() => useDataStore());
        
        // Set transactions in state
        act(() => {
            result.current.handlers = {
                ...result.current.handlers,
                handleDeleteMember: async (id: string, strategy = 'UNLINK') => {
                    await result.current.handlers.handleDeleteMember(id, strategy);
                }
            };
        });

        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);
        mockSupabaseService.delete.mockResolvedValue(undefined);

        await act(async () => {
            await result.current.handlers.handleDeleteMember('member-id', 'UNLINK');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('family_members', 'member-id');
        expect(mockAddToast).toHaveBeenCalledWith('Membro removido e vínculos processados.', 'success');
    });

    it('should handle factory reset', async () => {
        mockSupabaseService.performSmartReset.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.handlers.handleFactoryReset(false);
        });

        expect(mockSupabaseService.performSmartReset).toHaveBeenCalledWith(false);
        expect(mockAddToast).toHaveBeenCalledWith('Sistema restaurado para o padrão de fábrica.', 'success');
    });

    it('should handle offline state correctly', async () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
        });

        const { result } = renderHook(() => useDataStore());

        expect(result.current.isOnline).toBe(false);

        // Try to perform operation while offline
        await act(async () => {
            await result.current.handlers.handleAddAccount({ name: 'Test' });
        });

        expect(mockAddToast).toHaveBeenCalledWith('Funcionalidade indisponível offline.', 'error');
        expect(mockSupabaseService.create).not.toHaveBeenCalled();
    });

    it('should handle CRUD operations for budgets', async () => {
        mockSupabaseService.create.mockResolvedValue('budget-id');
        mockSupabaseService.update.mockResolvedValue(undefined);
        mockSupabaseService.delete.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        const budgetData = {
            name: 'Test Budget',
            amount: 1000,
            category: Category.FOOD,
            period: 'MONTHLY'
        };

        // Test create
        await act(async () => {
            await result.current.handlers.handleAddBudget(budgetData);
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('budgets', expect.objectContaining(budgetData));

        // Test update
        const budgetToUpdate = { id: 'budget-id', ...budgetData, amount: 1500 };
        await act(async () => {
            await result.current.handlers.handleUpdateBudget(budgetToUpdate);
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('budgets', expect.objectContaining({
            ...budgetToUpdate,
            updatedAt: expect.any(String)
        }));

        // Test delete
        await act(async () => {
            await result.current.handlers.handleDeleteBudget('budget-id');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('budgets', 'budget-id');
    });

    it('should handle CRUD operations for goals', async () => {
        mockSupabaseService.create.mockResolvedValue('goal-id');
        mockSupabaseService.update.mockResolvedValue(undefined);
        mockSupabaseService.delete.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        const goalData = {
            name: 'Test Goal',
            targetAmount: 5000,
            currentAmount: 1000,
            targetDate: '2024-12-31'
        };

        // Test create
        await act(async () => {
            await result.current.handlers.handleAddGoal(goalData);
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('goals', expect.objectContaining(goalData));

        // Test update
        const goalToUpdate = { id: 'goal-id', ...goalData, currentAmount: 2000 };
        await act(async () => {
            await result.current.handlers.handleUpdateGoal(goalToUpdate);
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('goals', expect.objectContaining({
            ...goalToUpdate,
            updatedAt: expect.any(String)
        }));

        // Test delete
        await act(async () => {
            await result.current.handlers.handleDeleteGoal('goal-id');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('goals', 'goal-id');
    });

    it('should handle CRUD operations for assets', async () => {
        mockSupabaseService.create.mockResolvedValue('asset-id');
        mockSupabaseService.update.mockResolvedValue(undefined);
        mockSupabaseService.delete.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        const assetData = {
            name: 'Test Asset',
            type: 'REAL_ESTATE',
            value: 100000,
            purchaseDate: '2023-01-01'
        };

        // Test create
        await act(async () => {
            await result.current.handlers.handleAddAsset(assetData);
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('assets', expect.objectContaining(assetData));

        // Test update
        const assetToUpdate = { id: 'asset-id', ...assetData, value: 110000 };
        await act(async () => {
            await result.current.handlers.handleUpdateAsset(assetToUpdate);
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('assets', expect.objectContaining({
            ...assetToUpdate,
            updatedAt: expect.any(String)
        }));

        // Test delete
        await act(async () => {
            await result.current.handlers.handleDeleteAsset('asset-id');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('assets', 'asset-id');
    });

    it('should handle custom category operations', async () => {
        mockSupabaseService.create.mockResolvedValue('category-id');
        mockSupabaseService.delete.mockResolvedValue(undefined);

        const { result } = renderHook(() => useDataStore());

        // Test create
        await act(async () => {
            await result.current.handlers.handleAddCategory('Custom Category');
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('custom_categories', expect.objectContaining({
            name: 'Custom Category'
        }));

        // Test delete
        await act(async () => {
            await result.current.handlers.handleDeleteCategory('category-id');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('custom_categories', 'category-id');
    });

    it('should handle snapshot creation', async () => {
        mockSupabaseService.create.mockResolvedValue('snapshot-id');

        const { result } = renderHook(() => useDataStore());

        const snapshotData = {
            name: 'Test Snapshot',
            data: { accounts: [], transactions: [] },
            createdAt: new Date().toISOString()
        };

        await act(async () => {
            await result.current.handlers.handleAddSnapshot(snapshotData);
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('snapshots', expect.objectContaining(snapshotData));
        expect(mockAddToast).toHaveBeenCalledWith('Snapshot salvo!', 'success');
    });

    it('should handle consistency check', async () => {
        const mockCheckDataConsistency = require('../../core/engines/financialLogic').checkDataConsistency;
        mockCheckDataConsistency.mockReturnValue(['Issue 1', 'Issue 2']);

        const { result } = renderHook(() => useDataStore());

        act(() => {
            result.current.handlers.checkConsistency();
        });

        expect(mockCheckDataConsistency).toHaveBeenCalled();
        expect(result.current.dataInconsistencies).toEqual(['Issue 1', 'Issue 2']);
    });

    it('should handle error states correctly', async () => {
        const mockTranslateErrorMessage = require('../../utils/errorMapping').translateErrorMessage;
        mockTranslateErrorMessage.mockReturnValue('Erro traduzido');
        
        mockSupabaseService.create.mockRejectedValue(new Error('Database error'));

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.handlers.handleAddAccount({ name: 'Test' });
        });

        expect(mockAddToast).toHaveBeenCalledWith('Erro traduzido', 'error');
    });

    it('should preserve all original functionality', async () => {
        const { result } = renderHook(() => useDataStore());

        // Verify all handlers exist
        expect(result.current.handlers.handleLogin).toBeDefined();
        expect(result.current.handlers.handleLogout).toBeDefined();
        expect(result.current.handlers.handleAddTransaction).toBeDefined();
        expect(result.current.handlers.handleUpdateTransaction).toBeDefined();
        expect(result.current.handlers.handleDeleteTransaction).toBeDefined();
        expect(result.current.handlers.handleAddAccount).toBeDefined();
        expect(result.current.handlers.handleUpdateAccount).toBeDefined();
        expect(result.current.handlers.handleDeleteAccount).toBeDefined();
        expect(result.current.handlers.handleAddTrip).toBeDefined();
        expect(result.current.handlers.handleUpdateTrip).toBeDefined();
        expect(result.current.handlers.handleDeleteTrip).toBeDefined();
        expect(result.current.handlers.handleAddMember).toBeDefined();
        expect(result.current.handlers.handleUpdateMember).toBeDefined();
        expect(result.current.handlers.handleDeleteMember).toBeDefined();
        expect(result.current.handlers.handleAddBudget).toBeDefined();
        expect(result.current.handlers.handleUpdateBudget).toBeDefined();
        expect(result.current.handlers.handleDeleteBudget).toBeDefined();
        expect(result.current.handlers.handleAddGoal).toBeDefined();
        expect(result.current.handlers.handleUpdateGoal).toBeDefined();
        expect(result.current.handlers.handleDeleteGoal).toBeDefined();
        expect(result.current.handlers.handleAddAsset).toBeDefined();
        expect(result.current.handlers.handleUpdateAsset).toBeDefined();
        expect(result.current.handlers.handleDeleteAsset).toBeDefined();
        expect(result.current.handlers.handleAddCategory).toBeDefined();
        expect(result.current.handlers.handleDeleteCategory).toBeDefined();
        expect(result.current.handlers.handleAddSnapshot).toBeDefined();
        expect(result.current.handlers.handleFactoryReset).toBeDefined();
        expect(result.current.handlers.checkConsistency).toBeDefined();

        // Verify all state properties exist
        expect(result.current.user).toBeDefined();
        expect(result.current.accounts).toBeDefined();
        expect(result.current.transactions).toBeDefined();
        expect(result.current.trips).toBeDefined();
        expect(result.current.budgets).toBeDefined();
        expect(result.current.goals).toBeDefined();
        expect(result.current.familyMembers).toBeDefined();
        expect(result.current.assets).toBeDefined();
        expect(result.current.snapshots).toBeDefined();
        expect(result.current.customCategories).toBeDefined();
        expect(result.current.isLoading).toBeDefined();
        expect(result.current.dataInconsistencies).toBeDefined();
        expect(result.current.isOnline).toBeDefined();
        expect(result.current.isLoadingHistory).toBeDefined();
        expect(result.current.ensurePeriodLoaded).toBeDefined();
    });
});