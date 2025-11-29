import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
            <Card className="w-full max-w-sm bg-white shadow-2xl" title={getTitle()}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor</label>
                        {type === 'PAY_INVOICE' ? (
                            <div className="text-center py-2"><p className="text-sm text-slate-600 mb-1">Total</p><p className="text-xl font-bold text-slate-900 mb-4">{formatCurrency(parseFloat(amount) || 0, account.currency)}</p></div>
                        ) : (
                            <input type="number" autoFocus className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-bold text-slate-900" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        )}
                    </div>
                    
                    {type !== 'PAY_INVOICE' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição (Opcional)</label>
                            <input type="text" className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder={type === 'DEPOSIT' ? 'Ex: Venda extra' : 'Ex: Saque caixa eletrônico'} value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                    )}

                    {type === 'TRANSFER' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Para (Destino)</label>
                            <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {accounts.filter(a => a.id !== account.id).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>)}
                            </select>
                        </div>
                    )}

                    {type === 'WITHDRAW' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mover para Carteira? (Opcional)</label>
                            <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                                <option value="">Não, apenas registrar saída</option>
                                {accounts.filter(a => a.type === AccountType.CASH).map(acc => <option key={acc.id} value={acc.id}>Enviar para: {acc.name}</option>)}
                            </select>
                        </div>
                    )}

                    {type === 'PAY_INVOICE' && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Pagar usando:</label>
                            <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>)}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button onClick={handleSubmit} className={`flex-1 text-white ${type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'WITHDRAW' || type === 'PAY_INVOICE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmar</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};