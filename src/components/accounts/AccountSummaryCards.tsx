import React from 'react';
import { Wallet, CreditCard } from 'lucide-react';
import { formatCurrency } from '../../utils';

interface AccountSummaryCardsProps {
    totalBalance: number;
    totalCreditUsed: number;
    showValues: boolean;
}

const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

export const AccountSummaryCards: React.FC<AccountSummaryCardsProps> = ({ totalBalance, totalCreditUsed, showValues }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-32 h-32" /></div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Saldo Bancário (BRL)</p>
                <h2 className="text-3xl font-black tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(totalBalance)}</PrivacyBlur></h2>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard className="w-32 h-32" /></div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fatura Total Cartões</p>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white"><PrivacyBlur showValues={showValues}>{formatCurrency(totalCreditUsed)}</PrivacyBlur></h2>
            </div>
        </div>
    );
};
