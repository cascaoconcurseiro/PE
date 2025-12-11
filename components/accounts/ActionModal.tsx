import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';
import { ChevronDown, Wallet, Calendar, ArrowRightLeft } from 'lucide-react';

export type ActionType = 'PAY_INVOICE' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';

interface ActionModalProps {
    isOpen: boolean;
    type: ActionType;
    account: Account;
    accounts: Account[];
    initialAmount?: string;
    onClose: () => void;
    onConfirm: (amount: number, description: string, sourceId: string, destinationAmount?: number, exchangeRate?: number, date?: string) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
    isOpen, type, account, accounts, initialAmount = '', onClose, onConfirm
}) => {
    const [amount, setAmount] = useState(initialAmount);
    const [destinationAmount, setDestinationAmount] = useState('');
    const [description, setDescription] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [exchangeRate, setExchangeRate] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [conversionMode, setConversionMode] = useState<'SAME_CURRENCY' | 'CONVERT'>('SAME_CURRENCY');

    useEffect(() => {
        setAmount(initialAmount);
        setDestinationAmount('');
        setExchangeRate('');
        setConversionMode('SAME_CURRENCY');
        setDate(new Date().toISOString().split('T')[0]);
    }, [initialAmount, isOpen]);

    // Reset when type changes
    useEffect(() => {
        setSourceId('');
        setDestinationAmount('');
        setExchangeRate('');
    }, [type]);

    if (!isOpen) return null;

    const sourceAccountObj = accounts.find(a => a.id === sourceId);

    // Check if we are in a multi-currency scenario
    // Note: Since 'sourceId' in standard flow represents Destination for Transfer (confusing naming from legacy code, but standard here),
    // let's clarify: 'account' is the active one (Origin). 'sourceId' is selected in the dropdown (Destination).
    const isInternationalTransfer = type === 'TRANSFER' && sourceAccountObj && account.currency !== sourceAccountObj.currency;

    // Auto-calculate destination amount based on rate
    useEffect(() => {
        if (isInternationalTransfer && amount && exchangeRate) {
            const val = parseFloat(amount.replace(',', '.'));
            const rate = parseFloat(exchangeRate.replace(',', '.'));
            if (!isNaN(val) && !isNaN(rate)) {
                // Simplified assumption based on screenshot "1 USD = - BRL"
                // The user inputs the multiplier.
                // Destination = Source * Rate
                setDestinationAmount((val * rate).toFixed(2));
            }
        }
    }, [amount, exchangeRate, isInternationalTransfer, account.currency, sourceAccountObj?.currency]);

    const handleSubmit = () => {
        const val = parseFloat(amount.replace(',', '.'));
        const destVal = isInternationalTransfer ? parseFloat(destinationAmount) : undefined;
        const rateVal = isInternationalTransfer ? parseFloat(exchangeRate.replace(',', '.')) : undefined;

        if (val > 0) {
            if (isInternationalTransfer) {
                if (!destVal || destVal <= 0) {
                    alert('Valor final inválido!');
                    return;
                }
                if (!rateVal || rateVal <= 0) {
                    alert('Informe a cotação!');
                    return;
                }
            }
            onConfirm(val, description, sourceId, destVal, rateVal, date);
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'DEPOSIT': return 'Novo Depósito';
            case 'WITHDRAW': return 'Realizar Saque';
            case 'TRANSFER': return 'Transferência';
            case 'PAY_INVOICE': return 'Pagar Fatura';
            default: return 'Ação';
        }
    };

    const currencySymbol = (curr: string) => curr === 'USD' ? 'US$' : (curr === 'EUR' ? '€' : 'R$');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md bg-slate-900 text-white shadow-2xl overflow-hidden border border-slate-700" title={getTitle()}>
                <div className="space-y-6">

                    {/* CUSTOM UI FOR INTERNATIONAL TRANSFER */}
                    {type === 'TRANSFER' && (
                        <div className="space-y-6">
                            {/* 1. Toggle Mode (Visual only for now, logic handled by selector) */}
                            <div className="bg-slate-800 p-1 rounded-xl flex">
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isInternationalTransfer ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => setSourceId('')} // Resetting sourceId effectively resets state
                                >
                                    Manter em {account.currency}
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isInternationalTransfer ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => { }} // Just visual, user uses selector
                                >
                                    Converter p/ Outra
                                </button>
                            </div>

                            {/* 2. Amount Input (Origin) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                    Valor a Enviar ({account.currency})
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg">
                                        {currencySymbol(account.currency)}
                                    </span>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full pl-14 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-bold text-white placeholder:text-slate-600 transition-all"
                                        placeholder="0,00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* 3. Conversion Details (Only if Converting) */}
                            {isInternationalTransfer && (
                                <div className="space-y-4 animate-in slide-in-from-top-4">
                                    {/* Rate Input */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                            Cotação do Dia
                                        </label>
                                        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                            <span className="font-bold text-slate-300">1 {account.currency} = </span>
                                            <input
                                                type="number"
                                                className="flex-1 bg-transparent border-b border-slate-600 focus:border-indigo-500 outline-none text-center font-bold text-white text-lg"
                                                placeholder="0.00"
                                                value={exchangeRate}
                                                onChange={(e) => setExchangeRate(e.target.value)}
                                            />
                                            <span className="font-bold text-slate-300">{sourceAccountObj?.currency}</span>
                                        </div>
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                            Data do Recebimento/Envio
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-white font-bold appearance-none"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                            />
                                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Final Value Display */}
                                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-500">Valor Final</span>
                                        <span className="text-2xl sm:text-3xl font-black text-white">
                                            {sourceAccountObj ? currencySymbol(sourceAccountObj.currency) : ''} {destinationAmount || '0,00'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Destination Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                    Receber na conta:
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-white appearance-none cursor-pointer"
                                    value={sourceId}
                                    onChange={(e) => setSourceId(e.target.value)}
                                >
                                    <option value="" disabled>Selecione...</option>
                                    {accounts
                                        .filter(a => a.id !== account.id) // Filter self
                                        .filter(a => a.type !== AccountType.CREDIT_CARD) // No transfer to CC
                                        .map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} ({acc.currency})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                    )}

                    {type !== 'TRANSFER' && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Valor
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                                        {currencySymbol(account.currency)}
                                    </span>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-2xl font-bold text-slate-900 placeholder:text-slate-300 transition-all"
                                        placeholder="0,00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            {type !== 'PAY_INVOICE' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Descrição</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900"
                                        placeholder={type === 'DEPOSIT' ? 'Ex: Venda extra' : 'Ex: Saque caixa eletrônico'}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>
                            )}

                            {type === 'PAY_INVOICE' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Pagar com saldo de:
                                    </label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        <select
                                            className="w-full pl-10 pr-10 py-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800 appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
                                            value={sourceId}
                                            onChange={(e) => setSourceId(e.target.value)}
                                        >
                                            <option value="" disabled>Selecione uma conta...</option>
                                            {accounts
                                                .filter(a => type === 'PAY_INVOICE' ? a.type !== AccountType.CREDIT_CARD : a.id !== account.id)
                                                .map(acc => (
                                                    <option key={acc.id} value={acc.id} className="text-slate-900 font-medium py-2">
                                                        {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {type === 'WITHDRAW' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Mover para Carteira? (Opcional)</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        <select
                                            className="w-full pl-10 pr-10 py-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                                            value={sourceId}
                                            onChange={(e) => setSourceId(e.target.value)}
                                        >
                                            <option value="">Não, apenas registrar saída</option>
                                            {accounts.filter(a => a.type === AccountType.CASH).map(acc => (
                                                <option key={acc.id} value={acc.id} className="text-slate-900">Enviar para: {acc.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 border-transparent text-slate-300 font-bold">Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            className={`flex-1 h-12 text-white font-bold shadow-lg ${type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' :
                                type === 'WITHDRAW' || type === 'PAY_INVOICE' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
                                    'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' // Green confirm for transfer too
                                }`}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};