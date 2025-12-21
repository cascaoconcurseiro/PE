import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Account, Trip, FamilyMember, CustomCategory } from '../../types';
import { parseDate } from '../../utils';

import { TransactionList } from './TransactionList';
import { TransactionSummary } from './TransactionSummary';
import { TransactionForm } from './TransactionForm';
import { TransactionDeleteModal } from './TransactionDeleteModal';
import { TransactionFilters } from './TransactionFilters';
import { InstallmentAnticipationModal } from './InstallmentAnticipationModal';

import { useTransactionFilters } from './useTransactionFilters';
import { usePaginatedTransactions } from '../../hooks/usePaginatedTransactions';
import { Pagination } from '../../components/ui/Pagination';

// Export PrivacyBlur for reuse if needed, though mostly handled internally now
export const PrivacyBlur = ({ children, showValues }: { children: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">R$ ••••</span>;
};

interface TransactionsProps {
    transactions: Transaction[];
    accounts: Account[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    customCategories: CustomCategory[];
    onAddTransaction: (t: Omit<Transaction, 'id'> & { id?: string }) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onAnticipate?: (ids: string[], date: string, accountId: string) => void;
    initialEditId?: string | null;
    onCancel?: () => void;
    modalMode?: boolean;
    currentDate?: Date;
    onClearEditId?: () => void;
    showValues?: boolean;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
    currentUserName?: string;
    currentUserId?: string;
    // New props for pagination
    usePagination?: boolean;
    pageSize?: number;
}

export const Transactions: React.FC<TransactionsProps> = ({
    transactions,
    accounts,
    trips,
    familyMembers,
    customCategories,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    onAnticipate,
    initialEditId,
    onCancel,
    modalMode = false,
    currentDate: propDate,
    onClearEditId: propOnClearEditId,
    showValues: propShowValues,
    onNavigateToAccounts,
    onNavigateToTrips,
    onNavigateToFamily,
    currentUserName,
    currentUserId,
    usePagination = false,
    pageSize = 50,
}) => {
    const currentDate = propDate || new Date();
    const showValues = propShowValues !== undefined ? propShowValues : true;
    const onClearEditId = propOnClearEditId || (() => { });

    const [formMode, setFormMode] = useState<TransactionType | null>(modalMode ? TransactionType.EXPENSE : null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    // Active Tab removed - always REGULAR now
    const activeTab = 'REGULAR';

    // Pagination state
    const [filters, setFilters] = useState<{
        accountId?: string;
        type?: 'RECEITA' | 'DESPESA' | 'TRANSFERÊNCIA';
        category?: string;
        dateFrom?: string;
        dateTo?: string;
    }>({});

    // Use pagination hook if enabled, otherwise use legacy filtering
    const paginationResult = usePaginatedTransactions(
        currentUserId || '',
        usePagination ? {
            pageSize,
            filters,
            sortField: 'date',
            sortDirection: 'desc'
        } : undefined
    );

    // Use Custom Hook for Filtering Logic (legacy mode)
    const { filteredTransactions } = useTransactionFilters(transactions, currentDate);
    
    // Choose data source based on pagination mode
    const displayTransactions = usePagination ? paginationResult.data : filteredTransactions;
    const isLoading = usePagination ? paginationResult.isLoading : false;
    const pagination = usePagination ? paginationResult.pagination : undefined;
    
    // Group transactions by date for display
    const groupedTxs = displayTransactions.reduce((groups: Record<string, Transaction[]>, tx) => {
        const dateKey = tx.date;
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(tx);
        return groups;
    }, {});

    // Calculate summary (simplified for now)
    const income = displayTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
    const expense = displayTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    const currency = 'BRL';

    // Delete State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null, isSeries: boolean }>({ isOpen: false, id: null, isSeries: false });

    // Anticipate Installments State
    const [anticipateModal, setAnticipateModal] = useState<{ isOpen: boolean, transaction: Transaction | null }>({ isOpen: false, transaction: null });

    useEffect(() => {
        if (modalMode && !editingTransaction) {
            setFormMode(TransactionType.EXPENSE);
        }
    }, [modalMode, editingTransaction]);

    useEffect(() => {
        if (initialEditId && transactions.length > 0) {
            const txToEdit = transactions.find(t => t.id === initialEditId);
            if (txToEdit) {
                setEditingTransaction(txToEdit);
                setFormMode(txToEdit.type);
                if (onClearEditId) onClearEditId();
            } else {
                console.warn('⚠️ Transação não encontrada:', initialEditId);
            }
        }
    }, [initialEditId, transactions, onClearEditId]);

    const handleEditRequest = (t: Transaction) => {
        setEditingTransaction(t);
        setFormMode(t.type);
    };

    const handleCancelForm = () => {
        setEditingTransaction(null);
        if (!modalMode) setFormMode(null);
        if (onCancel) onCancel();
    };

    const handleSaveTransaction = (data: import('../../types').Transaction, isEdit: boolean, updateFuture: boolean) => {
        if (isEdit && editingTransaction) {
            onUpdateTransaction({ ...data, id: editingTransaction.id });
            if (updateFuture) {
                // Logic for future recurrences update
                const original = editingTransaction;
                const futureTxs = transactions.filter(t =>
                    (t.seriesId === original.seriesId || (t.isRecurring && t.description === original.description)) &&
                    t.id !== original.id &&
                    parseDate(t.date) > parseDate(original.date)
                );
                futureTxs.forEach(ft => {
                    onUpdateTransaction({
                        ...ft,
                        amount: data.amount,
                        description: data.description,
                        category: data.category,
                        accountId: data.accountId,
                    });
                });
            }
        } else {
            onAddTransaction(data);
        }
        handleCancelForm();
    };

    const handleDeleteRequest = (id: string) => {
        const tx = transactions.find(t => t.id === id);
        const isSeries = !!tx?.seriesId;
        setDeleteModal({ isOpen: true, id, isSeries });
    };

    const confirmDelete = (scope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        if (deleteModal.id) {
            onDeleteTransaction(deleteModal.id, scope);
            setDeleteModal({ isOpen: false, id: null, isSeries: false });
        }
    };

    const handleAnticipateRequest = (tx: Transaction) => {
        setAnticipateModal({ isOpen: true, transaction: tx });
    };

    const handleConfirmAnticipation = (ids: string[], date: string, accountId: string) => {
        if (onAnticipate) {
            onAnticipate(ids, date, accountId);
        }
        setAnticipateModal({ isOpen: false, transaction: null });
    };

    // Handle filter changes for pagination
    const handleFiltersChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        if (usePagination) {
            paginationResult.refetch();
        }
    };

    // Handle page changes
    const handlePageChange = (page: number) => {
        if (usePagination && paginationResult.goToPage) {
            paginationResult.goToPage(page);
        }
    };

    // RENDER FORM
    if (formMode) {
        return (
            <TransactionForm
                initialData={editingTransaction}
                formMode={formMode}
                setFormMode={setFormMode}
                accounts={accounts}
                transactions={transactions}
                trips={trips}
                familyMembers={familyMembers}
                customCategories={customCategories}
                onSave={handleSaveTransaction}
                onCancel={handleCancelForm}
                onNavigateToAccounts={onNavigateToAccounts}
                onNavigateToTrips={onNavigateToTrips}
                onNavigateToFamily={onNavigateToFamily}
                currentUserName={currentUserName}
                currentUserId={currentUserId}
            />
        );
    }

    // RENDER LIST
    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TransactionFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                accounts={accounts}
                customCategories={customCategories}
            />

            <TransactionSummary income={income} expense={expense} balance={balance} showValues={showValues} currency={currency} />

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    <TransactionList
                        groupedTxs={groupedTxs}
                        accounts={accounts}
                        familyMembers={familyMembers}
                        showValues={showValues}
                        onEdit={handleEditRequest}
                        onDelete={handleDeleteRequest}
                        onAddClick={() => setFormMode(TransactionType.EXPENSE)}
                        hasActiveFilters={!!searchTerm || Object.keys(filters).some(key => filters[key as keyof typeof filters])}
                        onClearFilters={() => {
                            setSearchTerm('');
                            setFilters({});
                            if (usePagination) {
                                paginationResult.refetch();
                            }
                        }}
                        onAnticipateInstallments={handleAnticipateRequest}
                    />

                    {usePagination && pagination && pagination.totalPages > 1 && (
                        <div className="flex justify-center pt-6">
                            <Pagination
                                currentPage={pagination.currentPage}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                                showInfo={true}
                                totalItems={pagination.totalItems}
                                itemsPerPage={pagination.pageSize}
                            />
                        </div>
                    )}
                </>
            )}

            <TransactionDeleteModal
                isOpen={deleteModal.isOpen}
                isSeries={deleteModal.isSeries}
                onClose={() => setDeleteModal({ isOpen: false, id: null, isSeries: false })}
                onConfirm={confirmDelete}
            />

            {anticipateModal.isOpen && anticipateModal.transaction && (
                <InstallmentAnticipationModal
                    isOpen={anticipateModal.isOpen}
                    onClose={() => setAnticipateModal({ isOpen: false, transaction: null })}
                    transaction={anticipateModal.transaction}
                    allInstallments={displayTransactions}
                    accounts={accounts}
                    onConfirm={handleConfirmAnticipation}
                />
            )}
        </div>
    );
};