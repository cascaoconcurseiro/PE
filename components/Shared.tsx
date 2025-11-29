import React, { useState } from 'react';
import { Transaction, Trip, FamilyMember, TransactionType, Account } from '../types';
import { Card } from './ui/Card';
import { Users, Home, Plane, Receipt, ChevronRight, MapPin } from 'lucide-react';
import { formatCurrency } from '../utils';

interface SharedProps {
    transactions: Transaction[];
    trips: Trip[];
    members: FamilyMember[];
    accounts: Account[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onNavigateToTrips: () => void;
}

export const Shared: React.FC<SharedProps> = ({ transactions, trips, members, accounts, onAddTransaction, onNavigateToTrips }) => {
    const [activeTab, setActiveTab] = useState<'REGULAR' | 'TRAVEL'>('REGULAR');

    // Settlement State
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [settleMemberId, setSettleMemberId] = useState<string | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settleAccountId, setSettleAccountId] = useState('');

    // 1. Calculate Comprehensive Debt (Net Balance: Positive = They owe Me, Negative = I owe Them)
    const calculateDebts = () => {
        const debts: Record<string, { total: number, regular: number, travel: number }> = {};

        // Initialize for all members
        members.forEach(m => {
            debts[m.id] = { total: 0, regular: 0, travel: 0 };
        });

        transactions.forEach(t => {
            // A. SHARED EXPENSES LOGIC (Acumula Dívida)
            if (t.isShared && t.type === TransactionType.EXPENSE) {
                const payerId = t.payerId; // undefined means User paid
                const splits = t.sharedWith || [];

                if (!payerId) {
                    // CASE 1: User Paid. Others owe User.
                    splits.forEach(split => {
                        const memberId = split.memberId;
                        if (debts[memberId]) {
                            debts[memberId].total += split.assignedAmount;
                            if (t.tripId) {
                                debts[memberId].travel += split.assignedAmount;
                            } else {
                                debts[memberId].regular += split.assignedAmount;
                            }
                        }
                    });
                } else {
                    // CASE 2: Member Paid. User might owe Member (if User consumes remainder).
                    const totalSplits = splits.reduce((sum, s) => sum + s.assignedAmount, 0);
                    const userShare = t.amount - totalSplits;

                    if (userShare > 0.01 && debts[payerId]) {
                        // User owes Payer
                        debts[payerId].total -= userShare;
                        if (t.tripId) {
                            debts[payerId].travel -= userShare;
                        } else {
                            debts[payerId].regular -= userShare;
                        }
                    }
                }
            }

            // B. SETTLEMENT LOGIC (Abate Dívida) - NEW
            // Checks for transactions marked as 'Reembolso' linked to a specific member
            if (t.category === 'Reembolso' && t.relatedMemberId && debts[t.relatedMemberId]) {
                if (t.type === TransactionType.INCOME) {
                    // I received money from Member -> They owe me less (Subtract from Positive Balance)
                    debts[t.relatedMemberId].total -= t.amount;
                    // We simply reduce from regular for display simplicity, or generic total
                    debts[t.relatedMemberId].regular -= t.amount; 
                } else if (t.type === TransactionType.EXPENSE) {
                    // I paid money to Member -> I owe them less (Add to Negative Balance towards Zero)
                    debts[t.relatedMemberId].total += t.amount;
                    debts[t.relatedMemberId].regular += t.amount;
                }
            }
        });
        return debts;
    };

    const debts = calculateDebts();

    const handleSettleDebt = () => {
        if (!settleMemberId || !settleAmount || !settleAccountId) return;
        const amountToSettle = Math.abs(parseFloat(settleAmount)); // Always positive for transaction
        if (amountToSettle <= 0) return;

        const member = members.find(m => m.id === settleMemberId);
        const account = accounts.find(a => a.id === settleAccountId);
        const originalBalance = parseFloat(settleAmount);
        
        // Logic: 
        // If originalBalance > 0 (They owe Me), I am Receiving (Income).
        // If originalBalance < 0 (I owe Them), I am Paying (Expense).
        const isReceiving = originalBalance > 0;

        // Create Settlement Transaction
        onAddTransaction({
            amount: amountToSettle,
            description: isReceiving ? `Recebimento de ${member?.name}` : `Pagamento para ${member?.name}`,
            date: new Date().toISOString(),
            type: isReceiving ? TransactionType.INCOME : TransactionType.EXPENSE,
            category: 'Reembolso',
            accountId: settleAccountId,
            isShared: false,
            relatedMemberId: settleMemberId // CRITICAL: Link this tx to the member to affect calculation
        });

        alert(`Acerto de ${formatCurrency(amountToSettle)} ${isReceiving ? 'recebido de' : 'pago a'} ${member?.name} registrado na conta ${account?.name}.`);
        setSettleModalOpen(false);
        setSettleMemberId(null);
        setSettleAmount('');
        setSettleAccountId('');
    };

