import React, { useMemo } from 'react';
import { Account, Transaction, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { ArrowDownLeft, Clock, FileUp, ShoppingBag, CreditCard, Users } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { ActionType } from './ActionModal';
import { getInvoiceData } from '../../services/accountUtils';
import { TransactionList } from '../transactions/TransactionList';
import { useDataStore } from '../../hooks/useDataStore';

// Reusable Privacy Blur
const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

interface CreditCardDetailProps {
    account: Account;
    transactions: Transaction[];
    currentDate: Date;
    showValues: boolean;

    onAction: (type: ActionType, amount?: string) => void;
    onAnticipateInstallments: (tx: Transaction) => void;
    onImportBills: () => void;
}

export const CreditCardDetail: React.FC<CreditCardDetailProps> = ({
    account, transactions, currentDate, showValues, onAction, onAnticipateInstallments, onImportBills
}) => {
    // Get all accounts for correct name resolution (e.g. transfers)
    const { accounts, familyMembers } = useDataStore();

    // Use getInvoiceData to get transactions for the invoice cycle
    const { invoiceTotal, transactions: filteredTransactions, closingDate } = getInvoiceData(account, transactions, currentDate);

    // Calculate totals
    const finalTotal = invoiceTotal;

    // Group transactions by date for the new list
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTransactions.forEach(tx => {
            const dateKey = tx.date.split('T')[0];
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(tx);
        });
        return groups;
    }, [filteredTransactions]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Main Summary Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>

                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Fatura de {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
                                </span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                <PrivacyBlur showValues={showValues}>{formatCurrency(finalTotal, account.currency)}</PrivacyBlur>
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                                {filteredTransactions.length} lançamentos neste mês
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {finalTotal > 0 && (
                                <Button
                                    onClick={() => onAction('PAY_INVOICE', finalTotal.toString())}
                                    className="w-full md:w-auto rounded-xl font-bold shadow-lg shadow-violet-500/20 bg-violet-600 hover:bg-violet-700 text-white min-w-[160px]"
                                >
                                    Pagar Fatura
                                </Button>
                            )}
                            <Button
                                onClick={onImportBills}
                                variant="secondary"
                                className="w-full md:w-auto rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                <FileUp className="w-4 h-4 mr-2" /> Importar Dívidas
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mini Stats Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <div>
                        Limite: {formatCurrency(account.limit || 0, account.currency)}
                    </div>
                    <div>
                        Fechamento: Dia {account.closingDay}
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 px-2">
                    Lançamentos
                </h3>
                <TransactionList
                    groupedTxs={groupedTransactions}
                    accounts={accounts || []} // Use global accounts list here!
                    familyMembers={familyMembers || []}
                    showValues={showValues}
                    onEdit={() => { }} // View only 
                    onDelete={() => { }}
                    onAddClick={() => { }}
                    onAnticipateInstallments={onAnticipateInstallments}
                    emptyMessage="Nenhuma compra importada para este mês."
                />
            </div>
        </div>
    );
};