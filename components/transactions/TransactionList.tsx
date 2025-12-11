import React, { useState } from 'react';
import { Transaction, TransactionType, Account, FamilyMember, AccountType } from '../../types';
import { formatCurrency, getCategoryIcon, parseDate } from '../../utils';
import { RefreshCcw, ScanLine, Plus, Plane, Users, Trash2, ArrowRight, User, CreditCard, Wallet, ArrowDownLeft, ArrowUpRight, Clock, CalendarDays } from 'lucide-react';
import { Button } from '../ui/Button';

interface TransactionListProps {
    groupedTxs: Record<string, Transaction[]>;
    accounts: Account[];
    familyMembers: FamilyMember[];
    showValues: boolean;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onAddClick: () => void;
    emptyMessage?: string;
    onAnticipateInstallments?: (tx: Transaction) => void;
}

const BlurValue = ({ value, show }: { value: string, show: boolean }) => {
    if (show) return <>{value}</>;
    return <span className="blur-sm select-none opacity-60">R$ ••••</span>;
};

export const TransactionList: React.FC<TransactionListProps> = ({
    groupedTxs,
    accounts,
    familyMembers,
    showValues,
    onEdit,
    onDelete,
    onAddClick,
    emptyMessage,
    onAnticipateInstallments
}) => {
    const dates = Object.keys(groupedTxs).sort((a, b) => b.localeCompare(a));
    const [visibleDays, setVisibleDays] = useState(5);
    const visibleDates = dates.slice(0, visibleDays);
    const hasMore = visibleDays < dates.length;

    if (dates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                <div className="w-24 h-24 bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <ScanLine className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sem movimento</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-center">{emptyMessage || "Nenhuma transação encontrada neste período."}</p>
                <Button onClick={onAddClick} className="rounded-xl px-8 h-12 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Transação
                </Button>
            </div>
        );
    }

    return (
        <div className="relative space-y-8">
            {/* Vertical Timeline Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>



            {visibleDates.map((dateStr) => (
                <div key={dateStr} className="relative">
                    {/* Date Header */}
                    <div className="sticky top-0 z-10 flex items-center gap-4 mb-4 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shadow-sm shrink-0 z-20">
                            <span className="text-[10px] uppercase font-black text-slate-400 leading-none">{parseDate(dateStr).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                            <span className="text-lg font-black text-slate-800 dark:text-white leading-none">{parseDate(dateStr).getDate()}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                {parseDate(dateStr).toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {groupedTxs[dateStr].length} ite{groupedTxs[dateStr].length !== 1 ? 'ns' : 'm'}
                            </span>
                        </div>
                    </div>

                    {/* Transactions Card Group */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50 md:ml-14">
                        {groupedTxs[dateStr].map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
                            const account = accounts.find(a => a.id === t.accountId);
                            const accountName = account?.name || 'Conta';
                            const isCreditCard = account?.type === AccountType.CREDIT_CARD;

                            const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0);
                            const isTrip = !!t.tripId;
                            const isInstallment = !!t.isInstallment && !!t.currentInstallment;
                            const isSettled = t.isSettled;

                            // Amount & Payer Logic
                            let displayAmount = t.amount;
                            let subText = '';
                            let payerName = 'Você';

                            if (t.payerId && t.payerId !== 'me') {
                                payerName = familyMembers.find(m => m.id === t.payerId)?.name || 'Outro';
                            }

                            if (t.type === TransactionType.EXPENSE && isShared) {
                                const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                                if (payerName === 'Você') {
                                    displayAmount = t.amount - splitsTotal;
                                    if (splitsTotal > 0) subText = `Você pagou o total (${formatCurrency(t.amount, t.currency || 'BRL')})`;
                                } else {
                                    displayAmount = t.amount - splitsTotal;
                                    subText = `Pago por ${payerName}`;
                                }
                            }

                            // Determine Styles
                            let rowBg = 'bg-white dark:bg-slate-800 border-l-4 border-transparent';
                            let textMain = 'text-slate-900 dark:text-white';
                            let badge = null;

                            if (isPositive) {
                                // INCOME (Green)
                                rowBg = 'bg-emerald-50/60 dark:bg-emerald-900/10 border-l-4 border-emerald-500';
                                textMain = 'text-emerald-900 dark:text-emerald-50';
                                badge = (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                                        RECEITA
                                    </span>
                                );
                            } else if (t.type === TransactionType.EXPENSE) {
                                // EXPENSE (Red)
                                rowBg = 'bg-red-50/60 dark:bg-red-900/10 border-l-4 border-red-500';
                                textMain = 'text-red-900 dark:text-red-50';
                                badge = (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] font-black uppercase tracking-wider">
                                        DESPESA
                                    </span>
                                );
                            } else {
                                // TRANSFER (Blue/Neutral)
                                rowBg = 'bg-blue-50/30 dark:bg-blue-900/5 border-l-4 border-blue-400';
                                badge = (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase tracking-wider">
                                        TRANSF.
                                    </span>
                                );
                            }

                            if (isSettled) {
                                rowBg += ' opacity-60 grayscale';
                            }

                            return (
                                <div
                                    key={t.id}
                                    className={`relative p-4 sm:p-5 flex justify-between items-center transition-all group ${rowBg}`}
                                >
                                    {/* Left Side: Icon & Info */}
                                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => onEdit(t)}>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-white/80 dark:bg-black/20 ${isPositive
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : t.type === TransactionType.EXPENSE ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                                            }`}>
                                            {t.type === TransactionType.TRANSFER ? <RefreshCcw className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>

                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center flex-wrap gap-y-1 mb-1">
                                                <h4 className={`text-sm font-bold truncate mr-2 ${textMain}`}>
                                                    {t.description}
                                                </h4>
                                                {badge}
                                                {/* Mini Badges */}
                                                {isTrip && <span className="ml-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 p-0.5 rounded-[4px]"><Plane className="w-3 h-3" /></span>}
                                                {isShared && <span className="ml-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 p-0.5 rounded-[4px]"><Users className="w-3 h-3" /></span>}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                <span className="truncate max-w-[120px]">{t.category}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 hidden sm:block"></span>
                                                <span className="flex items-center gap-1 truncate max-w-[140px] text-slate-400">
                                                    {isCreditCard ? <CreditCard className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                                    {accountName}
                                                </span>
                                                {isInstallment && (
                                                    <span className="ml-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                        {t.currentInstallment}/{t.totalInstallments}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Amount & Actions */}
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-right cursor-pointer" onClick={() => onEdit(t)}>
                                            <span className={`block font-black text-sm sm:text-base ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : t.type === TransactionType.EXPENSE ? 'text-red-700 dark:text-red-400 ml-1' : 'text-blue-700 dark:text-blue-400'}`}>
                                                {isPositive ? '+' : ''} <BlurValue value={formatCurrency(displayAmount, t.currency || 'BRL')} show={showValues} />
                                            </span>
                                        </div>

                                        {/* Subtext Logic */}
                                        {isInstallment && t.originalAmount && !subText && (
                                            <div className="text-[10px] font-medium text-slate-400">
                                                Total: {formatCurrency(t.originalAmount, t.currency || 'BRL')}
                                            </div>
                                        )}

                                        {subText ? (
                                            <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-slate-400">
                                                {payerName !== 'Você' ? (
                                                    <>
                                                        <ArrowDownLeft className="w-3 h-3 text-red-400" />
                                                        <span>{subText}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        ) : (
                                            t.isSettled && <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-wider">PAGO</span>
                                        )}

                                        {/* Hover Actions (Desktop) or Persistent (Mobile potentially) */}
                                        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-2 sm:static sm:opacity-100 sm:mt-0">
                                            {isInstallment && (t.currentInstallment || 0) < (t.totalInstallments || 0) && onAnticipateInstallments && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onAnticipateInstallments(t); }}
                                                    className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                    title="Antecipar"
                                                >
                                                    <Clock className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (confirm('Excluir transação?')) onDelete(t.id); }}
                                                className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {hasMore && (
                <div className="flex justify-center pt-4 pb-8">
                    <Button
                        variant="secondary"
                        onClick={() => setVisibleDays(prev => prev + 5)}
                        className="rounded-full px-8 py-6 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-105"
                    >
                        <ArrowDownLeft className="w-5 h-5 mr-2" />
                        Carregar Mais Dias
                    </Button>
                </div>
            )}
        </div>
    );
};