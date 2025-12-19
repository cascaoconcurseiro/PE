import React from 'react';
import { Account, AccountType, Transaction } from '../../types';
import { CreditCard, Wallet, Banknote, Landmark, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { getInvoiceData } from '../../services/accountUtils';
import { BankLogo } from '../ui/BankLogo';

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
        case AccountType.CREDIT_CARD: return <CreditCard className="w-5 h-5" />;
        case AccountType.SAVINGS: return <Banknote className="w-5 h-5" />;
        case AccountType.INVESTMENT: return <Landmark className="w-5 h-5" />;
        case AccountType.CASH: return <Wallet className="w-5 h-5" />;
        default: return <Wallet className="w-5 h-5" />;
    }
};

export const AccountCard: React.FC<AccountCardProps> = ({ account, transactions = [], currentDate = new Date(), showValues, onClick }) => {

    // RENDER: CREDIT CARD - Formato de cartão real
    if (account.type === AccountType.CREDIT_CARD) {
        const { invoiceTotal } = getInvoiceData(account, transactions, currentDate);
        const limit = account.limit || 0;
        const committedBalance = Math.abs(account.balance);
        const percentageUsed = limit > 0 ? Math.min((committedBalance / limit) * 100, 100) : 0;

        return (
            <div 
                onClick={() => onClick(account)} 
                className="group relative w-full max-w-[280px] aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden text-white p-4 flex flex-col justify-between"
            >
                {/* Textura sutil */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px)`
                    }}></div>
                </div>
                
                {/* Brilho no hover */}
                <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                
                {/* Header: Nome + Logo */}
                <div className="relative z-10 flex justify-between items-start">
                    <h3 className="font-bold text-sm tracking-wide uppercase opacity-90 truncate max-w-[60%]">{account.name}</h3>
                    <BankLogo 
                        accountName={account.name} 
                        size="sm"
                        className="opacity-80 group-hover:opacity-100 transition-opacity"
                        fallbackIcon={<CreditCard className="w-5 h-5 opacity-60" />}
                    />
                </div>
                
                {/* Footer: Valor + Limite */}
                <div className="relative z-10 flex justify-between items-end">
                    <div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Fatura</p>
                        <p className="font-mono font-bold text-base tracking-tight">
                            <PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur>
                        </p>
                    </div>
                    <span className="text-[9px] font-bold opacity-60">{percentageUsed.toFixed(0)}% usado</span>
                </div>
                
                {/* Barra de limite */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50">
                    <div className={`h-full transition-all duration-1000 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-emerald-400'}`} style={{ width: `${percentageUsed}%` }}></div>
                </div>
            </div>
        );
    }

    // RENDER: CONTA BANCÁRIA - Formato de cartão
    const isInternational = account.currency !== 'BRL';
    const bgGradient = isInternational 
        ? 'from-blue-600 via-blue-700 to-blue-800' 
        : 'from-emerald-600 via-emerald-700 to-emerald-800';
    
    return (
        <div 
            onClick={() => onClick(account)} 
            className={`group relative w-full max-w-[280px] aspect-[1.586/1] bg-gradient-to-br ${bgGradient} rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden text-white p-4 flex flex-col justify-between`}
        >
            {/* Textura sutil */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)`
                }}></div>
            </div>
            
            {/* Brilho no hover */}
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
            
            {/* Header: Logo + Tipo */}
            <div className="relative z-10 flex justify-between items-start">
                <BankLogo 
                    accountName={account.name} 
                    size="sm"
                    className="group-hover:scale-110 transition-transform"
                    fallbackIcon={
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            {getIcon(account.type)}
                        </div>
                    }
                />
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                    {isInternational ? account.currency : account.type === AccountType.SAVINGS ? 'Poupança' : account.type === AccountType.CASH ? 'Dinheiro' : 'Corrente'}
                </span>
            </div>
            
            {/* Footer: Nome + Saldo */}
            <div className="relative z-10">
                <h3 className="font-bold text-sm mb-1 truncate">{account.name}</h3>
                <p className="font-mono font-bold text-xl tracking-tight">
                    <PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur>
                </p>
            </div>
        </div>
    );
};

interface AddAccountCardProps {
    onClick: () => void;
    label: string;
    variant?: 'emerald' | 'blue';
}

export const AddAccountCard: React.FC<AddAccountCardProps> = ({ onClick, label, variant = 'emerald' }) => {
    const borderColor = variant === 'blue' ? 'border-blue-300 dark:border-blue-700 hover:border-blue-500' : 'border-emerald-300 dark:border-emerald-700 hover:border-emerald-500';
    const textColor = variant === 'blue' ? 'text-blue-400 hover:text-blue-600' : 'text-emerald-400 hover:text-emerald-600';

    return (
        <button 
            onClick={onClick} 
            className={`w-full max-w-[280px] aspect-[1.586/1] border-2 border-dashed ${borderColor} rounded-xl flex flex-col items-center justify-center gap-2 ${textColor} transition-all group hover:bg-slate-50 dark:hover:bg-slate-800/50`}
        >
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">{label}</span>
        </button>
    );
};
