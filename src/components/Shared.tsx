import React, { useState, useMemo } from 'react';
import { Transaction, Trip, FamilyMember, TransactionType, Account, Category, SyncStatus } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Users, Home, Plane, Receipt, ChevronRight, Check, AlertCircle, Calendar, ArrowRight, Wallet, History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, isSameMonth } from '../utils';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
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
    onAddTransaction, 
    onUpdateTransaction, 
    onNavigateToTrips 
}) => {
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL'>('REGULAR');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
    const [settleModal, setSettleModal] = useState<{ isOpen: boolean, memberId: string | null, type: 'PAY' | 'RECEIVE' | 'OFFSET', items: InvoiceItem[], total: number }>({
        isOpen: false, memberId: null, type: 'PAY', items: [], total: 0
    });
    const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');

    // --- ENGINE: GENERATE INVOICES ---
    const invoices = useMemo<Record<string, InvoiceItem[]>>(() => {
        const invoiceMap: Record<string, InvoiceItem[]> = {};
        
        // Initialize for all known members
        members.forEach(m => invoiceMap[m.id] = []);

        transactions.forEach(t => {
            // Only care about shared expenses
            if (!t.isShared || t.type !== TransactionType.EXPENSE) return;

            // 1. CREDIT LOGIC: User Paid (payerId undefined), Others Owe User
            if (!t.payerId) {
                t.sharedWith?.forEach(split => {
                    const memberId = split.memberId;
                    // FIX: Initialize if not exists (handling deleted/loading members)
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
                // FIX: Initialize if not exists
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
        // Collect all IDs found in invoices map (which now includes everyone from transactions)
        const uniqueIds = new Set([...members.map(m => m.id), ...Object.keys(invoices)]);
        
        return Array.from(uniqueIds).map(id => {
            const knownMember = members.find(m => m.id === id);
            // If member info is missing (deleted or loading), create a placeholder
            return knownMember || { id, name: 'Membro (Excluído ou Carregando)', role: 'Unknown' } as FamilyMember;
        });
    }, [members, invoices]);

    // --- FILTERING ---
    const getFilteredInvoice = (memberId: string) => {
        const allItems = invoices[memberId] || [];
        
        if (activeTab === 'TRAVEL') {
            return allItems.filter(i => !!i.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            // Regular: Show ALL pending items OR settled items in selected month
            return allItems.filter(i => 
                !i.tripId && 
                (!i.isPaid || isSameMonth(i.date, selectedMonth))
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
            const settlementTxId = crypto.randomUUID();
            
            onAddTransaction({
                id: settlementTxId, // Force ID to link
                amount: item.amount,
                description: `${descriptionPrefix}: ${item.description}`,
                date: now.split('T')[0],
                type: isReceiving ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: item.category, // Keep original category for reporting!
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
                    onUpdateTransaction({ ...originalTx, isSettled: true, settledAt: now, settledByTxId: settlementTxId });
                }
            }
        });

        setSettleModal({ isOpen: false, memberId: null, type: 'PAY', items: [], total: 0 });
    };

    // Global Totals for Summary Cards
    const globalTotals = useMemo(() => {
        let totalReceivable = 0;
        let totalPayable = 0;
        
        // Explicit typing to avoid TS errors
        const allItems = (Object.values(invoices).flat() as InvoiceItem[]);
        
        allItems.forEach(item => {
            if (!item.isPaid) {
                if (item.type === 'CREDIT') totalReceivable += item.amount;
                else totalPayable += item.amount;
            }
        });
        
        return { totalReceivable, totalPayable, net: totalReceivable - totalPayable };
    }, [invoices]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Header Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><Users className="w-5 h-5" /></div>
                        <span className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Balanço Geral</span>
                    </div>
                    <div className="text-3xl font-black tracking-tight">{formatCurrency(globalTotals.net)}</div>
                    <p className="text-indigo-200 text-xs mt-1">
                        {globalTotals.net > 0 ? 'A receber de amigos' : globalTotals.net < 0 ? 'A pagar para amigos' : 'Tudo quitado'}
                    </p>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><ArrowRight className="w-5 h-5" /></div>
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total a Receber</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">{formatCurrency(globalTotals.totalReceivable)}</div>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 text-red-700 rounded-lg"><ArrowRight className="w-5 h-5 transform rotate-180" /></div>
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total a Pagar</span>
                    </div>
                    <div className="text-2xl font-bold text-red-700">{formatCurrency(globalTotals.totalPayable)}</div>
                </Card>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-20">
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab('REGULAR')}
                        className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'REGULAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Home className="w-4 h-4" /> Regular
                    </button>
                    <button
                        onClick={() => setActiveTab('TRAVEL')}
                        className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'TRAVEL' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plane className="w-4 h-4" /> Viagens
                    </button>
                </div>

                {activeTab === 'REGULAR' && (
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                        <input
                            type="month"
                            className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none"
                            value={selectedMonth.toISOString().slice(0, 7)}
                            onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
                        />
                    </div>
                )}
            </div>

            {/* Members Invoices List */}
            <div className="space-y-6">
                {displayMembers.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Nenhum membro ou despesa encontrada.</p>
                        <p className="text-xs text-slate-400">Verifique se você criou despesas compartilhadas na tela de Extrato.</p>
                    </div>
                )}

                {displayMembers.map(member => {
                    const items = getFilteredInvoice(member.id);
                    const { credits, debits, net } = getTotals(items);
                    const isSettled = Math.abs(net) < 0.01;
                    const isExpanded = expandedMemberId === member.id;

                    // Skip empty invoices ONLY if they are truly empty (no history, no current debt)
                    // If we are filtering by month, items might be empty, but we might want to show "Nothing this month"
                    // Current logic: If items is empty, don't render. 
                    if (items.length === 0) return null;

                    return (
                        <div key={member.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
                            {/* Invoice Header */}
                            <div className="p-6 cursor-pointer" onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xl border-4 border-white shadow-sm">
                                            {member.name ? member.name[0] : '?'}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                                {member.name}
                                                {activeTab === 'TRAVEL' && items.some(i => i.tripId) && <Plane className="w-4 h-4 text-violet-500" />}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs font-medium">
                                                <span className="text-emerald-600 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Receber: {formatCurrency(credits)}</span>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-red-600 flex items-center gap-1"><ArrowRight className="w-3 h-3 transform rotate-180" /> Pagar: {formatCurrency(debits)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold uppercase text-slate-400 mb-1">Valor Líquido</p>
                                        <p className={`text-2xl font-black ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                            {formatCurrency(Math.abs(net))}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {net > 0 ? 'A Receber' : net < 0 ? 'A Pagar' : 'Quitado'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Bar */}
                            {!isSettled && (
                                <div className="px-6 pb-6 flex gap-3">
                                    {net > 0 ? (
                                        <Button onClick={() => handleOpenSettleModal(member.id, 'RECEIVE')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200">
                                            Receber Fatura ({formatCurrency(net)})
                                        </Button>
                                    ) : net < 0 ? (
                                        <Button onClick={() => handleOpenSettleModal(member.id, 'PAY')} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-red-200">
                                            Pagar Fatura ({formatCurrency(Math.abs(net))})
                                        </Button>
                                    ) : (
                                        <Button onClick={() => handleOpenSettleModal(member.id, 'OFFSET')} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200">
                                            Compensar Itens (R$ 0,00)
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Collapsible Items List */}
                            {isExpanded && (
                                <div className="bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100">
                                    <div className="px-6 py-3 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                        <span>Detalhamento da Fatura</span>
                                        <span>{items.length} itens</span>
                                    </div>
                                    {items.map(item => (
                                        <div key={item.id} className={`px-6 py-4 flex justify-between items-center ${item.isPaid ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {item.type === 'CREDIT' ? <ArrowRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 transform rotate-180" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{item.description}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString('pt-BR')} • {item.category}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold text-sm ${item.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {item.type === 'CREDIT' ? '+' : '-'} {formatCurrency(item.amount)}
                                                </p>
                                                {item.isPaid && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">Pago</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {!isExpanded && items.length > 0 && (
                                <div onClick={() => setExpandedMemberId(member.id)} className="bg-slate-50 border-t border-slate-100 py-2 flex justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </div>
                            )}
                            {isExpanded && (
                                <div onClick={() => setExpandedMemberId(null)} className="bg-slate-50 border-t border-slate-100 py-2 flex justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* SETTLEMENT CONFIRMATION MODAL */}
            {settleModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSettleModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-xl font-bold text-slate-900">
                                {settleModal.type === 'RECEIVE' ? 'Receber Fatura' : settleModal.type === 'PAY' ? 'Pagar Fatura' : 'Compensar Valores'}
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">
                                {settleModal.items.length} itens selecionados
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <span className="text-sm font-bold text-slate-600 uppercase">Valor Total</span>
                                <span className={`text-3xl font-black ${settleModal.type === 'RECEIVE' ? 'text-emerald-600' : settleModal.type === 'PAY' ? 'text-red-600' : 'text-slate-800'}`}>
                                    {formatCurrency(settleModal.total)}
                                </span>
                            </div>

                            {settleModal.type !== 'OFFSET' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Conta para movimentação</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                        <select
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium appearance-none"
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

                            <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-xl border border-blue-100 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                                <span>
                                    Esta ação criará <strong>{settleModal.items.length} transações</strong> individuais no seu extrato e marcará os itens originais como quitados.
                                </span>
                            </div>

                            <Button onClick={handleConfirmSettlement} className={`w-full h-14 text-lg shadow-lg ${settleModal.type === 'RECEIVE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : settleModal.type === 'PAY' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200'}`}>
                                Confirmar {settleModal.type === 'RECEIVE' ? 'Recebimento' : settleModal.type === 'PAY' ? 'Pagamento' : 'Compensação'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};