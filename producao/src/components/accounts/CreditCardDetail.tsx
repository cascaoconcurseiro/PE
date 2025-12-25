import { TransactionDeleteModal } from '../../features/transactions/TransactionDeleteModal';
import { useState, useMemo, useEffect } from 'react';
import { ActionModal, ActionType } from './ActionModal';
import { useDataStore } from '../../hooks/useDataStore';
import { Account, Transaction } from '../../types';
import { getInvoiceData } from '../../services/accountUtils';
import { formatCurrency } from '../../utils';
import { CreditCard, FileUp, ChevronLeft, ChevronRight, Lock, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { TransactionList } from '../../features/transactions/TransactionList';

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
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
}

export const CreditCardDetail: React.FC<CreditCardDetailProps> = ({
    account, transactions, currentDate, showValues, onAction, onAnticipateInstallments, onImportBills, onDeleteTransaction
}) => {
    // Get all accounts for correct name resolution (e.g. transfers)
    const { accounts, familyMembers, handlers } = useDataStore();
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null, isSeries: boolean }>({ isOpen: false, id: null, isSeries: false });

    // Logic to determine the most relevant invoice view
    // If today is Dec 8th and Closing is Dec 1st, "Dec Invoice" is closed.
    // The "Active" spending is in the "Jan Invoice" (starts Dec 2nd).
    // So we default to next month if past closing day.
    const getTargetDate = (date: Date, closingDay?: number) => {
        if (!closingDay) return date;
        const d = new Date(date);
        // Safety: ensure we are comparing day vs day properly by ignoring time
        const currentDay = d.getDate();
        if (currentDay > closingDay) {
            d.setMonth(d.getMonth() + 1);
        }
        return d;
    };

    // Initialize with smart logic
    const [selectedDate, setSelectedDate] = useState(() => getTargetDate(currentDate, account.closingDay));

    // ✅ FIX: Removido useEffect que sincronizava com currentDate
    // A fatura deve usar APENAS seu próprio seletor (← →)
    // Não deve ser afetada pelo seletor global do TopBar

    // Load transactions for the selected month when navigating
    useEffect(() => {
        if (handlers?.ensurePeriodLoaded) {
            handlers.ensurePeriodLoaded(selectedDate);
        }
    }, [selectedDate, handlers]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedDate(newDate);
    };

    // Use getInvoiceData with SELECTED DATE (Strict Month/Year)
    const { invoiceTotal, transactions: filteredTransactions, closingDate, status, daysToClose, dueDate } = getInvoiceData(account, transactions, selectedDate);

    // Calculate start date for display (Closing Date - 1 month + 1 day)
    const startDate = new Date(closingDate);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(startDate.getDate() + 1);

    const monthName = closingDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const rangeStr = `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${closingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

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
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Invoice Navigation Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}><ChevronLeft className="w-5 h-5" /></Button>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white capitalize">Fatura de {monthName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ciclo: {rangeStr}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}><ChevronRight className="w-5 h-5" /></Button>
            </div>

            {/* Main Summary Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 w-full h-2 ${status === 'CLOSED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>

                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${status === 'CLOSED' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <span className={`text-sm font-bold uppercase tracking-wider ${status === 'CLOSED' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {status === 'CLOSED' ? 'Fatura Fechada' : 'Fatura Aberta'}
                                </span>
                            </div>
                            <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${status === 'CLOSED' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                <PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur>
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                                {status === 'OPEN'
                                    ? `Fecha em ${daysToClose} dias (Dia ${account.closingDay})`
                                    : `Fechou dia ${closingDate.toLocaleDateString('pt-BR')}`}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {invoiceTotal > 0 && (
                                <Button
                                    onClick={() => onAction('PAY_INVOICE', invoiceTotal.toString())}
                                    className={`w-full md:w-auto rounded-xl font-bold shadow-lg text-white min-w-[160px] ${status === 'CLOSED' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'}`}
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
                    <div className="flex gap-2 items-center">
                        <Lock className="w-3 h-3" /> Fechamento: Dia {account.closingDay}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Calendar className="w-3 h-3" /> Vencimento: Dia {dueDate.getDate()}
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 px-2">
                    Lançamentos ({filteredTransactions.length})
                </h3>
                <TransactionList
                    groupedTxs={groupedTransactions}
                    accounts={accounts || []} // Use global accounts list here!
                    familyMembers={familyMembers || []}
                    showValues={showValues}
                    onEdit={() => { }} // View only 
                    onDelete={handleDeleteRequest}
                    onAddClick={() => { }}
                    onAnticipateInstallments={onAnticipateInstallments}
                    emptyMessage="Nenhuma compra nesta fatura."
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