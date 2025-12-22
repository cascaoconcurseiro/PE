import { renderHook, act } from '@testing-library/react';
import { useTransactionOperations } from '../useTransactionOperations';
import { supabaseService } from '../../core/services/supabaseService';
import { TransactionType, Category } from '../../types';

jest.mock('../../core/services/supabaseService');

const mockSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockPerformOperation = jest.fn();
const mockSetTransactions = jest.fn();

const mockAccounts = [
    { id: 'acc1', name: 'Account 1', balance: 1000 },
    { id: 'acc2', name: 'Account 2', balance: 500 }
];

const mockTransactions = [
    {
        id: 'tx1',
        amount: 100,
        description: 'Test Transaction',
        date: '2024-01-01',
        type: TransactionType.EXPENSE,
        category: Category.FOOD,
        accountId: 'acc1'
    }
];

beforeEach(() => {
    jest.clearAllMocks();
    mockPerformOperation.mockImplementation(async (operation) => {
        await operation();
    });
});

describe('useTransactionOperations', () => {
    const renderTransactionOps = () => renderHook(() => 
        useTransactionOperations({
            accounts: mockAccounts,
            transactions: mockTransactions,
            setTransactions: mockSetTransactions,
            performOperation: mockPerformOperation
        })
    );

    it('should validate transaction correctly', async () => {
        const { result } = renderTransactionOps();

        const invalidTransaction = {
            amount: 0,
            description: '',
            date: '',
            type: TransactionType.EXPENSE,
            category: Category.FOOD
        };

        await act(async () => {
            try {
                await result.current.handleAddTransaction(invalidTransaction);
            } catch (error) {
                expect(error.message).toBe('Valor da transação inválido.');
            }
        });
    });

    it('should validate transfer transaction', async () => {
        const { result } = renderTransactionOps();

        const transferTransaction = {
            amount: 100,
            description: 'Transfer',
            date: '2024-01-01',
            type: TransactionType.TRANSFER,
            accountId: 'acc1',
            destinationAccountId: 'acc1' // Same account
        };

        await act(async () => {
            try {
                await result.current.handleAddTransaction(transferTransaction);
            } catch (error) {
                expect(error.message).toBe('Origem e destino não podem ser iguais.');
            }
        });
    });

    it('should handle single transaction creation', async () => {
        mockSupabaseService.createTransactionWithValidation.mockResolvedValue('new-tx-id');

        const { result } = renderTransactionOps();

        const newTransaction = {
            amount: 100,
            description: 'Test Transaction',
            date: '2024-01-01',
            type: TransactionType.EXPENSE,
            category: Category.FOOD,
            accountId: 'acc1'
        };

        await act(async () => {
            await result.current.handleAddTransaction(newTransaction);
        });

        expect(mockSupabaseService.createTransactionWithValidation).toHaveBeenCalledWith(
            expect.objectContaining({
                ...newTransaction,
                id: expect.any(String),
                isSettled: false,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
        );

        expect(mockPerformOperation).toHaveBeenCalledWith(
            expect.any(Function),
            'Transação adicionada com sucesso!'
        );
    });

    it('should handle installment transaction creation', async () => {
        mockSupabaseService.createTransactionWithValidation.mockResolvedValue('new-tx-id');

        const { result } = renderTransactionOps();

        const installmentTransaction = {
            amount: 300,
            description: 'Installment Purchase',
            date: '2024-01-01',
            type: TransactionType.EXPENSE,
            category: Category.SHOPPING,
            accountId: 'acc1',
            isInstallment: true,
            totalInstallments: 3
        };

        await act(async () => {
            await result.current.handleAddTransaction(installmentTransaction);
        });

        // Should create 3 installments
        expect(mockSupabaseService.createTransactionWithValidation).toHaveBeenCalledTimes(3);

        // Check first installment
        expect(mockSupabaseService.createTransactionWithValidation).toHaveBeenNthCalledWith(1,
            expect.objectContaining({
                amount: 100, // 300 / 3
                description: 'Installment Purchase (1/3)',
                currentInstallment: 1,
                totalInstallments: 3,
                seriesId: expect.any(String)
            })
        );
    });

    it('should handle transaction update', async () => {
        mockSupabaseService.update.mockResolvedValue(undefined);

        const { result } = renderTransactionOps();

        const updatedTransaction = {
            id: 'tx1',
            amount: 150,
            description: 'Updated Transaction',
            date: '2024-01-01',
            type: TransactionType.EXPENSE,
            category: Category.FOOD,
            accountId: 'acc1'
        };

        await act(async () => {
            await result.current.handleUpdateTransaction(updatedTransaction);
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('transactions', 
            expect.objectContaining({
                ...updatedTransaction,
                updatedAt: expect.any(String)
            })
        );
    });

    it('should handle series regeneration on installment count change', async () => {
        const seriesTransactions = [
            {
                id: 'tx1',
                seriesId: 'series1',
                totalInstallments: 2,
                amount: 100,
                description: 'Test (1/2)',
                date: '2024-01-01',
                type: TransactionType.EXPENSE,
                category: Category.FOOD,
                accountId: 'acc1',
                isSettled: false
            },
            {
                id: 'tx2',
                seriesId: 'series1',
                totalInstallments: 2,
                amount: 100,
                description: 'Test (2/2)',
                date: '2024-02-01',
                type: TransactionType.EXPENSE,
                category: Category.FOOD,
                accountId: 'acc1',
                isSettled: false
            }
        ];

        const { result } = renderHook(() => 
            useTransactionOperations({
                accounts: mockAccounts,
                transactions: seriesTransactions,
                setTransactions: mockSetTransactions,
                performOperation: mockPerformOperation
            })
        );

        mockSupabaseService.recreateTransactionSeries.mockResolvedValue(undefined);

        const updatedTransaction = {
            ...seriesTransactions[0],
            totalInstallments: 3, // Changed from 2 to 3
            amount: 300
        };

        await act(async () => {
            await result.current.handleUpdateTransaction(updatedTransaction);
        });

        expect(mockSupabaseService.recreateTransactionSeries).toHaveBeenCalledWith(
            'series1',
            expect.arrayContaining([
                expect.objectContaining({
                    description: 'Test (1/3)',
                    currentInstallment: 1,
                    totalInstallments: 3
                }),
                expect.objectContaining({
                    description: 'Test (2/3)',
                    currentInstallment: 2,
                    totalInstallments: 3
                }),
                expect.objectContaining({
                    description: 'Test (3/3)',
                    currentInstallment: 3,
                    totalInstallments: 3
                })
            ])
        );
    });

    it('should prevent series modification when installments are settled', async () => {
        const settledSeriesTransactions = [
            {
                id: 'tx1',
                seriesId: 'series1',
                totalInstallments: 2,
                amount: 100,
                description: 'Test (1/2)',
                date: '2024-01-01',
                type: TransactionType.EXPENSE,
                category: Category.FOOD,
                accountId: 'acc1',
                isSettled: true // Settled
            }
        ];

        const { result } = renderHook(() => 
            useTransactionOperations({
                accounts: mockAccounts,
                transactions: settledSeriesTransactions,
                setTransactions: mockSetTransactions,
                performOperation: mockPerformOperation
            })
        );

        const updatedTransaction = {
            ...settledSeriesTransactions[0],
            totalInstallments: 3
        };

        await act(async () => {
            try {
                await result.current.handleUpdateTransaction(updatedTransaction);
            } catch (error) {
                expect(error.message).toBe('Não é possível alterar o número de parcelas de uma série com pagamentos já realizados.');
            }
        });
    });

    it('should handle transaction deletion', async () => {
        mockSupabaseService.update.mockResolvedValue(undefined);

        const { result } = renderTransactionOps();

        await act(async () => {
            await result.current.handleDeleteTransaction('tx1', 'SINGLE');
        });

        expect(mockSetTransactions).toHaveBeenCalledWith(expect.any(Function));
        expect(mockSupabaseService.update).toHaveBeenCalledWith('transactions',
            expect.objectContaining({
                deleted: true,
                updatedAt: expect.any(String)
            })
        );
    });

    it('should handle series deletion', async () => {
        const seriesTransaction = {
            id: 'tx1',
            seriesId: 'series1',
            amount: 100,
            description: 'Test',
            date: '2024-01-01',
            type: TransactionType.EXPENSE,
            category: Category.FOOD,
            accountId: 'acc1'
        };

        const { result } = renderHook(() => 
            useTransactionOperations({
                accounts: mockAccounts,
                transactions: [seriesTransaction],
                setTransactions: mockSetTransactions,
                performOperation: mockPerformOperation
            })
        );

        mockSupabaseService.deleteTransactionSeries.mockResolvedValue(undefined);

        await act(async () => {
            await result.current.handleDeleteTransaction('tx1', 'SERIES');
        });

        expect(mockSupabaseService.deleteTransactionSeries).toHaveBeenCalledWith('series1');
    });

    it('should handle batch transaction creation', async () => {
        mockSupabaseService.createTransactionWithValidation.mockResolvedValue('new-tx-id');

        const { result } = renderTransactionOps();

        const newTransactions = [
            {
                amount: 100,
                description: 'Transaction 1',
                date: '2024-01-01',
                type: TransactionType.EXPENSE,
                category: Category.FOOD,
                accountId: 'acc1'
            },
            {
                amount: 200,
                description: 'Transaction 2',
                date: '2024-01-02',
                type: TransactionType.EXPENSE,
                category: Category.TRANSPORT,
                accountId: 'acc1'
            }
        ];

        await act(async () => {
            await result.current.handleAddTransactions(newTransactions);
        });

        expect(mockSetTransactions).toHaveBeenCalledWith(expect.any(Function));
        expect(mockSupabaseService.createTransactionWithValidation).toHaveBeenCalledTimes(2);
        expect(mockPerformOperation).toHaveBeenCalledWith(
            expect.any(Function),
            '2 transações adicionadas!'
        );
    });

    it('should handle batch transaction updates', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);

        const { result } = renderTransactionOps();

        const transactionsToUpdate = [
            { ...mockTransactions[0], amount: 150 }
        ];

        await act(async () => {
            await result.current.handleBatchUpdateTransactions(transactionsToUpdate);
        });

        expect(mockSupabaseService.bulkCreate).toHaveBeenCalledWith('transactions',
            expect.arrayContaining([
                expect.objectContaining({
                    amount: 150,
                    updatedAt: expect.any(String)
                })
            ])
        );
    });

    it('should handle installment anticipation', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);

        const { result } = renderTransactionOps();

        await act(async () => {
            await result.current.handleAnticipateInstallments(
                ['tx1'],
                '2024-01-15',
                'acc2'
            );
        });

        expect(mockSupabaseService.bulkCreate).toHaveBeenCalledWith('transactions',
            expect.arrayContaining([
                expect.objectContaining({
                    date: '2024-01-15',
                    accountId: 'acc2',
                    description: expect.stringContaining('(Antecipada)'),
                    updatedAt: expect.any(String)
                })
            ])
        );
    });

    it('should validate anticipation parameters', async () => {
        const { result } = renderTransactionOps();

        await act(async () => {
            try {
                await result.current.handleAnticipateInstallments([], '2024-01-15');
            } catch (error) {
                expect(error.message).toBe('Nenhuma parcela encontrada para antecipar');
            }
        });

        await act(async () => {
            try {
                await result.current.handleAnticipateInstallments(['tx1'], '');
            } catch (error) {
                expect(error.message).toBe('Data de antecipação inválida');
            }
        });

        await act(async () => {
            try {
                await result.current.handleAnticipateInstallments(['tx1'], '2024-01-15', 'invalid-account');
            } catch (error) {
                expect(error.message).toBe('Conta de destino não encontrada');
            }
        });
    });
});