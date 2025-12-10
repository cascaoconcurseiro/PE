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
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction?: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onNavigateToTrips: () => void;
}

export const Shared: React.FC<SharedProps> = ({
    transactions,
    trips,
    members,
    accounts,
    currentDate,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    onNavigateToTrips
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

    const handleConfirmSettlement = (accountId: string, method: 'SAME_CURRENCY' | 'CONVERT', exchangeRate?: number, date?: string) => {
        if (!settleModal.memberId) return;
        if (settleModal.type !== 'OFFSET' && !accountId) return;

        const settlementDate = date || new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        const settledAtISO = new Date(settlementDate).toISOString();

        const isConverting = method === 'CONVERT';
        const rate = isConverting && exchangeRate ? exchangeRate : 1;
        const finalAmount = settleModal.total * rate;

        // 1. Transaction Record (Money Movement)
        if (settleModal.type !== 'OFFSET') {
            const desc = settleModal.type === 'PAY'
                ? `Pagamento Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`
                : `Recebimento Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`;

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

        // 2. Settle Original Items
        settleModal.items.forEach(item => {
            const originalTx = transactions.find(t => t.id === item.originalTxId);
            if (originalTx) {
                // If it's a split (CREDIT), mark THAT split as settled.
                if (item.type === 'CREDIT' && originalTx.sharedWith) {
                    const updatedSplits = originalTx.sharedWith.map(s => {
                        if (s.memberId === item.memberId) return { ...s, isSettled: true, settledAt: settledAtISO };
                        return s;
                    });
                    onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
                } else {
                    // If it's a DEBIT (Main TX), mark main as Settled? 
                    // Careful: If I paid 100, and shared 50 with Fran. 
                    // Fran owes me 50. When Fran pays me 50, "DEBIT" item is settled.
                    // The main TX (100) is already Paid (by me).
                    // So we are marking the "Receivable" as settled.
                    // Implementation: We don't have a separate table for receivables. 
                    // We check `isSettled` on the transaction? 
                    // If type is DEBIT, it means *I* am the payer, and *Shared Member* is the participant.
                    // The "Item" in filter is constructed from the split.
                    // So we should find the split for the Member and mark IT as settled?
                    // Actually, for DEBIT: it means I paid, they owe me.
                    // The split is `sharedWith: [{memberId: 'Fran', ...}]`.
                    // So YES, we settle the split in sharedWith.
                    if (originalTx.sharedWith) {
                        const updatedSplits = originalTx.sharedWith.map(s => {
                            if (s.memberId === item.memberId) return { ...s, isSettled: true, settledAt: settledAtISO };
                            return s;
                        });
                        onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
                    }
                }
            }
        });

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0, currency: 'BRL' });
    };

    const handleBulkDelete = (ids: string[]) => {
        if (!onDeleteTransaction) return;
        if (confirm(`Tem certeza que deseja excluir ${ids.length} itens?`)) {
            ids.forEach(id => onDeleteTransaction(id, 'SINGLE'));
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
                    const items = getFilteredInvoice(member.id);

                    return (
                        <SharedMemberDetail
                            key={member.id}
                            member={member}
                            items={items}
                            currentDate={currentDate}
                            showValues={true} // Using global setting? Should pass prop or assume true for detail view? Using true for now or access context.
                            currency="BRL" // Default to BRL for now, improved logic would detect mix
                            onSettle={(type, amount) => handleOpenSettleModal(member.id, type, 'BRL')}
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
                        />
                    );
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
                    txs.forEach(t => onAddTransaction(t));
                    setIsImportModalOpen(false);
                }}
                members={members}
                accounts={accounts}
                currentUserId="me"
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