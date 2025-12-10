import React, { useState, useMemo } from 'react';
import { Transaction, Trip, FamilyMember, TransactionType, Account, SyncStatus, Category, InvoiceItem } from '../types';
import { SharedInstallmentImport } from './shared/SharedInstallmentImport';
import { useSharedFinances } from '../hooks/useSharedFinances';
import { MemberSummaryCard } from './shared/MemberSummaryCard';
import { SettlementModal } from './shared/SettlementModal';
import { SharedFilters } from './shared/SharedFilters';
import { SharedInstallmentEditModal } from './shared/SharedInstallmentEditModal';
import { TransactionDeleteModal } from './transactions/TransactionDeleteModal';

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
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL'>('REGULAR');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Edit & Delete State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

    // Use Custom Hook for Calculation Logic
    const { getFilteredInvoice, getTotals } = useSharedFinances({
        transactions,
        members,
        currentDate,
        activeTab
    });

    const displayMembers = useMemo(() => {
        const uniqueIds = new Set([...members.map(m => m.id)]); // Assuming all members are passed in props
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

        // Validation handled in Modal, but good to check
        if (settleModal.type !== 'OFFSET' && !accountId) return;

        const settlementDate = date || new Date().toISOString().split('T')[0];
        // Ensure we preserve the time part if we want, or just T12:00:00 to avoid timezone shifts
        // For settlementAt, ISO string is fine.
        const now = new Date().toISOString();
        const settledAtISO = new Date(settlementDate).toISOString();

        const isConverting = method === 'CONVERT';
        const rate = isConverting && exchangeRate ? exchangeRate : 1;
        const finalAmount = settleModal.total * rate;

        // 1. Transaction Record (Money Movement)
        if (settleModal.type !== 'OFFSET') {
            if (settleModal.type === 'PAY') {
                onAddTransaction({
                    amount: finalAmount,
                    description: `Pagamento Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
                    date: settlementDate, // ✅ Use selected date
                    type: TransactionType.EXPENSE,
                    category: Category.TRANSFER,
                    accountId: accountId,
                    destinationAccountId: 'EXTERNAL',
                    isShared: false,
                    relatedMemberId: settleModal.memberId!,
                    exchangeRate: isConverting ? rate : undefined,
                    currency: isConverting ? 'BRL' : settleModal.currency,
                    createdAt: now,
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING
                });
            } else {
                onAddTransaction({
                    amount: finalAmount,
                    description: `Recebimento Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
                    date: settlementDate, // ✅ Use selected date
                    type: TransactionType.INCOME,
                    category: Category.INCOME,
                    accountId: accountId,
                    isShared: false,
                    relatedMemberId: settleModal.memberId!,
                    exchangeRate: isConverting ? rate : undefined,
                    currency: isConverting ? 'BRL' : settleModal.currency,
                    createdAt: now,
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING
                });
            }
        }

        // 2. Settle Original Items
        settleModal.items.forEach(item => {
            const originalTx = transactions.find(t => t.id === item.originalTxId);
            if (originalTx) {
                if (item.type === 'CREDIT') {
                    const updatedSplits = originalTx.sharedWith?.map(s => {
                        if (s.memberId === item.memberId) return { ...s, isSettled: true, settledAt: settledAtISO };
                        return s;
                    });
                    onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
                } else {
                    onUpdateTransaction({ ...originalTx, isSettled: true, settledAt: settledAtISO });
                }
            }
        });

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0, currency: 'BRL' });
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
                    const items = getFilteredInvoice(member.id);
                    const totalsMap = getTotals(items);

                    return (
                        <MemberSummaryCard
                            key={member.id}
                            member={member}
                            items={items}
                            totalsMap={totalsMap}
                            trips={trips}
                            onOpenSettleModal={handleOpenSettleModal}
                            onEditClick={(txId) => {
                                const tx = transactions.find(t => t.id === txId);
                                if (tx) setEditingTransaction(tx);
                            }}
                            onDeleteClick={(txId) => {
                                const tx = transactions.find(t => t.id === txId);
                                if (tx) {
                                    setTransactionToDelete(tx);
                                    setIsDeleteModalOpen(true);
                                }
                            }}
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
                    onDeleteTransaction={(id, scope) => {
                        // Forward to Delete Modal Logic
                        const txStr = transactions.find(t => t.id === id);
                        if (txStr) {
                            setTransactionToDelete(txStr);
                            setIsDeleteModalOpen(true);
                            // Do NOT close editingTransaction here, wait for delete confirm? 
                            // Usually better to close edit modal when opening delete modal
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
                            if (scope === 'SERIES' && transactionToDelete.seriesId) {
                                // Delete All in Series
                                onDeleteTransaction(transactionToDelete.id, 'SERIES');
                            } else {
                                // Delete Single
                                onDeleteTransaction(transactionToDelete.id, 'SINGLE');
                            }
                        }
                        setIsDeleteModalOpen(false);
                        setTransactionToDelete(null);
                    }}
                />
            )}
        </div >
    );
};