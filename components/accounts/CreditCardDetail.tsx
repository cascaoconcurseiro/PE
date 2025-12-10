import React from 'react';
import { Account, Transaction, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { ArrowDownLeft, Clock, FileUp, ShoppingBag, CreditCard, Users } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { ActionType } from './ActionModal';
import { getInvoiceData } from '../../services/accountUtils';

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
    // Use getInvoiceData to get transactions for the invoice cycle
    const { invoiceTotal, transactions: filteredTransactions, closingDate } = getInvoiceData(account, transactions, currentDate);
    
    // Calculate totals
    const finalTotal = invoiceTotal;

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
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredTransactions.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhuma compra importada para este mês.</p>
                            <p className="text-sm opacity-70 mt-1">Verifique se você importou as faturas ou parcelas.</p>
                        </div>
                    ) : (
                        filteredTransactions.map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            const isInstallment = !!t.isInstallment && !!t.totalInstallments && t.totalInstallments > 1;
                            const isSettled = t.isSettled; // Only consider if the main transaction (Invoice) is paid

                            return (
                                <div key={t.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isSettled ? 'opacity-60 grayscale' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.isRefund ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                            {t.isRefund ? <ArrowDownLeft className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                                {t.description}
                                            </p>
                                            <div className="flex gap-2 text-xs text-slate-600 dark:text-slate-300 items-center mt-1">
                                                <span className="text-slate-600 dark:text-slate-300">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                                {(t.isShared || (t.sharedWith && t.sharedWith.length > 0)) && (
                                                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 p-0.5 rounded" title="Compartilhado">
                                                        <Users className="w-3 h-3" />
                                                    </span>
                                                )}
                                                {isInstallment && (
                                                    <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                                        Parcela {t.currentInstallment}/{t.totalInstallments}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${t.isRefund ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                            {t.isRefund ? '-' : ''}{formatCurrency(t.amount, account.currency)}
                                        </span>
                                        {isInstallment && (t.currentInstallment || 0) < (t.totalInstallments || 0) && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={(e) => { e.stopPropagation(); onAnticipateInstallments(t); }}
                                                className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-xs h-8 px-3 font-bold"
                                                title="Antecipar parcelas"
                                            >
                                                <Clock className="w-3.5 h-3.5 sm:mr-1.5" />
                                                <span className="hidden sm:inline">Antecipar</span>
                                                <span className="sm:hidden">Ant.</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};