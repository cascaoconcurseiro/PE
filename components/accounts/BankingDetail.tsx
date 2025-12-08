import React from 'react';
import { Account, Transaction, TransactionType } from '../../types';
import { ArrowUpRight, ArrowDownLeft, Landmark, RefreshCcw } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { getBankExtract } from '../../services/accountUtils';
import { ActionType } from './ActionModal';

// Reusable Privacy Blur
const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

interface BankingDetailProps {
    account: Account;
    transactions: Transaction[];
    showValues: boolean;
    currentDate: Date;
    onAction: (type: ActionType) => void;
}

export const BankingDetail: React.FC<BankingDetailProps> = ({
    account, transactions, showValues, currentDate, onAction
}) => {
    const extractTxs = getBankExtract(account.id, transactions, currentDate);
    const income = extractTxs.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + (b.isRefund ? -b.amount : b.amount), 0);
    const expense = extractTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + (b.isRefund ? -b.amount : b.amount), 0);

    return (
        <div className="space-y-6">
            {/* --- ACCOUNT HEADER CARD --- */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden print:bg-white print:text-black print:border print:border-black">
                <div className="absolute top-0 right-0 p-32 opacity-10 no-print"><Landmark className="w-32 h-32" /></div>
                <div className="relative z-10">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo em Conta</p>
                    <h3 className="text-5xl font-black mt-2 tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></h3>
                    <div className="mt-8 flex gap-8">
                        <div><div className="flex items-center gap-1 text-emerald-400 mb-1"><ArrowUpRight className="w-4 h-4" /><span className="text-xs font-bold uppercase">Entradas</span></div><p className="font-mono text-lg"><PrivacyBlur showValues={showValues}>{formatCurrency(income, account.currency)}</PrivacyBlur></p></div>
                        <div><div className="flex items-center gap-1 text-red-400 mb-1"><ArrowDownLeft className="w-4 h-4" /><span className="text-xs font-bold uppercase">Saídas</span></div><p className="font-mono text-lg"><PrivacyBlur showValues={showValues}>{formatCurrency(expense, account.currency)}</PrivacyBlur></p></div>
                    </div>
                </div>
            </div>

            {/* --- QUICK ACTIONS --- */}
            <div className="grid grid-cols-3 gap-3 no-print">
                <button onClick={() => onAction('DEPOSIT')} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400"><ArrowUpRight className="w-5 h-5" /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Depositar</span>
                </button>
                <button onClick={() => onAction('WITHDRAW')} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-700 dark:text-red-400"><ArrowDownLeft className="w-5 h-5" /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sacar</span>
                </button>
                <button onClick={() => onAction('TRANSFER')} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-400"><RefreshCcw className="w-5 h-5" /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Transferir</span>
                </button>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 px-2">Extrato Detalhado</h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                    {extractTxs.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400"><p className="text-sm">Nenhuma movimentação.</p></div> :
                        extractTxs.map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
                            return (
                                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><CatIcon className="w-5 h-5" /></div>
                                        <div><p className="text-sm font-bold text-slate-800 dark:text-white">{t.description}</p><p className="text-xs text-slate-600 dark:text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p></div>
                                    </div>
                                    <span className={`font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>{isPositive ? '+' : '-'}<PrivacyBlur showValues={showValues}>{formatCurrency(t.amount, account.currency)}</PrivacyBlur></span>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
};