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
    onConfirm: (amount: number, description: string, sourceId: string) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({ 
    isOpen, type, account, accounts, initialAmount = '', onClose, onConfirm 
}) => {
    const [amount, setAmount] = useState(initialAmount);
    const [description, setDescription] = useState('');
    const [sourceId, setSourceId] = useState('');

    useEffect(() => {
        setAmount(initialAmount);
    }, [initialAmount, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        const val = parseFloat(amount);
        if (val > 0) {
            onConfirm(val, description, sourceId);
        }
    };

    const getTitle = () => {
        switch(type) {
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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Valor</label>
                        {type === 'PAY_INVOICE' ? (
                            <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="text-sm text-slate-500 mb-1 font-medium">Valor da Fatura</p>
                                <p className="text-3xl font-black text-slate-900">{formatCurrency(parseFloat(amount) || 0, account.currency)}</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">R$</span>
                                <input 
                                    type="number" 
                                    autoFocus 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-2xl font-bold text-slate-900 placeholder:text-slate-300 transition-all" 
                                    placeholder="0,00" 
                                    value={amount} 
                                    onChange={(e) => setAmount(e.target.value)} 
                                />
                            </div>
                        )}
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

                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={onClose} className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 font-bold">Cancelar</Button>
                        <Button 
                            onClick={handleSubmit} 
                            className={`flex-1 h-12 text-white font-bold shadow-lg ${
                                type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 
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