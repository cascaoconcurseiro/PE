import React, { useState } from 'react';
import { Transaction, TransactionType, Account, FamilyMember, AccountType } from '../../types';
import { formatCurrency, getCategoryIcon, parseDate } from '../../utils';
import { RefreshCcw, ScanLine, Plus, Users, Trash2, ArrowRight, CreditCard, Wallet, ArrowDownLeft, Clock, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

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
    hasActiveFilters?: boolean;
    onClearFilters?: () => void;
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
    onAnticipateInstallments,
    hasActiveFilters,
    onClearFilters
}) => {
    const dates = Object.keys(groupedTxs).sort((a, b) => b.localeCompare(a));
    const [visibleDays, setVisibleDays] = useState(5);
    const visibleDates = dates.slice(0, visibleDays);
    const hasMore = visibleDays < dates.length;
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; txId: string | null }>({ isOpen: false, txId: null });

    if (dates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                <div className="w-24 h-24 bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <ScanLine className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sem movimento</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-center">
                    {hasActiveFilters
                        ? "Nenhum resultado encontrado com os filtros atuais."
                        : (emptyMessage || "Nenhuma transação encontrada neste período.")}
                </p>
                {hasActiveFilters && onClearFilters ? (
                    <Button onClick={onClearFilters} variant="secondary" className="rounded-xl px-8 h-12 text-sm font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white">
                        <ScanLine className="w-4 h-4 mr-2" /> Limpar Filtros
                    </Button>
                ) : (
                    <Button onClick={onAddClick} className="rounded-xl px-8 h-12 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20">
                        <Plus className="w-4 h-4 mr-2" /> Adicionar Transação
                    </Button>
                )}
            </div>
        );
    }

    // Helper to get account name safely
    const getAccountName = (id?: string) => {
        if (!id) return 'Desconhecido';
        const acc = accounts.find(a => a.id === id);
        return acc ? acc.name : 'Conta Excluída';
    };

    return (
        <div className="relative space-y-8">
            {/* Vertical Timeline Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

            {visibleDates.map((dateStr) => (
                <div key={dateStr} className="relative">
                    {/* Date Header: "dez 11" style */}
                    <div className="sticky top-0 z-10 flex items-center gap-4 mb-4 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2">
                        {/* Box with "dez 11" */}
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shadow-sm shrink-0 z-20">
                            <span className="text-[10px] lowercase font-black text-slate-400 leading-none mb-0.5">
                                {parseDate(dateStr).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                            </span>
                            <span className="text-lg font-black text-slate-800 dark:text-white leading-none">
                                {parseDate(dateStr).getDate()}
                            </span>
                        </div>

                        {/* Weekday & Count */}
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-white lowercase first-letter:capitalize">
                                {parseDate(dateStr).toLocaleDateString('pt-BR', { weekday: 'long' })}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {groupedTxs[dateStr].length} ite{groupedTxs[dateStr].length !== 1 ? 'ns' : 'm'}
                            </span>
                        </div>
                    </div>

                    {/* Transactions List */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50 md:ml-14">
                        {groupedTxs[dateStr].map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
                            const isTransfer = t.type === TransactionType.TRANSFER;

                            // Account Logic
                            const account = accounts.find(a => a.id === t.accountId);
                            const accountName = account?.name || 'Conta';
                            const isCreditCard = account?.type === AccountType.CREDIT_CARD;

                            // Transfer Logic: "Para: Nubank"
                            let transferDestName = '';
                            if (isTransfer && t.destinationAccountId) {
                                transferDestName = getAccountName(t.destinationAccountId);
                            }

                            const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0);
                            const isInstallment = !!t.isInstallment && !!t.currentInstallment;
                            const isSettled = t.isSettled;

                            // Amount & Payer display
                            let displayAmount = t.amount;
                            let subText = '';
                            let payerName = 'Você';

                            if (t.payerId && t.payerId !== 'me') {
                                payerName = familyMembers.find(m => m.id === t.payerId)?.name || 'Outro';
                            }

                            if (t.type === TransactionType.EXPENSE && isShared) {
                                const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                                if (payerName === 'Você') {
                                    // Payer sees FULL amount (Cash Flow view)
                                    displayAmount = t.amount;
                                    if (splitsTotal > 0) subText = `(Você recebe ${formatCurrency(splitsTotal, t.currency || 'BRL')})`;
                                } else {
                                    // Non-payer sees only THEIR share (Expense view)
                                    displayAmount = t.amount - splitsTotal;
                                    subText = `Pago por ${payerName}`;
                                }
                            }

                            // BADGES
                            let typeBadge = null;
                            if (isPositive) {
                                typeBadge = <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">CRÉDITO</span>;
                            } else if (isTransfer) {
                                typeBadge = <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-500/20">TRANSF.</span>;
                            } else {
                                typeBadge = <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-500/20">DÉBITO</span>;
                            }

                            return (
                                <div
                                    key={t.id}
                                    className={`relative p-4 flex justify-between items-start transition-all group ${t.sourceTransactionId ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                                    onClick={() => {
                                        if (t.sourceTransactionId) {
                                            // Transação espelhada - não permite edição
                                            return;
                                        }
                                        onEdit(t);
                                    }}
                                >
                                    {/* Left: Icon + Text Block */}
                                    <div className="flex gap-4 flex-1 min-w-0">
                                        {/* Icon Box */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${isPositive
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                            : isTransfer
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                            }`}>
                                            {isTransfer ? <RefreshCcw className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>

                                        {/* Text Info */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            {/* Line 1: Description */}
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                                                {t.description}
                                            </h4>

                                            {/* Line 2: Category • Account OR "Para: Dest" */}
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                <span>{t.category}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />

                                                {/* Account logic */}
                                                <span className="flex items-center gap-1">
                                                    {isCreditCard ? <CreditCard className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                                    <span className="truncate max-w-[120px]">
                                                        {isTransfer ?
                                                            <>
                                                                <span className="opacity-75">{accountName}</span>
                                                                <ArrowRight className="w-3 h-3 inline mx-0.5" />
                                                                <span className="text-slate-800 dark:text-slate-200 font-bold">{transferDestName}</span>
                                                            </>
                                                            : accountName
                                                        }
                                                    </span>
                                                </span>
                                            </div>

                                            {/* Line 3: Badges row */}
                                            <div className="flex items-center gap-2 pt-0.5">
                                                {typeBadge}

                                                {t.sourceTransactionId && (
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                                                        <Lock className="w-3 h-3" />
                                                        Somente Leitura
                                                    </span>
                                                )}

                                                {isInstallment && (
                                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-500/20 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {t.currentInstallment}/{t.totalInstallments}
                                                    </span>
                                                )}

                                                {isShared && (
                                                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {subText || 'Compartilhado'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Amount & Actions */}
                                    <div className="flex flex-col items-end pl-2 gap-1">
                                        <span className={`font-black text-sm sm:text-base ${isPositive ? 'text-emerald-600 dark:text-emerald-400'
                                            : isTransfer ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {isPositive ? '+ ' : ''}
                                            <BlurValue value={formatCurrency(displayAmount, t.currency || 'BRL')} show={showValues} />
                                        </span>

                                        {isInstallment && t.originalAmount && (
                                            <span className="text-[10px] text-slate-400">
                                                Total: {formatCurrency(t.originalAmount, t.currency || 'BRL')}
                                            </span>
                                        )}

                                        {/* Hover Actions (Desktop) */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                                            {t.sourceTransactionId ? (
                                                /* Locked for Mirrors */
                                                <div className="p-1.5 text-slate-400" title="Gerido pelo criador (Apenas Leitura)">
                                                    <Lock className="w-3.5 h-3.5" />
                                                </div>
                                            ) : (
                                                /* Action Buttons for Owners */
                                                <>
                                                    {isInstallment && (t.currentInstallment || 0) < (t.totalInstallments || 0) && onAnticipateInstallments && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onAnticipateInstallments(t); }}
                                                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                            title="Antecipar"
                                                        >
                                                            <Clock className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, txId: t.id }); }}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
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

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, txId: null })}
                onConfirm={() => {
                    if (deleteConfirm.txId) onDelete(deleteConfirm.txId);
                    setDeleteConfirm({ isOpen: false, txId: null });
                }}
                title="Excluir Transação"
                message="Tem certeza que deseja excluir esta transação?"
                confirmLabel="Excluir"
                isDanger
            />
        </div>
    );
};