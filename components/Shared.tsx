
import React, { useState, useEffect, useMemo } from 'react';
import { Users, DollarSign, TrendingUp, ArrowRight, Wallet, Download } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils';
import { Transaction, Trip, FamilyMember, Account, InvoiceItem, Category, TransactionType, SyncStatus } from '../types';
import { useSharedFinances } from '../hooks/useSharedFinances';
import { supabase } from '../integrations/supabase/client';
import { SharedRequests } from './shared/SharedRequests';
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

    const handleEditTransaction = (txId: string) => {
        setEditModalTxId(txId);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                        Espaço Compartilhado
                    </h1>
                </div>
            </div>

            {/* Removed Sync Features (Requests/Settlements) as requested */}

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
                            // @ts-ignore - Settlement functions handled internally or removed
                            onOpenSettleModal={() => { }} // Disabled
                            onDeleteTransaction={onDeleteTransaction}
                            onEditTransaction={handleEditTransaction}
                            outgoingStatus={{}} // Disabled
                            onResendRequest={() => { }} // Disabled
                        />
                    );
                })}
            </div>

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