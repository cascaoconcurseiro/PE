import React from 'react';
import { Account, AccountType, Transaction } from '../../types';
import { CreditCard, Wallet, Banknote, Landmark, MoreHorizontal, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { getInvoiceData } from '../../services/accountUtils';

interface AccountCardProps {
    account: Account;
    transactions?: Transaction[];
    currentDate?: Date;
    showValues: boolean;
    onClick: (account: Account) => void;
}

const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

const getIcon = (type: AccountType) => {
    switch (type) {
        case AccountType.CREDIT_CARD: return <CreditCard className="w-6 h-6" />;
        case AccountType.SAVINGS: return <Banknote className="w-6 h-6" />;
        case AccountType.INVESTMENT: return <Landmark className="w-6 h-6" />;
        case AccountType.CASH: return <Wallet className="w-6 h-6" />;
        default: return <Wallet className="w-6 h-6" />;
    }
};

export const AccountCard: React.FC<AccountCardProps> = ({ account, transactions = [], currentDate = new Date(), showValues, onClick }) => {

    // RENDER: CREDIT CARD
    if (account.type === AccountType.CREDIT_CARD) {
        const { invoiceTotal } = getInvoiceData(account, transactions, currentDate);
        const limit = account.limit || 0;
        const committedBalance = Math.abs(account.balance);
        const percentageUsed = limit > 0 ? Math.min((committedBalance / limit) * 100, 100) : 0;

        return (
            <div onClick={() => onClick(account)} className="group relative w-full aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden text-white p-6 flex flex-col justify-between">
                {/* Removed external texture image - CSP violation */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px)`
                    }}></div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                <div className="relative z-10 flex justify-between items-start"><h3 className="font-bold text-lg tracking-wider uppercase opacity-90">{account.name}</h3><CreditCard className="w-6 h-6 opacity-60" /></div>
                <div className="relative z-10 flex justify-between items-end"><div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Fatura Atual</p><p className="font-mono font-bold text-lg tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur></p></div><div className="flex flex-col items-end"><span className="text-[10px] font-bold opacity-60">{percentageUsed.toFixed(0)}% Limite</span></div></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50"><div className={`h-full transition-all duration-1000 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-emerald-400'}`} style={{ width: `${percentageUsed}%` }}></div></div>
            </div>
        );
    }

    // RENDER: INTERNATIONAL (SPECIAL STYLE)
    if (account.currency !== 'BRL') {
        return (
            <div onClick={() => onClick(account)} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
                <div className="relative z-10 flex justify-between items-start mb-8"><div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-700 dark:text-blue-400 group-hover:bg-blue-200 transition-colors">{getIcon(account.type)}</div><button className="text-slate-300 dark:text-slate-500 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-5 h-5" /></button></div>
                <div className="relative z-10"><h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{account.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-4">{account.type === AccountType.CHECKING ? 'Conta Global' : account.type}</p><p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></p></div>
            </div>
        );
    }

    // RENDER: STANDARD BANKING
    return (
        <div onClick={() => onClick(account)} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-700 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
            <div className="relative z-10 flex justify-between items-start mb-8"><div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">{getIcon(account.type)}</div><button className="text-slate-300 dark:text-slate-500 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-5 h-5" /></button></div>
            <div className="relative z-10"><h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{account.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-4">{account.type}</p><p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></p></div>
        </div>
    );
};

interface AddAccountCardProps {
    onClick: () => void;
    label: string;
    variant?: 'emerald' | 'blue';
}

export const AddAccountCard: React.FC<AddAccountCardProps> = ({ onClick, label, variant = 'emerald' }) => {
    const hoverBorder = variant === 'blue' ? 'hover:border-blue-500' : 'hover:border-emerald-500';
    const hoverText = variant === 'blue' ? 'hover:text-blue-600' : 'hover:text-emerald-600';
    const hoverBg = variant === 'blue' ? 'hover:bg-blue-50/50' : 'hover:bg-emerald-50/50';
    const circleHoverBg = variant === 'blue' ? 'group-hover:bg-blue-100' : 'group-hover:bg-emerald-100';

    return (
        <button onClick={onClick} className={`border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 ${hoverBorder} ${hoverText} ${hoverBg} transition-all group min-h-[200px]`}>
            <div className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${circleHoverBg} transition-colors`}>
                <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">{label}</span>
        </button>
    );
};
