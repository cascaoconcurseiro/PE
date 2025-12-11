import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';
import { Check, ChevronDown, Wallet, CreditCard, Landmark, Banknote } from 'lucide-react';

interface AccountSelectorProps {
    label: string;
    accounts: Account[];
    selectedId: string;
    onSelect: (id: string) => void;
    filterType?: 'NO_CREDIT' | 'ALL';
    disabled?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
    label,
    accounts,
    selectedId,
    onSelect,
    filterType,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredAccounts = useMemo(() => {
        if (filterType === 'NO_CREDIT') {
            return accounts.filter(a => a.type !== AccountType.CREDIT_CARD && (a.type as string) !== 'CREDIT_CARD');
        }
        return accounts;
    }, [accounts, filterType]);

    const selectedAccount = accounts.find(a => a.id === selectedId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (type: AccountType) => {
        switch (type) {
            case AccountType.CREDIT_CARD: return <CreditCard className="w-5 h-5" />;
            case AccountType.INVESTMENT: return <Landmark className="w-5 h-5" />;
            case AccountType.SAVINGS: return <Banknote className="w-5 h-5" />;
            default: return <Wallet className="w-5 h-5" />;
        }
    };

    const getGradient = (type: AccountType) => {
        switch (type) {
            case AccountType.CREDIT_CARD: return 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white';
            case AccountType.INVESTMENT: return 'bg-gradient-to-br from-slate-700 to-slate-900 text-white';
            case AccountType.SAVINGS: return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white';
            case AccountType.CASH: return 'bg-gradient-to-br from-green-500 to-emerald-600 text-white';
            default: return 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white';
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block pl-1">{label}</label>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    relative rounded-xl p-3 flex items-center gap-3 shadow-md transition-all cursor-pointer overflow-hidden
                    ${selectedAccount ? getGradient(selectedAccount.type) : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}
                    ${disabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.99]'}
                `}
            >
                {selectedAccount && (
                    <>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/10 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none"></div>
                    </>
                )}

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${selectedAccount ? 'bg-white/20 backdrop-blur-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {getIcon(selectedAccount?.type || AccountType.CHECKING)}
                </div>

                <div className="flex-1 overflow-hidden z-10">
                    <span className={`block text-sm font-bold truncate mb-0.5 ${selectedAccount ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {selectedAccount?.name || 'Selecione uma conta'}
                    </span>
                    <span className={`text-[10px] font-medium truncate block uppercase tracking-wider ${selectedAccount ? 'text-white/80' : 'text-slate-500'}`}>
                        {selectedAccount ? `${selectedAccount.type} • ${selectedAccount.currency}` : 'Toque para selecionar'}
                    </span>
                </div>

                <ChevronDown className={`w-5 h-5 shrink-0 z-10 transition-transform ${isOpen ? 'rotate-180' : ''} ${selectedAccount ? 'text-white/70' : 'text-slate-400'}`} />
            </div>

            {isOpen && (
                <div className="absolute inset-x-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                    {filteredAccounts.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">Nenhuma conta disponível.</div>
                    ) : (
                        filteredAccounts.map(acc => (
                            <div
                                key={acc.id}
                                onClick={() => { onSelect(acc.id); setIsOpen(false); }}
                                className={`p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0 ${acc.id === selectedId ? 'bg-slate-50 dark:bg-slate-700' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${acc.type === AccountType.CREDIT_CARD ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                    {getIcon(acc.type)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{acc.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{acc.type} • {formatCurrency(acc.balance, acc.currency)}</p>
                                </div>
                                {acc.id === selectedId && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
