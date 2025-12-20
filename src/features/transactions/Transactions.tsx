import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Account, Trip, FamilyMember, CustomCategory, Category } from '../../types';
import { parseDate } from '../../utils';

import { TransactionList } from './TransactionList';
import { TransactionSummary } from './TransactionSummary';
import { TransactionForm } from './TransactionForm';
import { TransactionDeleteModal } from './TransactionDeleteModal';
import { TransactionFilters } from './TransactionFilters';
import { InstallmentAnticipationModal } from './InstallmentAnticipationModal';

import { useTransactionFilters } from '../../hooks/useTransactionFilters';

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
}) => {
    const currentDate = propDate || new Date();
    const showValues = propShowValues !== undefined ? propShowValues : true;
    const onClearEditId = propOnClearEditId || (() => { });

    const [formMode, setFormMode] = useState<TransactionType | null>(modalMode ? TransactionType.EXPENSE : null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    // Active Tab removed - always REGULAR now
    const activeTab = 'REGULAR';

    // Use Custom Hook for Filtering Logic
    const { filteredTxs, groupedTxs, income, expense, balance, currency } = useTransactionFilters({
        transactions: transactions, // Allow all transaction types, including OPENING_BALANCE
        accounts,
        currentDate,
        searchTerm,
        activeTab
    });

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

    const handleSaveTransaction = (data: import('../types').Transaction, isEdit: boolean, updateFuture: boolean) => {
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
            />

            <TransactionSummary income={income} expense={expense} balance={balance} showValues={showValues} currency={currency} />

            <TransactionList
                groupedTxs={groupedTxs}
                accounts={accounts}
                familyMembers={familyMembers}
                showValues={showValues}
                onEdit={handleEditRequest}
                onDelete={handleDeleteRequest}
                onAddClick={() => setFormMode(TransactionType.EXPENSE)}
                hasActiveFilters={!!searchTerm}
                onClearFilters={() => setSearchTerm('')}
            />

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
                    allInstallments={transactions}
                    accounts={accounts}
                    onConfirm={handleConfirmAnticipation}
                />
            )}
        </div>
    );
};