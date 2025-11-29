import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Check, AlertCircle, Globe } from 'lucide-react';
import { AVAILABLE_CURRENCIES } from '../../services/currencyService';

interface AccountFormProps {
    type: 'BANKING' | 'CARDS';
    initialData?: Account;
    onSave: (account: Partial<Account>) => void;
    onCancel: () => void;
}

export const AccountForm: React.FC<AccountFormProps> = ({ type, initialData, onSave, onCancel }) => {
    const [newAccount, setNewAccount] = useState<Partial<Account>>({
        type: type === 'CARDS' ? AccountType.CREDIT_CARD : AccountType.CHECKING,
        currency: 'BRL',
        balance: 0,
        initialBalance: 0,
        limit: 0,
        closingDay: 1,
        dueDay: 10
    });
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setNewAccount({
                ...initialData,
                // Para edição, usamos o initialBalance no campo de saldo se ele existir, 
                // caso contrário usamos o balance atual como fallback
                balance: initialData.initialBalance !== undefined ? initialData.initialBalance : initialData.balance
            });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!newAccount.name?.trim()) {
            setFormError("Nome da conta é obrigatório.");
            return;
        }

        if (newAccount.type === AccountType.CREDIT_CARD) {
            if ((newAccount.limit || 0) <= 0) {
                setFormError("O limite deve ser maior que zero.");
                return;
            }
            if (!newAccount.closingDay || newAccount.closingDay < 1 || newAccount.closingDay > 31) {
                setFormError("Dia de fechamento inválido.");
                return;
            }
            if (!newAccount.dueDay || newAccount.dueDay < 1 || newAccount.dueDay > 31) {
                setFormError("Dia de vencimento inválido.");
                return;
            }
        }

        // Ao salvar, garantimos que o balance do formulário (que representa o saldo inicial visualmente)
        // seja salvo como initialBalance
        onSave({
            ...newAccount,
            initialBalance: newAccount.balance
        });
    };

    const isEditing = !!initialData;

    return (
        <Card className="bg-slate-50/50 border-slate-200" title={isEditing ? "Editar Conta" : (type === 'BANKING' ? "Nova Conta Bancária" : "Novo Cartão de Crédito")}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                        <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder={type === 'BANKING' ? "Ex: Nubank, Carteira" : "Ex: Nubank Gold, Itaú Black"} value={newAccount.name || ''} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} required list="brokerages" />
                        <datalist id="brokerages"><option value="Nubank" /><option value="Inter" /><option value="Itaú" /><option value="Bradesco" /><option value="Santander" /><option value="C6 Bank" /><option value="XP" /><option value="BTG" /></datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                            <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 text-sm font-normal" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}>{type === 'BANKING' ? Object.values(AccountType).filter(t => t !== AccountType.CREDIT_CARD).map(t => <option key={t} value={t}>{t}</option>) : <option value={AccountType.CREDIT_CARD}>{AccountType.CREDIT_CARD}</option>}</select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Moeda</label>
                            <div className="relative"><select className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-slate-900 text-sm font-normal" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>{AVAILABLE_CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}</select><Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" /></div>
                        </div>
                    </div>
                    {type === 'CARDS' ? (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Limite Total</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.limit || ''} onChange={e => setNewAccount({ ...newAccount, limit: parseFloat(e.target.value) })} required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Dia Fechamento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.closingDay || ''} onChange={e => setNewAccount({ ...newAccount, closingDay: parseInt(e.target.value) })} required /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Dia Vencimento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.dueDay || ''} onChange={e => setNewAccount({ ...newAccount, dueDay: parseInt(e.target.value) })} required /></div>
                            </div>
                        </>
                    ) : (
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.balance || ''} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) })} /><p className="text-[10px] text-slate-500 mt-1">Este valor será o ponto de partida do saldo da conta.</p></div>
                    )}
                </div>
                {formError && <div className="text-red-700 text-sm font-bold p-3 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {formError}</div>}
                <div className="flex justify-end pt-2 gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" variant="primary"><Check className="w-4 h-4 mr-2" /> Salvar</Button></div>
            </form>
        </Card>
    );
};