
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
                onAddTransaction={onAddTransaction}
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