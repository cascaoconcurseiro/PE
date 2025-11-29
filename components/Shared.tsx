import React, { useState, useMemo } from 'react';
import { Transaction, Trip, FamilyMember, TransactionType, Account, SyncStatus } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Users, Home, Plane, ArrowRight, AlertCircle, Calendar, Wallet, CheckCircle2, Sparkles, ChevronDown } from 'lucide-react';
import { formatCurrency, isSameMonth } from '../utils';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
    currentDate: Date; // Added global date prop
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onNavigateToTrips: () => void;
}

// Helper Type for Invoice Items
interface InvoiceItem {
    id: string; // Unique composition (txId + type)
    originalTxId: string;
    description: string;
    date: string;
    category: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT'; // CREDIT = They owe Me, DEBIT = I owe Them
    isPaid: boolean;
    tripId?: string;
    memberId: string; // The specific member this relates to
}

export const Shared: React.FC<SharedProps> = ({ 
    transactions, 
    trips, 
    members, 
    accounts, 
    currentDate,
    onAddTransaction, 
    onUpdateTransaction, 
    onNavigateToTrips 
}) => {
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL'>('REGULAR');
    const [settleModal, setSettleModal] = useState<{ isOpen: boolean, memberId: string | null, type: 'PAY' | 'RECEIVE' | 'OFFSET', items: InvoiceItem[], total: number }>({
        isOpen: false, memberId: null, type: 'PAY', items: [], total: 0
    });
    const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');

    // --- ENGINE: GENERATE INVOICES ---
    const invoices = useMemo(() => {
        const invoiceMap: Record<string, InvoiceItem[]> = {};
        
        // Initialize for all known members to ensure empty state exists
        members.forEach(m => invoiceMap[m.id] = []);

        transactions.forEach(t => {
            // Check if it's an expense AND (marked shared OR has splits)
            const isSharedExpense = t.type === TransactionType.EXPENSE && (t.isShared || (t.sharedWith && t.sharedWith.length > 0));
            
            if (!isSharedExpense) return;

            // 1. CREDIT LOGIC: User Paid (payerId undefined), Others Owe User
            if (!t.payerId) {
                t.sharedWith?.forEach(split => {
                    const memberId = split.memberId;
                    
                    if (!invoiceMap[memberId]) invoiceMap[memberId] = [];

                    invoiceMap[memberId].push({
                        id: `${t.id}-credit-${memberId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: split.assignedAmount,
                        type: 'CREDIT', // They owe me
                        isPaid: !!split.isSettled,
                        tripId: t.tripId,
                        memberId: memberId
                    });
                });
            } 
            // 2. DEBIT LOGIC: Member Paid (payerId exists), User Owes Member
            else {
                const payerId = t.payerId;
                
                if (!invoiceMap[payerId]) invoiceMap[payerId] = [];

                // Calculate My Share
                const totalSplits = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                const myShare = t.amount - totalSplits;

                if (myShare > 0.01) {
                    invoiceMap[payerId].push({
                        id: `${t.id}-debit-${payerId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: myShare,
                        type: 'DEBIT', // I owe them
                        isPaid: !!t.isSettled, // Tracking settlement on the main tx record for my debt
                        tripId: t.tripId,
                        memberId: payerId
                    });
                }
            }
        });

        return invoiceMap;
    }, [transactions, members]);

    // Build a comprehensive list of members to display
    const displayMembers = useMemo(() => {
        const uniqueIds = new Set([...members.map(m => m.id), ...Object.keys(invoices)]);
        return Array.from(uniqueIds).map(id => {
            const knownMember = members.find(m => m.id === id);
            return knownMember || { id, name: 'Membro Desconhecido', role: 'Unknown' } as FamilyMember;
        });
    }, [members, invoices]);

    // --- FILTERING ---
    const getFilteredInvoice = (memberId: string) => {
        const allItems = invoices[memberId] || [];
        
        if (activeTab === 'TRAVEL') {
            return allItems.filter(i => !!i.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            // Regular: No trip ID. Show pending always, paid only for selected month
            return allItems.filter(i => 
                !i.tripId && 
                (!i.isPaid || isSameMonth(i.date, currentDate)) // Use global currentDate
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    };

    // --- CALCULATIONS ---
    const getTotals = (items: InvoiceItem[]) => {
        const credits = items.filter(i => i.type === 'CREDIT' && !i.isPaid).reduce((acc, i) => acc + i.amount, 0);
        const debits = items.filter(i => i.type === 'DEBIT' && !i.isPaid).reduce((acc, i) => acc + i.amount, 0);
        const net = credits - debits;
        return { credits, debits, net };
    };

    const handleOpenSettleModal = (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET') => {
        const items = getFilteredInvoice(memberId).filter(i => !i.isPaid);
        const totals = getTotals(items);
        
        setSettleModal({
            isOpen: true,
            memberId,
            type,
            items,
            total: type === 'OFFSET' ? 0 : Math.abs(totals.net)
        });
    };

    const handleConfirmSettlement = () => {
        if (!settleModal.memberId || !selectedAccountId) return;
        
        const now = new Date().toISOString();

        // 1. Create Individual Transactions for EACH Item
        settleModal.items.forEach(item => {
            const isReceiving = item.type === 'CREDIT';
            const descriptionPrefix = isReceiving ? 'Recebimento' : 'Pagamento';
            
            onAddTransaction({
                amount: item.amount,
                description: `${descriptionPrefix}: ${item.description}`,
                date: now.split('T')[0],
                type: isReceiving ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: item.category, 
                accountId: selectedAccountId,
                isShared: false,
                relatedMemberId: settleModal.memberId!,
                payerId: undefined,
                createdAt: now,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING
            });

            // 2. Update Original Transaction to mark as Settled
            const originalTx = transactions.find(t => t.id === item.originalTxId);
            if (originalTx) {
                if (item.type === 'CREDIT') {
                    // Update the specific split
                    const updatedSplits = originalTx.sharedWith?.map(s => {
                        if (s.memberId === item.memberId) {
                            return { ...s, isSettled: true, settledAt: now };
                        }
                        return s;
                    });
                    onUpdateTransaction({ ...originalTx, sharedWith: updatedSplits });
                } else {
                    // Update the main transaction (my debt)
                    onUpdateTransaction({ ...originalTx, isSettled: true, settledAt: now });
                }
            }
        });

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0 });
    };

    // Calculate pending status for current view
    const hasPendingInCurrentView = useMemo(() => {
        return displayMembers.some(member => {
            const items = getFilteredInvoice(member.id);
            const { net } = getTotals(items);
            return Math.abs(net) > 0.01;
        });
    }, [displayMembers, activeTab, invoices, currentDate]);

    // Global Totals for Summary Cards (Filtered by View Logic)
    const viewTotals = useMemo(() => {
        let totalReceivable = 0;
        let totalPayable = 0;
        
        displayMembers.forEach(member => {
            const items = getFilteredInvoice(member.id);
            items.forEach(item => {
                if (!item.isPaid) {
                    if (item.type === 'CREDIT') totalReceivable += item.amount;
                    else totalPayable += item.amount;
                }
            });
        });
        
        return { totalReceivable, totalPayable, net: totalReceivable - totalPayable };
    }, [displayMembers, activeTab, invoices, currentDate]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><Users className="w-5 h-5" /></div>
                        <span className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Balanço Geral</span>
                    </div>
                    <div className="text-3xl font-black tracking-tight">{formatCurrency(viewTotals.net)}</div>
                    <p className="text-indigo-200 text-xs mt-1">
                        {viewTotals.net > 0 ? 'A receber de amigos' : viewTotals.net < 0 ? 'A pagar para amigos' : 'Tudo quitado'}
                    </p>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg"><ArrowRight className="w-5 h-5" /></div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total a Receber</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(viewTotals.totalReceivable)}</div>
                </Card>
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg"><ArrowRight className="w-5 h-5 transform rotate-180" /></div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total a Pagar</span>
                    </div>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(viewTotals.totalPayable)}</div>
                </Card>
            </div>

            {/* Navigation Tabs (Simplified) */}
            <div className="flex justify-center">
                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl inline-flex shadow-inner">
                    <button
                        onClick={() => setActiveTab('REGULAR')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'REGULAR' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Home className="w-4 h-4" /> Regular
                    </button>
                    <button
                        onClick={() => setActiveTab('TRAVEL')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Plane className="w-4 h-4" /> Viagens
                    </button>
                </div>
            </div>

            {/* Members Invoices List */}
            <div className="space-y-6">
                {!hasPendingInCurrentView ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tudo certo por aqui!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {activeTab === 'REGULAR' 
                                ? 'Você não tem pendências financeiras mensais com ninguém.' 
                                : 'Nenhuma dívida de viagem pendente no momento.'}
                        </p>
                    </div>
                ) : (
                    displayMembers.map(member => {
                        const items = getFilteredInvoice(member.id);
                        const { credits, debits, net } = getTotals(items);
                        const isSettled = Math.abs(net) < 0.01;

                        if (items.length === 0) return null;

                        return (
                            <div key={member.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
                                {/* Invoice Header */}
                                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xl border-4 border-white dark:border-slate-600 shadow-sm">
                                                {member.name ? member.name[0] : '?'}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                                    {member.name}
                                                    {activeTab === 'TRAVEL' && items.some(i => i.tripId) && <Plane className="w-4 h-4 text-violet-500" />}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs font-medium">
                                                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Receber: {formatCurrency(credits)}</span>
                                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><ArrowRight className="w-3 h-3 transform rotate-180" /> Pagar: {formatCurrency(debits)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">Valor Líquido</p>
                                            <p className={`text-2xl font-black ${net > 0 ? 'text-emerald-600 dark:text-emerald-400' : net < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                {formatCurrency(Math.abs(net))}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                {net > 0 ? 'A Receber' : net < 0 ? 'A Pagar' : 'Quitado'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Items List (Always Expanded) */}
                                <div className="bg-slate-50/50 dark:bg-slate-900/30 divide-y divide-slate-100 dark:divide-slate-700">
                                    {items.map(item => (
                                        <div key={item.id} className={`px-6 py-4 flex justify-between items-center ${item.isPaid ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.type === 'CREDIT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                                    {item.type === 'CREDIT' ? <ArrowRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 transform rotate-180" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{item.description}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString('pt-BR')} • {item.category}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold text-sm ${item.type === 'CREDIT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                                    {item.type === 'CREDIT' ? '+' : '-'} {formatCurrency(item.amount)}
                                                </p>
                                                {item.isPaid && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Pago</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions Bar */}
                                {!isSettled && (
                                    <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                                        {net > 0 ? (
                                            <Button onClick={() => handleOpenSettleModal(member.id, 'RECEIVE')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none h-12 text-base">
                                                Receber Fatura ({formatCurrency(net)})
                                            </Button>
                                        ) : net < 0 ? (
                                            <Button onClick={() => handleOpenSettleModal(member.id, 'PAY')} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none h-12 text-base">
                                                Pagar Fatura ({formatCurrency(Math.abs(net))})
                                            </Button>
                                        ) : (
                                            <Button onClick={() => handleOpenSettleModal(member.id, 'OFFSET')} className="w-full bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200 dark:shadow-none h-12 text-base">
                                                Compensar Itens (R$ 0,00)
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* SETTLEMENT CONFIRMATION MODAL */}
            {settleModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSettleModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {settleModal.type === 'RECEIVE' ? 'Receber Fatura' : settleModal.type === 'PAY' ? 'Pagar Fatura' : 'Compensar Valores'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                {settleModal.items.length} itens selecionados
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase">Valor Total</span>
                                <span className={`text-3xl font-black ${settleModal.type === 'RECEIVE' ? 'text-emerald-600 dark:text-emerald-400' : settleModal.type === 'PAY' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                                    {formatCurrency(settleModal.total)}
                                </span>
                            </div>

                            {settleModal.type !== 'OFFSET' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Conta para movimentação</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                        <select
                                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium appearance-none"
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                        >
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>
                                    Esta ação criará <strong>{settleModal.items.length} transações</strong> individuais no seu extrato e marcará os itens originais como quitados.
                                </span>
                            </div>

                            <Button onClick={handleConfirmSettlement} className={`w-full h-14 text-lg shadow-lg ${settleModal.type === 'RECEIVE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none' : settleModal.type === 'PAY' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200 dark:shadow-none'}`}>
                                Confirmar {settleModal.type === 'RECEIVE' ? 'Recebimento' : settleModal.type === 'PAY' ? 'Pagamento' : 'Compensação'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};