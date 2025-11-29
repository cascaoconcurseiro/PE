import React from 'react';
import { Transaction, TransactionType, Account } from '../../types';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { RefreshCcw, ScanLine, Plus, Plane, Users, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

interface TransactionListProps {
    groupedTxs: Record<string, Transaction[]>;
    accounts: Account[];
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
                            const accountName = accounts.find(a => a.id === t.accountId)?.name || 'Conta';
                            
                            // Logic for Shared/Trip Display
                            const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0);
                            const isTrip = !!t.tripId;
                            
                            // Amount Calculation Logic (User Request: Show My Share)
                            let displayAmount = t.amount;
                            let subText = '';
                            let amountLabel = '';

                            if (t.type === TransactionType.EXPENSE && isShared) {
                                const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                                
                                if (!t.payerId || t.payerId === 'me') {
                                    // I paid full amount
                                    displayAmount = t.amount - splitsTotal;
                                    if (splitsTotal > 0) {
                                        subText = `Pago: ${formatCurrency(t.amount)}`;
                                        amountLabel = ' (Minha Parte)';
                                    }
                                } else {
                                    // Someone else paid
                                    // Assuming my share is the remainder (Total - Splits to others)
                                    // If I was explicitly split, logic might vary, but simplified here:
                                    displayAmount = t.amount - splitsTotal;
                                    subText = 'Pago por outro';
                                    amountLabel = ' (Dívida)';
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
                                                {/* Icons */}
                                                {isTrip && <Plane className="w-3 h-3 text-violet-500 fill-violet-100" />}
                                                {isShared && <Users className="w-3 h-3 text-indigo-500 fill-indigo-100" />}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 mt-0.5">
                                                <span className="truncate max-w-[100px]">{t.category}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="truncate max-w-[100px] text-slate-400">{accountName}</span>
                                                {t.currentInstallment && <span className="bg-purple-100 text-purple-700 px-1.5 rounded text-[9px] font-bold">{t.currentInstallment}/{t.totalInstallments}</span>}
                                                {t.isRecurring && <span className="bg-blue-100 text-blue-700 px-1.5 rounded text-[9px] font-bold">Recorrente</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Amount & Actions */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-right cursor-pointer" onClick={() => onEdit(t)}>
                                            <span className={`block font-bold text-sm ${isPositive ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                {isPositive ? '+' : ''} <BlurValue value={formatCurrency(displayAmount)} show={showValues} />
                                            </span>
                                            {subText ? (
                                                <div className="text-[9px] font-medium text-slate-400">
                                                    {subText}
                                                    {t.isSettled && <span className="ml-1 text-emerald-600 uppercase font-bold">Pago</span>}
                                                </div>
                                            ) : (
                                                t.isSettled && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pago</span>
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