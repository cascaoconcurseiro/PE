
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
    const [outgoingRequests, setOutgoingRequests] = useState<Record<string, string>>({}); // txId -> Status
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const fetchUserAndRequests = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);
                // Fetch status of requests sent BY me
                const { data } = await supabase
                    .from('shared_transaction_requests')
                    .select('transaction_id, status')
                    .eq('requester_id', user.id);

                if (data) {
                    const map: Record<string, string> = {};
                    data.forEach(r => map[r.transaction_id] = r.status);
                    setOutgoingRequests(map);
                }
            }
        };
        fetchUserAndRequests();
    }, []);

    const handleResendRequest = async (txId: string, memberId: string) => {
        // Logic to resend (create new pending request)
        if (!currentUser) return;

        // Find member email
        const member = members.find(m => m.id === memberId);
        if (!member?.email) {
            alert("Este membro não possui e-mail cadastrado.");
            return;
        }

        try {
            // Check if user exists (Frontend check using RPC or just insert and let logic handle? 
            // Plan said RPC. Let's try direct insert first, or use the RPC if accessible. 
            // For now, simpler: Insert new request.

            // First check if user exists to be safe/clean
            const { data: inviteeId, error: checkError } = await supabase.rpc('check_user_by_email', { email_to_check: member.email });

            if (!inviteeId) {
                alert("Usuário com este e-mail não encontrado no sistema.");
                return;
            }

            const { error } = await supabase.from('shared_transaction_requests').insert({
                transaction_id: txId,
                requester_id: currentUser.id,
                invited_email: member.email,
                invited_user_id: inviteeId,
                status: 'PENDING'
            });

            if (error) throw error;

            alert("Solicitação reenviada com sucesso!");
            setOutgoingRequests(prev => ({ ...prev, [txId]: 'PENDING' }));

        } catch (e) {
            console.error("Erro ao reenviar:", e);
            alert("Erro ao reenviar solicitação.");
        }
    };

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
        const uniqueIds = new Set([...members.map(m => m.id)]); // Assuming all members are passed in props
        return members;
    }, [members]);

    // Simplified State for New Settlement Modal
    const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
    const [settlementDefaults, setSettlementDefaults] = useState<{ memberId?: string, amount?: number, currency?: string }>({});

    const handleOpenSettleModal = (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => {
        // We only support 'PAY' flow via the new Request system clearly now.
        // 'RECEIVE' is handled by the payer doing the action.
        // 'OFFSET' is complex, let's stick to simple payment for now as requested.
        const allItems = getFilteredInvoice(memberId);
        const items = allItems.filter(i => !i.isPaid && (i.currency || 'BRL') === currency);
        const totals = getTotals(items);
        const net = totals[currency]?.net || 0;

        setSettlementDefaults({
            memberId,
            amount: Math.abs(net),
            currency
        });
        setIsSettlementModalOpen(true);
    };

    const handleEditTransaction = (txId: string) => {
        setEditModalTxId(txId);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header with Global Pay Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                        Espaço Compartilhado
                    </h1>
                </div>
            </div>

            {currentUser && <SharedRequests currentUserId={currentUser.id} accounts={accounts} onStatusChange={() => window.location.reload()} />}

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
                            outgoingStatus={outgoingRequests}
                            onResendRequest={handleResendRequest}
                        />
                    );
                })}
            </div>

            {currentUser && (
                <SettlementModal
                    isOpen={isSettlementModalOpen}
                    onClose={() => setIsSettlementModalOpen(false)}
                    familyMembers={members}
                    accounts={accounts}
                    currentUserId={currentUser.id}
                    preSelectedMemberId={settlementDefaults.memberId}
                    suggestedAmount={settlementDefaults.amount}
                    suggestedCurrency={settlementDefaults.currency}
                    onAddTransaction={onAddTransaction}
                />
            )}

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