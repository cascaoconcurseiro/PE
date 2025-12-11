import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';
import { ChevronDown, Wallet } from 'lucide-react';

export type ActionType = 'PAY_INVOICE' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';

interface ActionModalProps {
    isOpen: boolean;
    type: ActionType;
    account: Account;
    accounts: Account[];
    initialAmount?: string;
    onClose: () => void;
    onConfirm: (amount: number, description: string, sourceId: string, destinationAmount?: number) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
    isOpen, type, account, accounts, initialAmount = '', onClose, onConfirm
}) => {
    const [amount, setAmount] = useState(initialAmount);
    const [destinationAmount, setDestinationAmount] = useState('');
    const [description, setDescription] = useState('');
    const [sourceId, setSourceId] = useState('');

    useEffect(() => {
        setAmount(initialAmount);
        setDestinationAmount('');
    }, [initialAmount, isOpen]);

    // Reset when type changes
    useEffect(() => {
        setSourceId('');
        setDestinationAmount('');
    }, [type]);

    if (!isOpen) return null;

    const sourceAccountObj = accounts.find(a => a.id === sourceId);
    const isMultiCurrency = type === 'TRANSFER' && sourceAccountObj && account.currency !== sourceAccountObj.currency;

    const handleSubmit = () => {
        const val = parseFloat(amount.replace(',', '.'));
        const destVal = isMultiCurrency ? parseFloat(destinationAmount.replace(',', '.')) : undefined;

        if (val > 0) {
            if (isMultiCurrency && (!destVal || destVal <= 0)) {
                // Should show error, but for now relying on user. 
                // Ideally useToast here or block.
                alert('Informe o valor convertido!');
                return;
            }
            onConfirm(val, description, sourceId, destVal);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden" title={getTitle()}>
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Valor {isMultiCurrency ? `(${account.currency})` : ''}
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                                {account.currency === 'USD' ? '$' : (account.currency === 'EUR' ? '€' : 'R$')}
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

                    {(type === 'TRANSFER' || type === 'PAY_INVOICE') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                {type === 'PAY_INVOICE' ? 'Pagar com saldo de:' : 'Para (Destino):'}
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
                                        .filter(a => {
                                            // 1. Remove current account
                                            if (a.id === account.id) return false;

                                            // 2. Strict Credit Card Filter for Transfers
                                            if (type === 'TRANSFER') {
                                                if (a.type === AccountType.CREDIT_CARD || (a.type as string) === 'CREDIT_CARD') return false;
                                            }

                                            // 3. For Invoice Pay, only allow Non-Credit
                                            if (type === 'PAY_INVOICE') {
                                                if (a.type === AccountType.CREDIT_CARD || (a.type as string) === 'CREDIT_CARD') return false;
                                            }

                                            return true;
                                        })
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

                    {/* MULTI-CURRENCY CONVERSION FIELD */}
                    {isMultiCurrency && (
                        <div className="animate-in fade-in slide-in-from-top-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-1.5">
                                Valor Convertido em {sourceAccountObj?.currency}
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-lg">
                                    {sourceAccountObj?.currency === 'USD' ? '$' : (sourceAccountObj?.currency === 'EUR' ? '€' : 'R$')}
                                </span>
                                <input
                                    type="number"
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xl font-bold text-slate-900 placeholder:text-slate-300 transition-all"
                                    placeholder="0,00"
                                    value={destinationAmount}
                                    onChange={(e) => setDestinationAmount(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                                Taxa implícita: {amount && destinationAmount ? (parseFloat(destinationAmount) / parseFloat(amount)).toFixed(4) : '-'}
                            </p>
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

                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 font-bold">Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            className={`flex-1 h-12 text-white font-bold shadow-lg ${type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' :
                                type === 'WITHDRAW' || type === 'PAY_INVOICE' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
                                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
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