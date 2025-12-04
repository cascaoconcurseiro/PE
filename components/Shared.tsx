import React, { useState, useMemo } from 'react';
import { Transaction, Trip, FamilyMember, TransactionType, Account, SyncStatus, Category, AccountType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Users, Home, Plane, ArrowRight, AlertCircle, Calendar, Wallet, Sparkles, ChevronDown, RefreshCcw } from 'lucide-react';
import { formatCurrency, parseDate, isSameMonth } from '../utils';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
    currentDate: Date;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onNavigateToTrips: () => void;
}

interface InvoiceItem {
    id: string;
    originalTxId: string;
    description: string;
    date: string;
    category: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    isPaid: boolean;
    tripId?: string;
    memberId: string;
    currency?: string;
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

    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [settlementMethod, setSettlementMethod] = useState<'SAME_CURRENCY' | 'CONVERT'>('SAME_CURRENCY');
    const [exchangeRate, setExchangeRate] = useState('');

    // --- ENGINE: GENERATE INVOICES ---
    const invoices = useMemo(() => {
        const invoiceMap: Record<string, InvoiceItem[]> = {};
        members.forEach(m => invoiceMap[m.id] = []);

        transactions.forEach(t => {
            const isSharedExpense = t.type === TransactionType.EXPENSE && (t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me'));
            if (!isSharedExpense) return;

            const txCurrency = t.currency || 'BRL';

            // 1. CREDIT LOGIC: User Paid, Others Owe
            if (!t.payerId || t.payerId === 'me') {
                t.sharedWith?.forEach(split => {
                    if (!invoiceMap[split.memberId]) invoiceMap[split.memberId] = [];
                    invoiceMap[split.memberId].push({
                        id: `${t.id}-credit-${split.memberId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: split.assignedAmount,
                        type: 'CREDIT',
                        isPaid: !!split.isSettled,
                        tripId: t.tripId,
                        memberId: split.memberId,
                        currency: txCurrency
                    });
                });
            }
            // 2. DEBIT LOGIC: Other Paid, User Owes
            else {
                const payerId = t.payerId;
                if (!invoiceMap[payerId]) invoiceMap[payerId] = [];
                const totalSplits = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                const myShare = t.amount - totalSplits;

                // FIX: Validar se a divisão não é maior que o total
                if (myShare < 0) {
                    console.error(`❌ ERRO: Divisão maior que o total da transação!`);
                    console.error(`   Transaction ID: ${t.id}`);
                    console.error(`   Description: ${t.description}`);
                    console.error(`   Total: ${t.amount}`);
                    console.error(`   Soma das divisões: ${totalSplits}`);
                    console.error(`   Diferença (minha parte): ${myShare}`);
                }

                if (myShare > 0.01) {
                    invoiceMap[payerId].push({
                        id: `${t.id}-debit-${payerId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: myShare,
                        type: 'DEBIT',
                        isPaid: !!t.isSettled,
                        tripId: t.tripId,
                        memberId: payerId,
                        currency: txCurrency
                    });
                }
            }
        });
        return invoiceMap;
    }, [transactions, members]);

    const displayMembers = useMemo(() => {
        const uniqueIds = new Set([...members.map(m => m.id), ...Object.keys(invoices)]);
        return Array.from(uniqueIds).map(id => members.find(m => m.id === id) || { id, name: 'Membro Desconhecido', role: 'Unknown' } as FamilyMember);
    }, [members, invoices]);

    const getFilteredInvoice = (memberId: string) => {
        const allItems = invoices[memberId] || [];
        if (activeTab === 'TRAVEL') {
            return allItems.filter(i => !!i.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            return allItems.filter(i => {
                if (i.tripId) return false;
                const itemDate = parseDate(i.date);
                if (i.isPaid) return isSameMonth(itemDate, currentDate);
                return itemDate <= currentMonthEnd;
            }).sort((a, b) => b.date.localeCompare(a.date));
        }
    };

    const getTotals = (items: InvoiceItem[]) => {
        // Group by Currency
        const totalsByCurrency: Record<string, { credits: number, debits: number, net: number }> = {};

        items.forEach(i => {
            const curr = i.currency || 'BRL';
            if (!totalsByCurrency[curr]) totalsByCurrency[curr] = { credits: 0, debits: 0, net: 0 };

            if (!i.isPaid) {
                if (i.type === 'CREDIT') totalsByCurrency[curr].credits += i.amount;
                else totalsByCurrency[curr].debits += i.amount;
            }
        });

        Object.keys(totalsByCurrency).forEach(curr => {
            totalsByCurrency[curr].net = totalsByCurrency[curr].credits - totalsByCurrency[curr].debits;
        });

        return totalsByCurrency;
    };

    const handleOpenSettleModal = (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => {
        const allItems = getFilteredInvoice(memberId);
        const items = allItems.filter(i => !i.isPaid && (i.currency || 'BRL') === currency);

        const credits = items.filter(i => i.type === 'CREDIT').reduce((a, b) => a + b.amount, 0);
        const debits = items.filter(i => i.type === 'DEBIT').reduce((a, b) => a + b.amount, 0);
        const net = credits - debits;

        // Reset State
        setSettlementMethod('SAME_CURRENCY');
        setExchangeRate('');

        // Auto select first valid account
        const validAccount = accounts.find(a => a.type !== AccountType.CREDIT_CARD && a.currency === currency);
        setSelectedAccountId(validAccount ? validAccount.id : '');

        setSettleModal({
            isOpen: true,
            memberId,
            type,
            items,
            total: type === 'OFFSET' ? 0 : Math.abs(net),
            currency
        });
    };

    const handleConfirmSettlement = () => {
        if (!settleModal.memberId || (!selectedAccountId && settleModal.type !== 'OFFSET')) return;

        // Validação: Conta obrigatória para pagamento/recebimento
        if (settleModal.type !== 'OFFSET' && (!selectedAccountId || selectedAccountId.trim() === '')) {
            alert('Erro: Selecione uma conta para regularizar');
            return;
        }

        const now = new Date().toISOString();
        const isConverting = settlementMethod === 'CONVERT';
        const rate = isConverting ? parseFloat(exchangeRate) : 1;
        const finalAmount = settleModal.total * rate;

        // 1. Transaction Record (Money Movement)
        if (settleModal.type !== 'OFFSET') {
            onAddTransaction({
                amount: finalAmount,
                description: `${settleModal.type === 'RECEIVE' ? 'Recebimento' : 'Pagamento'} Acerto - ${members.find(m => m.id === settleModal.memberId)?.name}`,
                date: now.split('T')[0],
                type: settleModal.type === 'RECEIVE' ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: settleModal.type === 'RECEIVE' ? Category.INCOME : Category.TRANSFER,
                accountId: selectedAccountId,
                isShared: false,
                relatedMemberId: settleModal.memberId!,
                exchangeRate: isConverting ? rate : undefined,
                currency: isConverting ? 'BRL' : settleModal.currency, // If converting, it enters as BRL
                createdAt: now,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING
            });
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            {/* Navigation Tabs */}
            <div className="flex justify-center">
                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl inline-flex shadow-inner">
                    <button onClick={() => setActiveTab('REGULAR')} className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'REGULAR' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Home className="w-4 h-4" /> Mensal</button>
                    <button onClick={() => setActiveTab('TRAVEL')} className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Plane className="w-4 h-4" /> Viagens</button>
                </div>
            </div>

            <div className="space-y-6">
                {displayMembers.map(member => {
                    const items = getFilteredInvoice(member.id);
                    const totalsMap = getTotals(items);
                    const currencies = Object.keys(totalsMap).filter(c => Math.abs(totalsMap[c].net) > 0.01);

                    if (currencies.length === 0) return null;

                    return (
                        <div key={member.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-lg">{member.name[0]}</div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{member.name}</h3>
                                </div>

                                {currencies.map(curr => {
                                    const { net } = totalsMap[curr];
                                    return (
                                        <div key={curr} className="flex justify-between items-center mb-2 last:mb-0 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                            <span className="text-xs font-bold text-slate-500">{curr}</span>
                                            <div className="text-right">
                                                <p className={`text-lg font-black ${net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(Math.abs(net), curr)}</p>
                                                <p className="text-[10px] uppercase font-bold text-slate-400">{net > 0 ? 'A Receber' : 'A Pagar'}</p>
                                            </div>
                                            <Button
                                                onClick={() => handleOpenSettleModal(member.id, net > 0 ? 'RECEIVE' : 'PAY', curr)}
                                                size="sm"
                                                className={`ml-3 ${net > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'} border-none shadow-none`}
                                            >
                                                {net > 0 ? 'Receber' : 'Pagar'}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-slate-50/50 dark:bg-slate-900/30 divide-y divide-slate-100 dark:divide-slate-700 max-h-60 overflow-y-auto">
                                {items.filter(i => !i.isPaid).map(item => {
                                    const trip = item.tripId ? trips.find(t => t.id === item.tripId) : null;
                                    return (
                                        <div key={item.id} className="px-6 py-4 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.type === 'CREDIT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                                                    {item.type === 'CREDIT' ? <ArrowRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 transform rotate-180" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{item.description}</p>
                                                    <div className="flex flex-wrap gap-2 mt-0.5">
                                                        {trip && <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Plane className="w-3 h-3" /> {trip.name}</span>}
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`font-bold text-sm ${item.type === 'CREDIT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                                {formatCurrency(item.amount, item.currency)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SETTLEMENT MODAL */}
            {settleModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSettleModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Acerto de Contas</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Resolvendo {settleModal.items.length} pendências em <strong>{settleModal.currency}</strong>.</p>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Foreign Currency Handling */}
                            {settleModal.currency !== 'BRL' && (
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        onClick={() => { setSettlementMethod('SAME_CURRENCY'); setSelectedAccountId(''); }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settlementMethod === 'SAME_CURRENCY' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Receber em {settleModal.currency}
                                    </button>
                                    <button
                                        onClick={() => { setSettlementMethod('CONVERT'); setSelectedAccountId(''); }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settlementMethod === 'CONVERT' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Converter p/ BRL
                                    </button>
                                </div>
                            )}

                            {/* Exchange Rate Input */}
                            {settlementMethod === 'CONVERT' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Cotação do Dia</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">1 {settleModal.currency} =</span>
                                        <input
                                            type="number"
                                            placeholder="0,00"
                                            className="flex-1 border-b-2 border-slate-300 dark:border-slate-600 bg-transparent py-2 font-bold text-lg outline-none focus:border-indigo-500 dark:text-white"
                                            value={exchangeRate}
                                            onChange={e => setExchangeRate(e.target.value)}
                                            autoFocus
                                        />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">BRL</span>
                                    </div>
                                </div>
                            )}

                            {/* Account Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    {settleModal.type === 'RECEIVE' ? 'Receber na conta:' : 'Pagar com:'}
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    {accounts
                                        .filter(a => a.type !== AccountType.CREDIT_CARD) // Block Credit Cards
                                        .filter(a => settlementMethod === 'CONVERT' ? a.currency === 'BRL' : a.currency === settleModal.currency) // Match Currency Logic
                                        .map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Summary */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Valor Final</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white">
                                    {settlementMethod === 'CONVERT' && exchangeRate
                                        ? formatCurrency(settleModal.total * parseFloat(exchangeRate), 'BRL')
                                        : formatCurrency(settleModal.total, settleModal.currency)
                                    }
                                </span>
                            </div>

                            <Button onClick={handleConfirmSettlement} disabled={!selectedAccountId || (settlementMethod === 'CONVERT' && !exchangeRate)} className="w-full h-12 text-lg">
                                Confirmar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};