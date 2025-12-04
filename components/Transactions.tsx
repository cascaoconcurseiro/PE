import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory } from '../types';
import { Search, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { isSameMonth } from '../utils';
import { TransactionList } from './transactions/TransactionList';
import { TransactionSummary } from './transactions/TransactionSummary';
import { TransactionForm } from './transactions/TransactionForm';
import { ConfirmModal } from './ui/ConfirmModal';
import { Modal } from './ui/Modal';
import { InstallmentAnticipationModal } from './transactions/InstallmentAnticipationModal';
import { Button } from './ui/Button';
import { calculateMyExpense } from '../utils/expenseUtils';
import { shouldShowTransaction } from '../utils/transactionFilters';

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
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
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
}) => {
    const currentDate = propDate || new Date();
    const showValues = propShowValues !== undefined ? propShowValues : true;
    const onClearEditId = propOnClearEditId || (() => { });

    const [formMode, setFormMode] = useState<TransactionType | null>(modalMode ? TransactionType.EXPENSE : null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL'>('REGULAR');

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
        if (initialEditId && !editingTransaction && transactions.length > 0) {
            const txToEdit = transactions.find(t => t.id === initialEditId);
            if (txToEdit) {
                setEditingTransaction(txToEdit);
                setFormMode(txToEdit.type);
                if (onClearEditId) onClearEditId();
            }
        }
    }, [initialEditId, transactions]);

    const handleEditRequest = (t: Transaction) => {
        setEditingTransaction(t);
        setFormMode(t.type);
    };

    const handleCancelForm = () => {
        setEditingTransaction(null);
        if (!modalMode) setFormMode(null);
        if (onCancel) onCancel();
    };

    const handleSaveTransaction = (data: any, isEdit: boolean, updateFuture: boolean) => {
        if (isEdit && editingTransaction) {
            onUpdateTransaction({ ...data, id: editingTransaction.id });
            if (updateFuture) {
                // Logic for future recurrences update
                const original = editingTransaction;
                const futureTxs = transactions.filter(t =>
                    (t.seriesId === original.seriesId || (t.isRecurring && t.description === original.description)) &&
                    t.id !== original.id &&
                    new Date(t.date) > new Date(original.date)
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

    // Filter Logic
    const filteredTxs = useMemo(() => {
        return transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .filter(t => {
                const matchesDate = isSameMonth(t.date, currentDate);
                const matchesSearch = searchTerm ? t.description.toLowerCase().includes(searchTerm.toLowerCase()) : true;

                // Logic: Regular = BRL only. Travel = Foreign Currency.
                const isForeign = t.currency && t.currency !== 'BRL';

                if (activeTab === 'REGULAR') {
                    return matchesDate && matchesSearch && !isForeign;
                } else {
                    // Travel Tab: Show foreign currency transactions.
                    return matchesDate && matchesSearch && isForeign;
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, currentDate, searchTerm, activeTab]);

    const { income, expense, balance } = useMemo(() => {
        let inc = 0;
        let exp = 0;
        filteredTxs.forEach(t => {
            if (t.type === TransactionType.INCOME) inc += t.isRefund ? -t.amount : t.amount;
            else if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                exp += t.isRefund ? -myVal : myVal;
            }
        });
        return { income: inc, expense: exp, balance: inc - exp };
    }, [filteredTxs]);

    const groupedTxs = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTxs.forEach(t => {
            const dateStr = t.date;
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });
        return groups;
    }, [filteredTxs]);

    // RENDER FORM
    if (formMode) {
        return (
            <TransactionForm
                initialData={editingTransaction}
                formMode={formMode}
                setFormMode={setFormMode}
                accounts={accounts}
                trips={trips}
                familyMembers={familyMembers}
                customCategories={customCategories}
                onSave={handleSaveTransaction}
                onCancel={handleCancelForm}
                onNavigateToAccounts={onNavigateToAccounts}
                onNavigateToTrips={onNavigateToTrips}
                onNavigateToFamily={onNavigateToFamily}
            />
        );
    }

    // RENDER LIST
    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* TABS */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('REGULAR')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'REGULAR' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Transações Regulares
                </button>
                <button
                    onClick={() => setActiveTab('TRAVEL')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Viagens Internacionais
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-400 dark:text-slate-300 ml-2" />
                <input
                    type="text"
                    placeholder="Buscar transações..."
                    className="flex-1 outline-none text-sm font-medium text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-300 h-10 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* MONTHLY SUMMARY */}
            <TransactionSummary income={income} expense={expense} balance={balance} showValues={showValues} />

            {/* TRANSACTION LIST */}
            <TransactionList
                groupedTxs={groupedTxs}
                accounts={accounts}
                familyMembers={familyMembers}
                showValues={showValues}
                onEdit={handleEditRequest}
                onDelete={handleDeleteRequest}
                onAddClick={() => setFormMode(TransactionType.EXPENSE)}
            />

            {deleteModal.isOpen && (
                deleteModal.isSeries ? (
                    <Modal
                        isOpen={true}
                        onClose={() => setDeleteModal({ isOpen: false, id: null, isSeries: false })}
                        title="Excluir Transação Recorrente"
                    >
                        <div className="space-y-6">
                            <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                                <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Atenção!</h4>
                                    <p className="text-sm text-amber-800 dark:text-amber-400">
                                        Esta transação faz parte de uma série (parcelada ou recorrente). Como deseja prosseguir?
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => confirmDelete('SINGLE')}
                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                                >
                                    <div className="text-left">
                                        <span className="block font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Apenas esta transação</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Exclui somente o registro atual.</span>
                                    </div>
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-indigo-500" />
                                </button>

                                <button
                                    onClick={() => confirmDelete('SERIES')}
                                    className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all group"
                                >
                                    <div className="text-left">
                                        <span className="block font-bold text-red-700 dark:text-red-400">Todas da série</span>
                                        <span className="text-xs text-red-600/80 dark:text-red-400/80">Exclui esta e todas as outras relacionadas (parcelas/futuras).</span>
                                    </div>
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </button>
                            </div>

                            <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, id: null, isSeries: false })} className="w-full">
                                Cancelar
                            </Button>
                        </div>
                    </Modal>
                ) : (
                    <ConfirmModal
                        isOpen={deleteModal.isOpen}
                        title="Excluir Transação"
                        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                        onConfirm={() => confirmDelete('SINGLE')}
                        onCancel={() => setDeleteModal({ isOpen: false, id: null, isSeries: false })}
                        isDanger
                    />
                )
            )}

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