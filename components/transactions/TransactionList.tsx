import React from 'react';
import { Transaction, TransactionType, Account, FamilyMember, AccountType } from '../../types';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { RefreshCcw, ScanLine, Plus, Plane, Users, Trash2, ArrowRight, User, CreditCard, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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
    emptyMessage 
}) => {
    const dates = Object.keys(groupedTxs).sort((a, b) => b.localeCompare(a));

    if (dates.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <ScanLine className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Sem movimento</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1 mb-6">{emptyMessage || "Nenhuma transação encontrada neste período."}</p>
                <Button onClick={onAddClick} className="bg-slate-900 text-white shadow-xl shadow-slate-200">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Agora
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {dates.map((dateStr) => (
                <div key={dateStr}>
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="bg-slate-200 text-slate-600 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider">
                            {new Date(dateStr).getDate()}
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">
                            {new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'long', month: 'long' })}
                        </span>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                        {groupedTxs[dateStr].map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
                            const account = accounts.find(a => a.id === t.accountId);
                            const accountName = account?.name || 'Conta';
                            const isCreditCard = account?.type === AccountType.CREDIT_CARD;
                            
                            // Logic for Shared/Trip Display
                            const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0);
                            const isTrip = !!t.tripId;
                            const isInstallment = !!t.isInstallment && !!t.currentInstallment;
                            
                            // Amount Calculation Logic & Payer Info
                            let displayAmount = t.amount;
                            let subText = '';
                            let payerName = 'Você';
                            
                            // Determine Payer Name
                            if (t.payerId && t.payerId !== 'me') {
                                payerName = familyMembers.find(m => m.id === t.payerId)?.name || 'Outro';
                            }

                            if (t.type === TransactionType.EXPENSE && isShared) {
                                const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                                
                                if (payerName === 'Você') {
                                    // I paid full amount
                                    displayAmount = t.amount - splitsTotal; // Show net cost (my share)
                                    if (splitsTotal > 0) {
                                        subText = `Você pagou o total (${formatCurrency(t.amount)})`;
                                    }
                                } else {
                                    // Someone else paid
                                    displayAmount = t.amount - splitsTotal;
                                    subText = `Pago por ${payerName}`;
                                }
                            }

                            return (
                                <div 
                                    key={t.id} 
                                    className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group relative"
                                >
                                    {/* Clickable Area for Edit */}
                                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => onEdit(t)}>
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-600'} group-hover:scale-110 duration-200`}>
                                            {t.type === TransactionType.TRANSFER ? <RefreshCcw className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>
                                        <div className="overflow-hidden pr-2">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900 truncate">{t.description}</p>
                                                {/* Icons Badges */}
                                                {isTrip && <span className="bg-violet-100 text-violet-700 p-0.5 rounded"><Plane className="w-3 h-3" /></span>}
                                                {isShared && <span className="bg-indigo-100 text-indigo-700 p-0.5 rounded"><Users className="w-3 h-3" /></span>}
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 mt-0.5">
                                                <span className="truncate max-w-[100px]">{t.category}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="flex items-center gap-1 truncate max-w-[120px] text-slate-400">
                                                    {isCreditCard ? <CreditCard className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                                    {accountName}
                                                </span>
                                                {isInstallment && (
                                                    <span className="bg-purple-100 text-purple-700 px-1.5 rounded text-[9px] font-bold">
                                                        {t.currentInstallment}/{t.totalInstallments}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Amount & Actions */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-right cursor-pointer" onClick={() => onEdit(t)}>
                                            <span className={`block font-bold text-sm ${isPositive ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                {isPositive ? '+' : ''} <BlurValue value={formatCurrency(displayAmount)} show={showValues} />
                                            </span>
                                            
                                            {/* Subtext Logic */}
                                            {isInstallment && t.originalAmount && !subText && (
                                                <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                                                    Total: {formatCurrency(t.originalAmount)}
                                                </div>
                                            )}

                                            {subText ? (
                                                <div className="flex items-center justify-end gap-1 text-[9px] font-medium text-slate-400 mt-0.5">
                                                    {payerName !== 'Você' ? (
                                                        <>
                                                            <ArrowDownLeft className="w-3 h-3 text-red-400" />
                                                            <span>{subText}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                                            <span>Receber diferença</span>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                t.isSettled && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Pago</span>
                                            )}
                                        </div>

                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('Tem certeza que deseja excluir esta transação?')) onDelete(t.id); }}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};