    // 2. Filter Transactions based on Tab
    const sharedTransactions = transactions.filter(t => t.isShared && t.type === TransactionType.EXPENSE);

    // Grouping Logic for Travel Tab
    const travelGroups = sharedTransactions
        .filter(t => !!t.tripId)
        .reduce((groups, t) => {
            const tId = t.tripId!;
            if (!groups[tId]) groups[tId] = [];
            groups[tId].push(t);
            return groups;
        }, {} as Record<string, Transaction[]>);

    const regularTransactions = sharedTransactions.filter(t => !t.tripId);

    const renderTransactionItem = (t: Transaction, isTravelItem: boolean) => (
        <div key={t.id} className="p-4 flex flex-col gap-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isTravelItem ? 'bg-slate-100 text-slate-500' : 'bg-violet-100 text-violet-600'}`}>
                        {!isTravelItem ? <Receipt className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 text-sm">{t.description}</p>
                        <p className="text-xs text-slate-600">
                            {new Date(t.date).toLocaleDateString('pt-BR')} •
                            <span className="font-semibold ml-1 text-slate-500">
                                {t.payerId ? `Pago por ${members.find(m => m.id === t.payerId)?.name}` : 'Pago por Você'}
                            </span>
                        </p>
                    </div>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(t.amount)}</span>
            </div>

            {/* Splits Details */}
            <div className="pl-[52px]">
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 flex flex-wrap gap-2">
                    {t.sharedWith?.map(s => {
                        const m = members.find(mem => mem.id === s.memberId);
                        return (
                            <span key={s.memberId} className={`text-[10px] px-2 py-1 rounded font-medium flex items-center gap-1 ${!isTravelItem ? 'bg-white text-slate-700 border border-slate-200' : 'bg-violet-50 text-violet-800 border border-violet-100'}`}>
                                {m?.name}: <strong>{formatCurrency(s.assignedAmount)}</strong>
                            </span>
                        )
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            <div className="flex flex-col space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-600" />
                    Área Compartilhada
                </h2>
                <p className="text-slate-600 text-sm">Central de faturas e divisão de despesas.</p>
            </div>

            {/* INVOICE SECTION (FATURA) */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 ml-1 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-500" /> Resumo de Dívidas (Líquido)
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {members.length === 0 && (
                        <Card className="border-dashed border-2 border-slate-200 bg-slate-50 text-center py-6 text-slate-500 text-sm">
                            Adicione membros na aba Família para dividir contas.
                        </Card>
                    )}

                    {members.map(member => {
                        const debt = debts[member.id] || { total: 0, regular: 0, travel: 0 };
                        const isReceiving = debt.total > 0.01;
                        const isPaying = debt.total < -0.01;
                        const isSettled = !isReceiving && !isPaying;

                        return (
                            <div key={member.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative transition-all hover:shadow-md">
                                {/* Side Indicator */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${isReceiving ? 'bg-indigo-600' : isPaying ? 'bg-red-500' : 'bg-emerald-500'}`}></div>

                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg border-2 border-white shadow-sm">
                                                {member.name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-lg">{member.name}</p>
                                                <p className={`text-xs font-bold uppercase tracking-wide ${isReceiving ? 'text-indigo-600' : isPaying ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {isReceiving ? 'A Receber' : isPaying ? 'A Pagar' : 'Tudo Pago'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-mono font-bold text-2xl ${isReceiving ? 'text-indigo-700' : isPaying ? 'text-red-600' : 'text-emerald-700'}`}>
                                                {formatCurrency(Math.abs(debt.total))}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Breakdown (Regular vs Travel) */}
                                    {!isSettled && (
                                        <div className="bg-slate-50 rounded-xl p-3 flex gap-4 text-xs">
                                            <div className="flex-1 flex items-center gap-2 border-r border-slate-200">
                                                <div className="p-1.5 bg-white rounded-md text-slate-500 shadow-sm">
                                                    <Home className="w-3 h-3" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 font-medium">Casa/Regular</p>
                                                    <p className={`font-bold ${debt.regular > 0 ? 'text-indigo-700' : debt.regular < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {formatCurrency(Math.abs(debt.regular))}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex-1 flex items-center gap-2">
                                                <div className="p-1.5 bg-white rounded-md text-violet-600 shadow-sm">
                                                    <Plane className="w-3 h-3" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 font-medium">Viagens</p>
                                                    <p className={`font-bold ${debt.travel > 0 ? 'text-indigo-700' : debt.travel < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {formatCurrency(Math.abs(debt.travel))}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                {!isSettled && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-end gap-2">
                                        <button className="text-xs font-bold text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors">
                                            Ver Detalhes
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSettleMemberId(member.id);
                                                setSettleAmount(debt.total.toString()); // Pass signed amount (+ or -)
                                                // Default to first checking account
                                                const defaultAcc = accounts.find(a => a.type === 'CONTA CORRENTE' || a.type === 'DINHEIRO');
                                                if (defaultAcc) setSettleAccountId(defaultAcc.id);
                                                setSettleModalOpen(true);
                                            }}
                                            className={`text-xs font-bold text-white px-4 py-2 rounded-lg shadow-sm active:scale-95 transition-transform ${isReceiving ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                        >
                                            {isReceiving ? 'Registrar Recebimento' : 'Registrar Pagamento'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Travel Management Shortcut */}
            <div
                onClick={onNavigateToTrips}
                className="bg-gradient-to-r from-violet-700 to-indigo-700 rounded-2xl p-4 text-white shadow-lg shadow-indigo-200 cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden flex items-center justify-between"
            >
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                        <Plane className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Acessar Painel de Viagens</h3>
                        <p className="text-violet-100 text-xs">Roteiros e orçamentos detalhados</p>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/80" />
            </div>

            {/* HISTORY SECTION WITH TABS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                {/* Tabs Header */}
                <div className="flex border-b border-slate-100 sticky top-0 bg-white z-10">
                    <button
                        onClick={() => setActiveTab('REGULAR')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'REGULAR' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Home className="w-4 h-4" /> Despesas Regulares
                    </button>
                    <button
                        onClick={() => setActiveTab('TRAVEL')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'TRAVEL' ? 'border-violet-600 text-violet-700 bg-violet-50/30' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plane className="w-4 h-4" /> Despesas de Viagem
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="bg-slate-50/50 min-h-full">
                    {/* TAB: REGULAR EXPENSES */}
                    {activeTab === 'REGULAR' && (
                        <div className="divide-y divide-slate-100 bg-white">
                            {regularTransactions.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                        <Home className="w-8 h-8" />
                                    </div>
                                    <p className="text-slate-500 text-sm">Nenhuma despesa regular compartilhada.</p>
                                </div>
                            ) : (
                                regularTransactions.map(t => renderTransactionItem(t, false))
                            )}
                        </div>
                    )}

                    {/* TAB: TRAVEL EXPENSES (GROUPED BY TRIP) */}
                    {activeTab === 'TRAVEL' && (
                        <div className="p-4 space-y-4">
                            {Object.keys(travelGroups).length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3 text-violet-300">
                                        <Plane className="w-8 h-8" />
                                    </div>
                                    <p className="text-slate-500 text-sm">Nenhuma despesa de viagem compartilhada.</p>
                                </div>
                            ) : (
                                Object.entries(travelGroups).map(([tripId, groupTransactions]) => {
                                    const txs = groupTransactions as Transaction[];
                                    const trip = trips.find(t => t.id === tripId);
                                    const tripTotal = txs.reduce((acc, t) => acc + t.amount, 0);

                                    return (
                                        <div key={tripId} className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
                                            {/* Trip Header (Invoice Header) */}
                                            <div className="bg-violet-50 p-4 border-b border-violet-100 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white rounded-lg shadow-sm text-violet-600">
                                                        <MapPin className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-violet-900 text-sm">{trip?.name || 'Viagem Desconhecida'}</h4>
                                                        <p className="text-[10px] text-violet-700 font-medium uppercase tracking-wider">
                                                            {txs.length} lançamentos
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-violet-600">Total Compartilhado</p>
                                                    <p className="font-bold text-violet-800 text-lg">{formatCurrency(tripTotal)}</p>
                                                </div>
                                            </div>

                                            {/* Transactions List for this Trip */}
                                            <div className="divide-y divide-slate-100">
                                                {txs.map(t => renderTransactionItem(t, true))}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SETTLEMENT MODAL */}
            {settleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-sm bg-white shadow-2xl" title="Registrar Acerto">
                        <div className="space-y-4">
                            <div className="text-center py-2">
                                <p className="text-sm text-slate-600 mb-1">
                                    {parseFloat(settleAmount) > 0 ? 'Receber de' : 'Pagar para'} {members.find(m => m.id === settleMemberId)?.name}
                                </p>
                                <div className="text-left">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor do Acerto</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-bold text-lg"
                                        // Display positive value in input
                                        value={settleAmount ? Math.abs(parseFloat(settleAmount)) : ''}
                                        onChange={(e) => {
                                            // Keep the sign of the original intention (Receiving/Paying) but update magnitude
                                            const newVal = parseFloat(e.target.value);
                                            const originalSign = parseFloat(settleAmount) >= 0 ? 1 : -1;
                                            setSettleAmount((newVal * originalSign).toString());
                                        }}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    {parseFloat(settleAmount) > 0 ? 'Receber na Conta:' : 'Pagar com a Conta:'}
                                </label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                                    value={settleAccountId}
                                    onChange={(e) => setSettleAccountId(e.target.value)}
                                >
                                    <option value="" disabled>Selecione uma conta...</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id} className="bg-white text-slate-900">
                                            {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setSettleModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors">Cancelar</button>
                                <button
                                    onClick={handleSettleDebt}
                                    disabled={!settleAmount || !settleAccountId}
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};