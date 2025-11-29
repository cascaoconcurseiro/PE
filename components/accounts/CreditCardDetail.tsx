import React from 'react';
import { Account, Transaction, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { ArrowLeft, ArrowRight, ArrowDownLeft, Calendar, Lock, Smartphone, ShoppingBag } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { getInvoiceData, getCommittedBalance } from '../../services/accountUtils';
import { ActionType } from './ActionModal';

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
    onInvoiceDateChange: (date: Date) => void;
    onAction: (type: ActionType, amount?: string) => void;
}

export const CreditCardDetail: React.FC<CreditCardDetailProps> = ({ 
    account, transactions, currentDate, showValues, onInvoiceDateChange, onAction 
}) => {
    const { invoiceTotal, transactions: invoiceTxs, status, daysToClose, closingDate, dueDate } = getInvoiceData(account, transactions, currentDate);
    const limit = account.limit || 0;
    const committedBalance = getCommittedBalance(account, transactions);
    const available = limit - committedBalance;
    const percentageUsed = limit > 0 ? Math.min((committedBalance / limit) * 100, 100) : 0;

    // Helper to safely navigate months without date overflow bugs (e.g. 31 Jan -> Feb)
    const changeMonth = (direction: 'prev' | 'next') => {
        const d = new Date(currentDate);
        d.setDate(15); // Safe middle of month
        d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        onInvoiceDateChange(d);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 relative print:shadow-none print:border">
                <div className={`h-2 w-full ${status === 'CLOSED' ? 'bg-red-600' : 'bg-blue-600'}`}></div>

                <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-2 ${status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {status === 'CLOSED' ? 'Fatura Fechada' : 'Fatura Aberta'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Button variant="ghost" size="sm" onClick={() => changeMonth('prev')} className="h-8 w-8 p-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 no-print">
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-sm font-bold text-slate-800 capitalize min-w-[120px] text-center">
                                    {closingDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => changeMonth('next')} className="h-8 w-8 p-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 no-print">
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-sm text-slate-600 font-medium mt-2">
                                {status === 'OPEN' 
                                    ? `Fecha em ${daysToClose} dias (Dia ${account.closingDay})` 
                                    : `Fechada em ${closingDate.toLocaleDateString('pt-BR')}`
                                }
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-600 font-bold mb-1">Valor da Fatura</p>
                            <p className={`text-4xl font-black tracking-tight ${status === 'CLOSED' ? 'text-red-700' : 'text-slate-900'}`}><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur></p>
                        </div>
                    </div>

                    {invoiceTotal > 0 && (
                        <div className="mb-8 no-print">
                            <Button onClick={() => onAction('PAY_INVOICE', invoiceTotal.toString())} className={`w-full rounded-xl font-bold shadow-lg h-14 text-lg ${status === 'CLOSED' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/30'}`}>
                                <Smartphone className="w-5 h-5 mr-2" /> Pagar Fatura
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-slate-600 border-t border-slate-100 pt-6">
                        <div className="flex gap-2 items-center"><Calendar className="w-4 h-4 text-slate-400" /><span>Vence dia <strong>{dueDate.getDate()}</strong></span></div>
                        <div className="flex gap-2 items-center"><Lock className="w-4 h-4 text-slate-400" /><span>Fecha dia <strong>{account.closingDay}</strong></span></div>
                    </div>
                </div>

                <div className="px-8 pb-8 bg-slate-50/50 pt-6 border-t border-slate-100">
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-2"><span>Limite Utilizado</span><span>{formatCurrency(account.limit || 0, account.currency)}</span></div>
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mb-2"><div className={`h-full rounded-full ${percentageUsed > 90 ? 'bg-red-500' : percentageUsed > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentageUsed}%` }}></div></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">{formatCurrency(committedBalance, account.currency)}</span><span className="text-emerald-700 font-bold">Disp: <PrivacyBlur showValues={showValues}>{formatCurrency(available, account.currency)}</PrivacyBlur></span></div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 px-2">Lançamentos na Fatura</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {invoiceTxs.length === 0 ? <div className="p-8 text-center text-slate-500"><ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhuma compra nesta fatura.</p></div> : 
                            invoiceTxs.map(t => {
                                const CatIcon = getCategoryIcon(t.category);
                                return (
                                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.isRefund ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {t.isRefund ? <ArrowDownLeft className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                            </div>
                                            <div><p className="text-sm font-bold text-slate-800">{t.description}</p><div className="flex gap-2 text-xs text-slate-600"><span>{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>{t.currentInstallment && <span>• {t.currentInstallment}/{t.totalInstallments}</span>}</div></div>
                                        </div>
                                        <span className={`font-bold ${t.isRefund ? 'text-amber-700' : 'text-slate-800'}`}>{t.isRefund ? '-' : ''}{formatCurrency(t.amount, account.currency)}</span>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};