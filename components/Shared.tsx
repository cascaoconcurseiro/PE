
import React, { useState, useEffect, useMemo } from 'react';
import { Users, DollarSign, TrendingUp, ArrowRight, Wallet, Download } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils';
import { Transaction, Trip, FamilyMember, Account, InvoiceItem, Category, TransactionType, SyncStatus } from '../types';
import { useSharedFinances } from '../hooks/useSharedFinances';
import { supabase } from '../integrations/supabase/client';
import { SettlementModal } from './shared/SettlementModal';
import { SharedInstallmentImport } from './shared/SharedInstallmentImport';
import { SharedInstallmentEditModal } from './shared/SharedInstallmentEditModal';
import { MemberSummaryCard } from './shared/MemberSummaryCard';
import { SharedFilters } from './shared/SharedFilters';
import { useToast } from './ui/Toast';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
    currentDate: Date;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
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

    // Edit Modal State
    const [editModalTxId, setEditModalTxId] = useState<string | null>(null);
    const editTransaction = editModalTxId ? transactions.find(t => t.id === editModalTxId) : null;

    // Local Settlement State (Lightweight)
    const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
    const [settlementDefaults, setSettlementDefaults] = useState<{ memberId?: string, amount?: number, currency?: string, mode?: 'PAY' | 'CHARGE' }>({});

    // Use Custom Hook for Calculation Logic
    const { getFilteredInvoice, getTotals } = useSharedFinances({
        transactions,
        members,
        currentDate,
        activeTab
    });

    const displayMembers = useMemo(() => {
        const uniqueIds = new Set([...members.map(m => m.id)]);
        return members;
    }, [members]);

    const handleOpenSettleModal = (memberId: string, mode: 'PAY' | 'CHARGE', currency: string) => {
        const allItems = getFilteredInvoice(memberId);
        const items = allItems.filter(i => !i.isPaid && (i.currency || 'BRL') === currency);
        const totals = getTotals(items);
        const net = totals[currency]?.net || 0;

        setSettlementDefaults({
            memberId,
            amount: Math.abs(net),
            currency,
            mode
        });
        setIsSettlementModalOpen(true);
    };

    const handleEditTransaction = (txId: string) => {
        setEditModalTxId(txId);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header Removed as requested */}

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
                            onDeleteTransaction={onDeleteTransaction}
                            onEditTransaction={handleEditTransaction}
                        />
                    );
                })}
            </div>

            <SettlementModal
                isOpen={isSettlementModalOpen}
                onClose={() => setIsSettlementModalOpen(false)}
                familyMembers={members}
                accounts={accounts}
                currentUserId="me"
                preSelectedMemberId={settlementDefaults.memberId}
                suggestedAmount={settlementDefaults.amount}
                suggestedCurrency={settlementDefaults.currency}
                mode={settlementDefaults.mode}
                pendingItems={settlementDefaults.memberId ? getFilteredInvoice(settlementDefaults.memberId) : []}
                onSettle={async (paymentTx, settledItemIds) => {
                    // 1. Create Payment Transaction
                    onAddTransaction(paymentTx);

                    // 2. Update Settled Items
                    if (settledItemIds.length > 0) {
                        try {
                            const { addToast } = useToast();

                            for (const item of settledItemIds) {
                                // Find the original transaction
                                const originalTx = transactions.find(t => t.id === item.originalTxId);
                                if (!originalTx) continue;

                                if (item.isSplit) { // CREDIT - Update Split (They owe me)
                                    const updatedSplits = originalTx.sharedWith?.map(s => {
                                        // We need to match the memberId. The 'item' has originalTxId, 
                                        // but we also know the memberId from context or we should verify.
                                        // However, the InvoiceItem structure makes it easy:
                                        // We are in Shared context, assuming we are settling for 'settlementDefaults.memberId'
                                        if (s.memberId === settlementDefaults.memberId) {
                                            return { ...s, isSettled: true, settledAt: new Date().toISOString() };
                                        }
                                        return s;
                                    });

                                    // DB Update
                                    const { error } = await supabase
                                        .from('transactions')
                                        .update({ shared_with: updatedSplits })
                                        .eq('id', originalTx.id);

                                    if (error) throw error;

                                    // UI Update
                                    onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });

                                } else { // DEBIT - Update Main (I owe them)
                                    // DB Update
                                    const { error } = await supabase
                                        .from('transactions')
                                        .update({ is_settled: true, settled_at: new Date().toISOString() })
                                        .eq('id', originalTx.id);

                                    if (error) throw error;

                                    // UI Update
                                    onUpdateTransaction({ ...originalTx, isSettled: true, settledAt: new Date().toISOString() });
                                }
                            }
                            // toast({ title: "Sucesso", description: `${settledItemIds.length} itens foram baixados com sucesso.` });
                        } catch (error) {
                            console.error("Erro ao liquidar itens:", error);
                        }
                    }
                }}
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

            {/* Edit Installment Modal */}
            {editTransaction && (
                <SharedInstallmentEditModal
                    isOpen={!!editModalTxId}
                    onClose={() => setEditModalTxId(null)}
                    transaction={editTransaction}
                    allTransactions={transactions}
                    accounts={accounts}
                    members={members}
                    onUpdateTransaction={onUpdateTransaction}
                    onDeleteTransaction={onDeleteTransaction}
                />
            )}
        </div >
    );
};