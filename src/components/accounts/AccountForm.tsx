import React, { useState, useEffect } from 'react';
import { Account, AccountType, CardBrand } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Check, AlertCircle, Globe, CreditCard, Landmark, Search } from 'lucide-react';
import { AVAILABLE_CURRENCIES } from '../../services/currencyService';
import { getBankSvg, BRAZILIAN_BANKS, INTERNATIONAL_BANKS, BankInfo } from '../../utils/bankLogos';

// Bandeiras de cartão disponíveis
const CARD_BRANDS: { value: CardBrand; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'diners', label: 'Diners Club' },
  { value: 'alelo', label: 'Alelo' },
  { value: 'sodexo', label: 'Sodexo' },
  { value: 'vr', label: 'VR' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'flash', label: 'Flash' },
  { value: 'caju', label: 'Caju' },
  { value: 'swile', label: 'Swile' },
];

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
    
    // Bank selection state
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankSelector, setShowBankSelector] = useState(true);

    const [newAccount, setNewAccount] = useState<Partial<Account>>({
        type: AccountType.CHECKING,
        currency: type === 'INTERNATIONAL' ? 'USD' : 'BRL',
        balance: 0,
        initialBalance: 0,
        limit: 0,
        closingDay: 1,
        dueDay: 10,
        cardBrand: undefined
    });
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setNewAccount({
                ...initialData,
                balance: initialData.initialBalance !== undefined ? initialData.initialBalance : initialData.balance
            });
            // Try to infer bank from name
            if (initialData.bankCode) {
                setSelectedBank(initialData.bankCode);
                setShowBankSelector(false);
            }
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
            initialBalance: newAccount.balance,
            bankCode: selectedBank || undefined
        });
    };

    // Handle bank selection
    const handleBankSelect = (bank: BankInfo) => {
        setSelectedBank(bank.code);
        setNewAccount(prev => ({ ...prev, name: bank.name }));
        setShowBankSelector(false);
        setBankSearch('');
    };

    // Get available banks based on type
    const availableBanks = type === 'INTERNATIONAL' ? INTERNATIONAL_BANKS : BRAZILIAN_BANKS;
    
    // Filter banks by search
    const filteredBanks = bankSearch 
        ? availableBanks.filter(b => 
            b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
            b.code.toLowerCase().includes(bankSearch.toLowerCase())
          )
        : availableBanks;

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
                    {/* Bank Selector - For all types when creating */}
                    {!isEditing && (
                        <div className="col-span-full">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {type === 'INTERNATIONAL' ? 'Instituição' : type === 'CARDS' ? 'Banco Emissor' : 'Banco'}
                            </label>
                            
                            {showBankSelector ? (
                                <div className="space-y-3">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm"
                                            placeholder="Buscar banco..."
                                            value={bankSearch}
                                            onChange={e => setBankSearch(e.target.value)}
                                        />
                                    </div>
                                    
                                    {/* Bank Grid */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-1">
                                        {filteredBanks.map(bank => {
                                            const svg = getBankSvg(bank.code);
                                            const isSelected = selectedBank === bank.code;
                                            return (
                                                <button
                                                    key={bank.code}
                                                    type="button"
                                                    onClick={() => handleBankSelect(bank)}
                                                    className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 hover:scale-105 ${
                                                        isSelected 
                                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md' 
                                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                                    title={bank.name}
                                                >
                                                    {svg ? (
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {bank.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center leading-tight">
                                                        {bank.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        
                                        {/* Custom/Other Option */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedBank('other');
                                                setShowBankSelector(false);
                                                setBankSearch('');
                                            }}
                                            className="p-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 transition-all flex flex-col items-center gap-1.5 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            title="Outro"
                                        >
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                                {type === 'CARDS' ? <CreditCard className="w-6 h-6 text-slate-400" /> : <Landmark className="w-6 h-6 text-slate-400" />}
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Outro</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Selected Bank Display */
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {selectedBank && selectedBank !== 'other' ? (
                                        <>
                                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" dangerouslySetInnerHTML={{ __html: getBankSvg(selectedBank) || '' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                    {availableBanks.find(b => b.code === selectedBank)?.name || selectedBank}
                                                </p>
                                                <p className="text-xs text-slate-500">{type === 'CARDS' ? 'Banco emissor' : 'Banco selecionado'}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                                                {type === 'CARDS' ? <CreditCard className="w-5 h-5 text-slate-400" /> : <Landmark className="w-5 h-5 text-slate-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Outro {type === 'CARDS' ? 'emissor' : 'banco'}</p>
                                                <p className="text-xs text-slate-500">Personalize o nome abaixo</p>
                                            </div>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowBankSelector(true);
                                            setSelectedBank(null);
                                        }}
                                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        Alterar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
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
                                <select
                                    className={`w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-slate-900 dark:text-white text-sm font-normal ${isEditing ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''}`}
                                    value={newAccount.currency}
                                    onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}
                                    disabled={isEditing}
                                >
                                    {AVAILABLE_CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}
                                </select>
                                <Globe className={`w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none ${isEditing ? 'opacity-50' : ''}`} />
                                {isEditing && <span className="absolute right-3 top-2.5 text-xs text-slate-400 no-print">Bloqueado</span>}
                            </div>
                            {isEditing && <p className="text-[10px] text-slate-500 mt-1">Não é possível alterar a moeda de uma conta ativa.</p>}
                        </div>
                    </div>

                    {showCreditFields ? (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limite Total</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.limit || ''} onChange={e => setNewAccount({ ...newAccount, limit: parseFloat(e.target.value) })} required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dia Fechamento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.closingDay || ''} onChange={e => setNewAccount({ ...newAccount, closingDay: parseInt(e.target.value) })} required /></div>
                                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dia Vencimento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.dueDay || ''} onChange={e => setNewAccount({ ...newAccount, dueDay: parseInt(e.target.value) })} required /></div>
                            </div>
                            
                            {/* Seletor de Bandeira */}
                            <div className="col-span-full">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bandeira do Cartão</label>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2">
                                    {CARD_BRANDS.map(brand => {
                                        const svg = getBankSvg(brand.value);
                                        const isSelected = newAccount.cardBrand === brand.value;
                                        return (
                                            <button
                                                key={brand.value}
                                                type="button"
                                                onClick={() => setNewAccount({ ...newAccount, cardBrand: brand.value })}
                                                className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                                                    isSelected 
                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                                title={brand.label}
                                            >
                                                {svg ? (
                                                    <div className="w-10 h-10" dangerouslySetInnerHTML={{ __html: svg }} />
                                                ) : (
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-xs font-bold text-slate-500">
                                                        {brand.label.substring(0, 2)}
                                                    </div>
                                                )}
                                                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center">{brand.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <input
                                    type="checkbox"
                                    id="isInternational"
                                    checked={newAccount.isInternational || false}
                                    onChange={e => setNewAccount({ ...newAccount, isInternational: e.target.checked })}
                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                />
                                <label htmlFor="isInternational" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                    Cartão Internacional <span className="text-xs font-normal text-slate-500">(Habilitar para uso em viagens)</span>
                                </label>
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