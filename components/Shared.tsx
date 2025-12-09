import React, { useState, useEffect, useMemo } from 'react';
import { SharedRequests } from './shared/SharedRequests';
import { supabase } from '../integrations/supabase/client';
import { Transaction, Trip, FamilyMember, Account, TransactionType, Category, SyncStatus, InvoiceItem } from '../types';
import { useSharedFinances } from '../hooks/useSharedFinances';
import { MemberSummaryCard } from './shared/MemberSummaryCard';
import { SharedFilters } from './shared/SharedFilters';
import { SettlementModal } from './shared/SettlementModal';
import { SharedInstallmentImport } from './shared/SharedInstallmentImport';
import { SharedInstallmentEditModal } from './shared/SharedInstallmentEditModal';

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

    const handleConfirmSettlement = (accountId: string, method: 'SAME_CURRENCY' | 'CONVERT', exchangeRate?: number) => {
        if (!settleModal.memberId) return;

        // Validation handled in Modal, but good to check
        if (settleModal.type !== 'OFFSET' && !accountId) return;

        const now = new Date().toISOString();
        const isConverting = method === 'CONVERT';
        const rate = isConverting && exchangeRate ? exchangeRate : 1;
        const finalAmount = settleModal.total * rate;

        // 1. Transaction Record (Money Movement)
        if (settleModal.type !== 'OFFSET') {
            if (settleModal.type === 'PAY') {
                onAddTransaction({
                    amount: finalAmount,
                    description: `Pagamento Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
                    date: now.split('T')[0],
                    type: TransactionType.TRANSFER,
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
                    date: now.split('T')[0],
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
                        if (s.memberId === item.memberId) return { ...s, isSettled: true, settledAt: now };
                        return s;
                    });
                    onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
                } else {
                    onUpdateTransaction({ ...originalTx, isSettled: true, settledAt: now });
                }
            }
        });

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0, currency: 'BRL' });
    };

    const handleEditTransaction = (txId: string) => {
        setEditModalTxId(txId);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {currentUser && <SharedRequests currentUserId={currentUser.id} onStatusChange={() => window.location.reload()} />}

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