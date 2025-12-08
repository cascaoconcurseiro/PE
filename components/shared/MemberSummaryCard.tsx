import React, { useState } from 'react';
import { FamilyMember, Trip, InvoiceItem } from '../../types';
import { Button } from '../ui/Button';
import { ArrowRight, Plane, Calendar, Trash2, Pencil } from 'lucide-react';
import { formatCurrency, parseDate } from '../../utils';

interface MemberSummaryCardProps {
    member: FamilyMember;
    items: InvoiceItem[];
    totalsMap: Record<string, { credits: number; debits: number; net: number }>;
    trips: Trip[];
    onOpenSettleModal: (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => void;
    onDeleteTransaction?: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onEditTransaction?: (txId: string) => void;
}

export const MemberSummaryCard: React.FC<MemberSummaryCardProps> = ({ member, items, totalsMap, trips, onOpenSettleModal, onDeleteTransaction, onEditTransaction }) => {
    const currencies = Object.keys(totalsMap).filter(c => Math.abs(totalsMap[c].net) > 0.01);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    if (currencies.length === 0) return null;

    const handleDelete = (id: string, hasSeriesId: boolean) => {
        if (deleteConfirmId === id) {
            if (onDeleteTransaction) {
                onDeleteTransaction(id, hasSeriesId ? 'SERIES' : 'SINGLE');
            }
            setDeleteConfirmId(null);
        } else {
            setDeleteConfirmId(id);
            setTimeout(() => setDeleteConfirmId(null), 3000);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-lg">{member.name[0]}</div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{member.name}</h3>
                </div>

                {currencies.map(curr => {
                    const { net } = totalsMap[curr];
                    return (
                        <div key={curr} className="flex justify-between items-center mb-2 last:mb-0 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                            <span className="text-xs font-bold text-slate-500">{curr}</span>
                            <div className="text-right">
                                <p className={`text-lg font-black ${net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(Math.abs(net), curr)}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-400">{net > 0 ? 'A Receber' : 'A Pagar'}</p>
                            </div>
                            <Button
                                onClick={() => onOpenSettleModal(member.id, net > 0 ? 'RECEIVE' : 'PAY', curr)}
                                size="sm"
                                className={`ml-3 ${net > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'} border-none shadow-none`}
                            >
                                {net > 0 ? 'Receber' : 'Pagar'}
                            </Button>
                        </div>
                    );
                })}
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-900/30 divide-y divide-slate-100 dark:divide-slate-700 max-h-60 overflow-y-auto">
                {items.filter(i => !i.isPaid).map(item => {
                    const trip = item.tripId ? trips.find(t => t.id === item.tripId) : null;
                    const isConfirming = deleteConfirmId === item.originalTxId;
                    const hasSeriesId = !!item.seriesId;
                    return (
                        <div key={item.id} className="px-6 py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg shrink-0 ${item.type === 'CREDIT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                                    {item.type === 'CREDIT' ? <ArrowRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 transform rotate-180" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.description}</p>
                                    <div className="flex flex-wrap gap-2 mt-0.5">
                                        {trip && <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Plane className="w-3 h-3" /> {trip.name}</span>}
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {parseDate(item.date).toLocaleDateString()}</span>
                                        {hasSeriesId && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">Parcelado</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className={`font-bold text-sm mr-2 ${item.type === 'CREDIT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                    {formatCurrency(item.amount, item.currency || 'BRL')}
                                </span>
                                {onEditTransaction && hasSeriesId && (
                                    <button
                                        onClick={() => onEditTransaction(item.originalTxId)}
                                        className="p-1.5 rounded-lg transition-all text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                        title="Editar Parcelas"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                                {onDeleteTransaction && (
                                    <button
                                        onClick={() => handleDelete(item.originalTxId, hasSeriesId)}
                                        className={`p-1.5 rounded-lg transition-all ${isConfirming ? 'bg-red-500 text-white' : 'text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                        title={isConfirming ? 'Confirmar Exclusão' : 'Excluir'}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
