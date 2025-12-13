import React, { useState, useMemo } from 'react';
import { Transaction, Trip, FamilyMember, Account, TransactionType, Category, SyncStatus, InvoiceItem } from '../types';
import { useSharedFinances } from '../hooks/useSharedFinances';
import { SharedFilters } from './shared/SharedFilters';
import { SettlementModal } from './shared/SettlementModal';
import { SharedInstallmentImport } from './shared/SharedInstallmentImport';
import { SharedInstallmentEditModal } from './shared/SharedInstallmentEditModal';
import { TransactionDeleteModal } from './transactions/TransactionDeleteModal';
import { SharedMemberDetail } from './shared/SharedMemberDetail';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
    currentDate: Date;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onAddTransactions?: (ts: Omit<Transaction, 'id'>[]) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onBatchUpdateTransactions?: (ts: Transaction[]) => void;
    onDeleteTransaction?: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onNavigateToTrips: () => void;
    currentUserName?: string;
}

export const Shared: React.FC<SharedProps> = ({
    transactions,
    trips,
    members,
    accounts,
    currentDate,
    onAddTransaction,
    onAddTransactions,
    onUpdateTransaction,
    onBatchUpdateTransactions,
    onDeleteTransaction,
    onNavigateToTrips,
    currentUserName
}) => {
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL' | 'HISTORY'>('REGULAR');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Edit & Delete State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

    // Bulk Delete State
    const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

    // Use Custom Hook for Calculation Logic
    const { getFilteredInvoice, getTotals } = useSharedFinances({
        transactions,
        members,
        currentDate,
        activeTab
    });

    const displayMembers = useMemo(() => {
        return members;
    }, [members]);

    // Settlement State
    const [settleModal, setSettleModal] = useState<{
        isOpen: boolean,
        memberId: string | null,
        type: 'PAY' | 'RECEIVE' | 'OFFSET',
        items: InvoiceItem[],
        total: number,
        currency: string
    }>({
        isOpen: false, memberId: null, type: 'PAY', items: [], total: 0, currency: 'BRL'
    });

    const handleOpenSettleModal = (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => {
        const allItems = getFilteredInvoice(memberId);
        // Only settle UNPAID items
        const items = allItems.filter(i => !i.isPaid && (i.currency || 'BRL') === currency);

        const totals = getTotals(items);
        const net = totals[currency]?.net || 0;

        setSettleModal({
            isOpen: true,
            memberId,
            type,
            items,
            total: type === 'OFFSET' ? 0 : Math.abs(net),
            currency
        });
    };

    const handleConfirmSettlement = (accountId: string, method: 'SAME_CURRENCY' | 'CONVERT', exchangeRate?: number, date?: string, customAmount?: number) => {
        if (!settleModal.memberId) return;
        if (settleModal.type !== 'OFFSET' && !accountId) return;

        const settlementDate = date || new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        const settledAtISO = new Date(settlementDate).toISOString();

        const isConverting = method === 'CONVERT';
        const rate = isConverting && exchangeRate ? exchangeRate : 1;

        // Use custom amount for partial settlements, otherwise full amount
        const baseAmount = customAmount !== undefined ? customAmount : settleModal.total;
        const finalAmount = baseAmount * rate;
        const isPartialSettlement = customAmount !== undefined && customAmount < settleModal.total;

        // 1. Transaction Record (Money Movement)
        if (settleModal.type !== 'OFFSET') {
            const memberName = members.find(m => m.id === settleModal.memberId)?.name;
            const desc = settleModal.type === 'PAY'
                ? `Pagamento ${isPartialSettlement ? 'Parcial ' : ''}Acerto - ${memberName}`
                : `Recebimento ${isPartialSettlement ? 'Parcial ' : ''}Acerto - ${memberName}`;

            onAddTransaction({
                amount: finalAmount,
                description: desc,
                date: settlementDate,
                type: settleModal.type === 'PAY' ? TransactionType.EXPENSE : TransactionType.INCOME,
                category: settleModal.type === 'PAY' ? Category.TRANSFER : Category.INCOME,
                accountId: accountId,
                destinationAccountId: settleModal.type === 'PAY' ? 'EXTERNAL' : undefined,
                isShared: false,
                relatedMemberId: settleModal.memberId!,
                exchangeRate: isConverting ? rate : undefined,
                currency: isConverting ? 'BRL' : settleModal.currency,
                createdAt: now,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING
            });
        }

        // 2. Settle Original Items (only if FULL settlement, not partial)
        // For partial, we just record the payment but don't mark items as settled
        if (!isPartialSettlement) {
            const txsToUpdate: Transaction[] = [];

            settleModal.items.forEach(item => {
                const originalTx = transactions.find(t => t.id === item.originalTxId);
                if (originalTx) {
                    const settledDate = settledAtISO;

                    // CASE 1: CREDIT (I paid, they owe me) - Update Specific Split
                    if (item.type === 'CREDIT' && originalTx.sharedWith) {
                        const updatedSplits = originalTx.sharedWith.map(s => {
                            if (s.memberId === item.memberId) return { ...s, isSettled: true, settledAt: settledDate };
                            return s;
                        });
                        txsToUpdate.push({ ...originalTx, sharedWith: updatedSplits });
                    }
                    // CASE 2: DEBIT (They paid, I owe them) - Update My Debt (Main Transaction OR Split Logic?)
                    // Logic from useSharedFinances: 
                    // - CREDIT comes from 'sharedWith' splits (others owe me).
                    // - DEBIT comes from 'myShare' (remainder) OR explicit split?
                    // Actually, DEBIT items in useSharedFinances are generated when "Other Paid -> I Owe".
                    // The "I Owe" part is represented by the transaction itself (if I am not the payer).
                    // So we MUST mark the transaction as settled.
                    // Fix: Always update isSettled on main tx for DEBIT items.
                    else if (item.type === 'DEBIT') {
                        txsToUpdate.push({ ...originalTx, isSettled: true, settledAt: settledDate });
                    }
                }
            });

            if (txsToUpdate.length > 0) {
                if (onBatchUpdateTransactions) {
                    onBatchUpdateTransactions(txsToUpdate);
                } else {
                    txsToUpdate.forEach(t => onUpdateTransaction(t));
                }
            }
        }

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0, currency: 'BRL' });
    };

    const handleBulkDelete = (ids: string[]) => {
        if (!onDeleteTransaction) return;
        if (confirm(`Tem certeza que deseja excluir ${ids.length} itens?`)) {
            ids.forEach(id => onDeleteTransaction(id, 'SINGLE'));
        }
    };

    const handleUndoSettlement = (item: InvoiceItem) => {
        if (!confirm('Deseja desfazer o acerto deste item? Ele voltará a aparecer como pendente.')) return;

        const originalTx = transactions.find(t => t.id === item.originalTxId);
        if (!originalTx) return;

        // If it has sharedWith, unsettle the specific split
        if (originalTx.sharedWith && originalTx.sharedWith.length > 0) {
            const updatedSplits = originalTx.sharedWith.map(s => {
                if (s.memberId === item.memberId) {
                    return { ...s, isSettled: false, settledAt: undefined };
                }
                return s;
            });
            onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
        } else {
            // Unsettle the transaction itself
            onUpdateTransaction({ ...originalTx, isSettled: false, settledAt: undefined });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            <SharedFilters
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenImport={() => setIsImportModalOpen(true)}
            />

            <div className="space-y-6">
                {displayMembers.map(member => {
                    // Filter items for this view (Month + Tab)
                    const memberItems = getFilteredInvoice(member.id);

                    // Group items by currency
                    const itemsByCurrency: Record<string, InvoiceItem[]> = {};
                    memberItems.forEach(item => {
                        const curr = item.currency || 'BRL';
                        if (!itemsByCurrency[curr]) itemsByCurrency[curr] = [];
                        itemsByCurrency[curr].push(item);
                    });

                    // Ensure at least BRL shows up if empty (or handle empty state)
                    const currencies = Object.keys(itemsByCurrency);
                    if (currencies.length === 0) currencies.push('BRL');

                    return currencies.map(currency => {
                        const items = itemsByCurrency[currency] || [];

                        // Detect trip from items
                        // If all items belong to same trip, use that name. 
                        // If mixed trips, say 'Múltiplas Viagens' or just list items.
                        // Assuming items in a currency bucket for a period usually belong to one context or none.
                        const tripIds = Array.from(new Set(items.map(i => i.tripId).filter(Boolean)));
                        let tripName = undefined;
                        if (tripIds.length === 1) {
                            tripName = trips.find(t => t.id === tripIds[0])?.name;
                        } else if (tripIds.length > 1) {
                            tripName = 'Múltiplas Viagens';
                        }

                        return (
                            <SharedMemberDetail
                                key={`${member.id}-${currency}`}
                                member={member}
                                items={items}
                                currentDate={currentDate}
                                showValues={true}
                                currency={currency}
                                tripName={tripName}
                                onSettle={(type, amount) => handleOpenSettleModal(member.id, type, currency)}
                                onBulkSettle={(items) => {
                                    // Calculate net of selected items
                                    let net = 0;
                                    items.forEach(i => {
                                        if (i.type === 'DEBIT') net -= i.amount;
                                        else net += i.amount;
                                    });

                                    const type = net > 0 ? 'RECEIVE' : 'PAY';
                                    const absTotal = Math.abs(net);

                                    setSettleModal({
                                        isOpen: true,
                                        memberId: member.id,
                                        type,
                                        items: items,
                                        total: absTotal,
                                        currency
                                    });
                                }}
                                allowIndividualSettlement={activeTab === 'TRAVEL'}
                                onImport={() => setIsImportModalOpen(true)}
                                onEditTransaction={(id) => {
                                    const tx = transactions.find(t => t.id === id);
                                    if (tx) setEditingTransaction(tx);
                                }}
                                onDeleteTransaction={(id) => {
                                    const tx = transactions.find(t => t.id === id);
                                    if (tx) {
                                        setTransactionToDelete(tx);
                                        setIsDeleteModalOpen(true);
                                    }
                                }}
                                onBulkDelete={handleBulkDelete}
                                onUndoSettlement={handleUndoSettlement}
                            />
                        );
                    });
                })}
            </div>

            <SettlementModal
                isOpen={settleModal.isOpen}
                onClose={() => setSettleModal(prev => ({ ...prev, isOpen: false }))}
                settleData={settleModal}
                accounts={accounts}
                onConfirm={handleConfirmSettlement}
            />

            <SharedInstallmentImport
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={(txs) => {
                    if (onAddTransactions) {
                        onAddTransactions(txs);
                    } else {
                        txs.forEach(t => onAddTransaction(t));
                    }
                    setIsImportModalOpen(false);
                }}
                members={members}
                accounts={accounts}
                currentUserId="me"
                currentUserName={currentUserName}
            />

            {editingTransaction && (
                <SharedInstallmentEditModal
                    isOpen={!!editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    transaction={editingTransaction}
                    allTransactions={transactions}
                    accounts={accounts}
                    members={members}
                    onUpdateTransaction={onUpdateTransaction}
                    onAddTransaction={onAddTransaction}
                    onDeleteTransaction={(id, scope) => {
                        const txStr = transactions.find(t => t.id === id);
                        if (txStr) {
                            setTransactionToDelete(txStr);
                            setIsDeleteModalOpen(true);
                            setEditingTransaction(null);
                        }
                    }}
                />
            )}

            {transactionToDelete && (
                <TransactionDeleteModal
                    isOpen={isDeleteModalOpen}
                    isSeries={!!transactionToDelete.seriesId}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        setTransactionToDelete(null);
                    }}
                    onConfirm={(scope) => {
                        if (onDeleteTransaction && transactionToDelete) {
                            onDeleteTransaction(transactionToDelete.id, scope);
                        }
                        setIsDeleteModalOpen(false);
                        setTransactionToDelete(null);
                    }}
                />
            )}
        </div >
    );
};