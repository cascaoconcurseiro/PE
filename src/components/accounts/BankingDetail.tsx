import { ActionModal, ActionType } from './ActionModal';
import { TransactionDeleteModal } from '../transactions/TransactionDeleteModal';
import { useState, useMemo } from 'react';
import { Landmark, ArrowUpRight, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { Account, Transaction, TransactionType } from '../../types';
import { useDataStore } from '../../hooks/useDataStore';
import { getBankExtract, calculateHistoricalBalance } from '../../services/accountUtils';
import { formatCurrency } from '../../utils';
import { TransactionList } from '../transactions/TransactionList';

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
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
}

export const BankingDetail: React.FC<BankingDetailProps> = ({
    account, transactions, showValues, currentDate, onAction, onDeleteTransaction
}) => {
    // Get all accounts for correct name resolution
    const { accounts } = useDataStore();
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null, isSeries: boolean }>({ isOpen: false, id: null, isSeries: false });

    const extractTxs = getBankExtract(account.id, transactions, currentDate);
    
    // Calculate income: INCOME transactions + Transfer IN (when this account is destination)
    const income = extractTxs.reduce((acc, t) => {
        // Transfer IN (this account is destination)
        if (t.type === TransactionType.TRANSFER && t.destinationAccountId === account.id) {
            return acc + (t.destinationAmount || t.amount);
        }
        // Regular income
        if (t.type === TransactionType.INCOME && t.accountId === account.id) {
            return acc + (t.isRefund ? -t.amount : t.amount);
        }
        return acc;
    }, 0);
    
    // Calculate expense: EXPENSE transactions + Transfer OUT (when this account is source)
    const expense = extractTxs.reduce((acc, t) => {
        // Transfer OUT (this account is source)
        if (t.type === TransactionType.TRANSFER && t.accountId === account.id) {
            return acc + t.amount;
        }
        // Regular expense
        if (t.type === TransactionType.EXPENSE && t.accountId === account.id) {
            return acc + (t.isRefund ? -t.amount : t.amount);
        }
        return acc;
    }, 0);

    // Calculate historical balance for the end of the selected month
    const displayBalance = calculateHistoricalBalance(account, transactions, currentDate);

    // Group transactions by date for the new list
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        extractTxs.forEach(tx => {
            const dateKey = tx.date.split('T')[0];
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(tx);
        });
        return groups;
    }, [extractTxs]);

    const handleDeleteRequest = (id: string) => {
        const tx = transactions.find(t => t.id === id);
        const isSeries = !!tx?.seriesId;
        setDeleteModal({ isOpen: true, id, isSeries });
    };

    const confirmDelete = (scope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        if (deleteModal.id) {
            onDeleteTransaction(deleteModal.id, scope);
            setDeleteModal({ isOpen: false, id: null, isSeries: false });
        }
    };

    return (
        <div className="space-y-6">
            {/* --- ACCOUNT HEADER CARD --- */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden print:bg-white print:text-black print:border print:border-black">
                <div className="absolute top-0 right-0 p-32 opacity-10 no-print"><Landmark className="w-32 h-32" /></div>
                <div className="relative z-10">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo em {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    <h3 className="text-5xl font-black mt-2 tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(displayBalance, account.currency)}</PrivacyBlur></h3>
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
                <TransactionList
                    groupedTxs={groupedTransactions}
                    accounts={accounts || []}
                    familyMembers={[]}
                    showValues={showValues}
                    onEdit={() => { }} // View only
                    onDelete={handleDeleteRequest}
                    onAddClick={() => { }}
                    emptyMessage="Nenhuma movimentação neste período."
                />
            </div>

            <TransactionDeleteModal
                isOpen={deleteModal.isOpen}
                isSeries={deleteModal.isSeries}
                onClose={() => setDeleteModal({ isOpen: false, id: null, isSeries: false })}
                onConfirm={confirmDelete}
            />
        </div>
    );
};