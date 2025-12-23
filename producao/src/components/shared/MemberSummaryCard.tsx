import React from 'react';
import { FamilyMember, Trip, InvoiceItem } from '../../types';
import { Button } from '../ui/Button';
import { Plane, Calendar, Edit2, Trash2, ArrowDownLeft, ShoppingBag } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';

interface MemberSummaryCardProps {
    member: FamilyMember;
    items: InvoiceItem[];
    totalsMap: Record<string, { credits: number; debits: number; net: number }>;
    trips: Trip[];
    onOpenSettleModal: (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => void;
    onEditClick?: (transactionId: string) => void;
    onDeleteClick?: (transactionId: string) => void;
}

export const MemberSummaryCard: React.FC<MemberSummaryCardProps> = ({ member, items, totalsMap, trips, onOpenSettleModal, onEditClick, onDeleteClick }) => {
    const currencies = Object.keys(totalsMap).filter(c => Math.abs(totalsMap[c].net) > 0.01);

    if (currencies.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header Style like Credit Card Invoice */}
            <div className="relative">
                {/* Gradient for "Shared" look - distinct from credit card but premium */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shadow-sm">
                                    {member.name[0]}
                                </div>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Resumo: {member.name}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {currencies.map(curr => {
                                    const { net } = totalsMap[curr];
                                    return (
                                        <div key={curr} className="flex flex-col sm:flex-row sm:items-center gap-4 border-b last:border-0 border-slate-100 dark:border-slate-700/50 pb-4 last:pb-0">
                                            <div>
                                                <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {formatCurrency(Math.abs(net), curr)}
                                                </h2>
                                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase">
                                                    {net > 0 ? 'Você Recebe' : 'Você Deve'}
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => onOpenSettleModal(member.id, net > 0 ? 'RECEIVE' : 'PAY', curr)}
                                                className={`w-full sm:w-auto rounded-xl font-bold shadow-lg min-w-[140px] px-6 py-3 h-auto ${net > 0
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                                    }`}
                                            >
                                                {net > 0 ? 'Receber' : 'Pagar'}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions List - Invoice Style */}
            <div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 px-6 mt-4">
                    Lançamentos
                </h3>

                <div className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhum lançamento pendente.</p>
                        </div>
                    ) : (
                        items.map(item => {
                            const trip = item.tripId ? trips.find(t => t.id === item.tripId) : null;
                            const isPaid = item.isPaid;
                            const CatIcon = getCategoryIcon(item.category); // Assuming utils handles string input gracefully or falls back

                            // Check specifically for installment info inside description or item properties if available
                            // Note: InvoiceItem simplified interface might not have full installment details, 
                            // but usually these come from Transaction which has them.
                            // If seriesId is present, we treat it as part of a series.

                            return (
                                <div
                                    key={item.id}
                                    className={`group p-4 px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isPaid ? 'opacity-60 grayscale' : ''}`}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Icon */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPaid
                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                                : item.type === 'CREDIT'
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                                                    : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                            }`}>
                                            {item.type === 'CREDIT' ? <ArrowDownLeft className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate pr-4">
                                                {item.description}
                                            </p>
                                            <div className="flex flex-wrap gap-2 text-xs items-center mt-1">
                                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </span>

                                                {trip && (
                                                    <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                                        <Plane className="w-3 h-3" /> {trip.name}
                                                    </span>
                                                )}

                                                {/* If we had installment count, we would show it here. 
                                                    For now, relies on description or if we passed it in items. 
                                                */}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Amount & Actions */}
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            <span className={`block font-bold text-sm ${isPaid ? 'text-slate-400' : item.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                {item.type === 'CREDIT' ? '+' : ''}
                                                {formatCurrency(item.amount, item.currency || 'BRL')}
                                            </span>
                                            {isPaid && <span className="text-[10px] font-bold text-slate-400 uppercase">Pago</span>}
                                        </div>

                                        {!isPaid && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => { e.stopPropagation(); onEditClick?.(item.originalTxId); }}
                                                    className="h-8 w-8 p-0 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 hover:border-indigo-200"
                                                    title="Editar / Antecipar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteClick?.(item.originalTxId); }}
                                                    className="h-8 w-8 p-0 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 hover:border-red-200"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
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
