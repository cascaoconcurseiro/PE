import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Check, AlertCircle, Globe, CreditCard, Landmark } from 'lucide-react';
import { AVAILABLE_CURRENCIES } from '../../services/currencyService';

interface AccountFormProps {
    type: 'BANKING' | 'CARDS' | 'INTERNATIONAL';
    initialData?: Account;
    onSave: (account: Partial<Account>) => void;
    onCancel: () => void;
}

export const AccountForm: React.FC<AccountFormProps> = ({ type, initialData, onSave, onCancel }) => {
    // Internal state for International flow
    const [intlSubType, setIntlSubType] = useState<'ACCOUNT' | 'CARD'>('ACCOUNT');
    const [intlCardType, setIntlCardType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

    const [newAccount, setNewAccount] = useState<Partial<Account>>({
        type: AccountType.CHECKING,
        currency: type === 'INTERNATIONAL' ? 'USD' : 'BRL',
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
                balance: initialData.initialBalance !== undefined ? initialData.initialBalance : initialData.balance
            });
            // Try to infer subtypes for UI state if editing (simplified)
            if (type === 'INTERNATIONAL') {
                if (initialData.type === AccountType.CREDIT_CARD) {
                    setIntlSubType('CARD');
                    setIntlCardType('CREDIT');
                } else {
                    // Checking implies Account OR Debit Card. 
                    // Without extra metadata, we assume Account for edit simplicity unless explicitly named "Card"
                    // But for creation flow, we keep explicit.
                }
            }
        } else {
            // Set defaults based on type
            if (type === 'CARDS') setNewAccount(prev => ({ ...prev, type: AccountType.CREDIT_CARD }));
            if (type === 'BANKING') setNewAccount(prev => ({ ...prev, type: AccountType.CHECKING }));
            if (type === 'INTERNATIONAL') {
                // Logic handles dynamic type updates in render/effects
                updateIntlType(intlSubType, intlCardType);
            }
        }
    }, [initialData, type]);

    const updateIntlType = (sub: 'ACCOUNT' | 'CARD', card: 'DEBIT' | 'CREDIT') => {
        if (sub === 'ACCOUNT') {
            setNewAccount(prev => ({ ...prev, type: AccountType.CHECKING }));
        } else {
            if (card === 'DEBIT') {
                setNewAccount(prev => ({ ...prev, type: AccountType.CHECKING })); // Debit acts like Checking
            } else {
                setNewAccount(prev => ({ ...prev, type: AccountType.CREDIT_CARD }));
            }
        }
    };

    // Watch for internal state changes in International mode to update Account Type
    useEffect(() => {
        if (type === 'INTERNATIONAL') {
            updateIntlType(intlSubType, intlCardType);
        }
    }, [intlSubType, intlCardType, type]);

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

        onSave({
            ...newAccount,
            initialBalance: newAccount.balance
        });
    };

    const isEditing = !!initialData;
    const showCreditFields = newAccount.type === AccountType.CREDIT_CARD;

    return (
        <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700" title={isEditing ? "Editar Conta" : (type === 'BANKING' ? "Nova Conta Bancária" : type === 'CARDS' ? "Novo Cartão de Crédito" : "Nova Conta Internacional")}>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* INTERNATIONAL SELECTION LOGIC */}
                {type === 'INTERNATIONAL' && !isEditing && (
                    <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">O que você vai cadastrar?</label>
                        
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIntlSubType('ACCOUNT')}
                                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${intlSubType === 'ACCOUNT' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                            >
                                <Landmark className="w-4 h-4" /> Conta Global
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIntlSubType('CARD')}
                                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${intlSubType === 'CARD' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                            >
                                <CreditCard className="w-4 h-4" /> Cartão
                            </button>
                        </div>

                        {intlSubType === 'CARD' && (
                            <div className="animate-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-2">Tipo do Cartão</label>
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setIntlCardType('DEBIT')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${intlCardType === 'DEBIT' ? 'border-blue-500 bg-blue-500 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 bg-transparent'}`}
                                    >
                                        Débito
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIntlCardType('CREDIT')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${intlCardType === 'CREDIT' ? 'border-blue-500 bg-blue-500 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 bg-transparent'}`}
                                    >
                                        Crédito
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                        <input className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder={type === 'BANKING' ? "Ex: Nubank, Carteira" : "Ex: Wise, Nomad, Inter Global"} value={newAccount.name || ''} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                            {type === 'INTERNATIONAL' ? (
                                <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-sm font-medium cursor-not-allowed">
                                    {newAccount.type === AccountType.CREDIT_CARD ? 'Cartão de Crédito' : intlSubType === 'CARD' ? 'Cartão de Débito' : 'Conta Corrente'}
                                </div>
                            ) : (
                                <select className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm font-normal" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}>
                                    {type === 'BANKING' ? Object.values(AccountType).filter(t => t !== AccountType.CREDIT_CARD).map(t => <option key={t} value={t}>{t}</option>) : <option value={AccountType.CREDIT_CARD}>{AccountType.CREDIT_CARD}</option>}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moeda</label>
                            <div className="relative">
                                <select className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-slate-900 dark:text-white text-sm font-normal" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>
                                    {AVAILABLE_CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}
                                </select>
                                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {showCreditFields ? (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limite Total</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.limit || ''} onChange={e => setNewAccount({ ...newAccount, limit: parseFloat(e.target.value) })} required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dia Fechamento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.closingDay || ''} onChange={e => setNewAccount({ ...newAccount, closingDay: parseInt(e.target.value) })} required /></div>
                                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dia Vencimento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.dueDay || ''} onChange={e => setNewAccount({ ...newAccount, dueDay: parseInt(e.target.value) })} required /></div>
                            </div>
                        </>
                    ) : (
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Saldo Inicial</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.balance || ''} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) })} /><p className="text-[10px] text-slate-500 mt-1">Este valor será o ponto de partida do saldo.</p></div>
                    )}
                </div>
                {formError && <div className="text-red-700 text-sm font-bold p-3 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {formError}</div>}
                <div className="flex justify-end pt-2 gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" variant="primary"><Check className="w-4 h-4 mr-2" /> Salvar</Button></div>
            </form>
        </Card>
    );
};