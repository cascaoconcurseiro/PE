import React, { useState, useEffect } from 'react';
import { InvoiceItem, Account, AccountType } from '../../types';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils';

interface SettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    settleData: {
        memberId: string | null;
        type: 'PAY' | 'RECEIVE' | 'OFFSET';
        items: InvoiceItem[];
        total: number;
        currency: string;
    };
    accounts: Account[];
    onConfirm: (accountId: string, method: 'SAME_CURRENCY' | 'CONVERT', exchangeRate?: number, date?: string, customAmount?: number) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({ isOpen, onClose, settleData, accounts, onConfirm }) => {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [settlementMethod, setSettlementMethod] = useState<'SAME_CURRENCY' | 'CONVERT'>('SAME_CURRENCY');
    const [exchangeRate, setExchangeRate] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPartial, setIsPartial] = useState(false);
    const [customAmount, setCustomAmount] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSettlementMethod('SAME_CURRENCY');
            setExchangeRate('');
            setDate(new Date().toISOString().split('T')[0]);
            setIsProcessing(false);
            setIsPartial(false);
            setCustomAmount(settleData.total.toFixed(2));
            const validAccount = accounts.find(a => a.type !== AccountType.CREDIT_CARD && a.currency === settleData.currency);
            setSelectedAccountId(validAccount ? validAccount.id : '');
        }
    }, [isOpen, settleData.currency, settleData.total, accounts]);

    if (!isOpen) return null;

    const finalAmount = isPartial ? (parseFloat(customAmount) || 0) : settleData.total;

    const handleConfirm = () => {
        if (!selectedAccountId && settleData.type !== 'OFFSET') return;
        if (isProcessing) return;
        if (finalAmount <= 0) return;

        setIsProcessing(true);
        const rate = settlementMethod === 'CONVERT' ? parseFloat(exchangeRate) : undefined;
        onConfirm(selectedAccountId, settlementMethod, rate, date, isPartial ? finalAmount : undefined);
    };

    const isExpense = settleData.type === 'PAY';
    const isIncome = settleData.type === 'RECEIVE';
    const actionLabel = isExpense ? 'Pagamento (Despesa)' : isIncome ? 'Recebimento (Receita)' : 'Compensação';
    const actionColor = isExpense ? 'text-red-500' : isIncome ? 'text-emerald-500' : 'text-slate-500';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Acerto de Contas</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Resolvendo {settleData.items.length} pendências em <strong>{settleData.currency}</strong>.</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Action Type Label */}
                    <div className={`text-center font-bold text-lg ${actionColor} bg-slate-50 dark:bg-slate-900 py-2 rounded-xl`}>
                        {actionLabel}
                    </div>

                    {/* Partial Payment Toggle */}
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div>
                            <span className="text-sm font-bold text-amber-900 dark:text-amber-200">Acerto Parcial?</span>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Pagar apenas uma parte da fatura</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPartial(!isPartial)}
                            className={`w-12 h-6 rounded-full transition-colors ${isPartial ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isPartial ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* Custom Amount Input */}
                    {isPartial && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Valor do {isExpense ? 'Pagamento' : 'Recebimento'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-3 text-lg font-bold text-slate-400">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    max={settleData.total}
                                    value={customAmount}
                                    onChange={e => setCustomAmount(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white font-bold text-lg"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Total pendente: {formatCurrency(settleData.total, settleData.currency)} |
                                Restará: {formatCurrency(settleData.total - finalAmount, settleData.currency)}
                            </p>
                        </div>
                    )}

                    {/* Foreign Currency Handling */}
                    {settleData.currency !== 'BRL' && (
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button
                                onClick={() => { setSettlementMethod('SAME_CURRENCY'); setSelectedAccountId(''); }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settlementMethod === 'SAME_CURRENCY' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Receber em {settleData.currency}
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
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">1 {settleData.currency} =</span>
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
                            {settleData.type === 'RECEIVE' ? 'Receber na conta:' : 'Pagar com:'}
                        </label>
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {accounts
                                .filter(a => a.type !== AccountType.CREDIT_CARD) // Block Credit Cards
                                .filter(a => settlementMethod === 'CONVERT' ? a.currency === 'BRL' : a.currency === settleData.currency) // Match Currency Logic
                                .map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Date Selection */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Data do {isExpense ? 'Pagamento' : 'Recebimento'}
                        </label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">
                            {isPartial ? 'Valor Parcial' : 'Valor Final'}
                        </span>
                        <span className={`text-2xl font-black ${isPartial ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                            {settlementMethod === 'CONVERT' && exchangeRate
                                ? formatCurrency(finalAmount * parseFloat(exchangeRate), 'BRL')
                                : formatCurrency(finalAmount, settleData.currency)
                            }
                        </span>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedAccountId || (settlementMethod === 'CONVERT' && !exchangeRate) || isProcessing}
                        className="w-full h-12 text-lg"
                    >
                        {isProcessing ? 'Processando...' : 'Confirmar'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
