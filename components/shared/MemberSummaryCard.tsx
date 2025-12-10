import React from 'react';
import { FamilyMember, Trip, InvoiceItem } from '../../types';
import { Button } from '../ui/Button';
import { ArrowRight, Plane, Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils';

interface MemberSummaryCardProps {
    member: FamilyMember;
    items: InvoiceItem[];
    totalsMap: Record<string, { credits: number; debits: number; net: number }>;
    trips: Trip[];
    onOpenSettleModal: (memberId: string, type: 'PAY' | 'RECEIVE' | 'OFFSET', currency: string) => void;
}

export const MemberSummaryCard: React.FC<MemberSummaryCardProps> = ({ member, items, totalsMap, trips, onOpenSettleModal }) => {
    const currencies = Object.keys(totalsMap).filter(c => Math.abs(totalsMap[c].net) > 0.01);

    if (currencies.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header Style like Credit Card */}
            <div className="relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shadow-sm">
                                    {member.name[0]}
                                </div>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {member.name}
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

            {/* Transactions List */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-6 mt-2">
                    Histórico
                </h3>
                <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50 max-h-80 overflow-y-auto custom-scrollbar">
                    {items.map(item => {
                        const trip = item.tripId ? trips.find(t => t.id === item.tripId) : null;
                        const isPaid = item.isPaid;
                        const bgColor = isPaid ? 'bg-slate-50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800';

                        return (
                            <div key={item.id} className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isPaid ? 'opacity-60 grayscale' : ''} ${bgColor}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPaid
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        : item.type === 'CREDIT'
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                        }`}>
                                        {isPaid ? <div className="text-[10px] font-black">OK</div> : (item.type === 'CREDIT' ? <ArrowRight className="w-5 h-5" /> : <ArrowRight className="w-5 h-5 rotate-180" />)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate pr-4">
                                            {item.description}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                                                <Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                            </span>
                                            {trip && (
                                                <span className="text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                                    <Plane className="w-3 h-3" /> {trip.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`block font-bold text-sm ${isPaid ? 'text-slate-400' : item.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatCurrency(item.amount, item.currency || 'BRL')}
                                    </span>
                                    {isPaid && <span className="text-[10px] font-bold text-slate-400 uppercase">Pago</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
