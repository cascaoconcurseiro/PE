import React, { useState } from 'react';
import { Trip, Transaction, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ArrowLeft, Download, Printer, Pencil, Trash2, Plane, Users, Calendar, Wallet } from 'lucide-react';
import { formatCurrency, parseDate } from '../../utils';
import { exportToCSV, prepareTripExpensesForExport, printComponent } from '../../services/exportUtils';

import { TripOverview } from './tabs/TripOverview';
import { TripItinerary } from './tabs/TripItinerary';
import { TripChecklist } from './tabs/TripChecklist';
import { TripStats } from './tabs/TripStats';
import { TripShopping } from './tabs/TripShopping';
import { TripExchange } from './tabs/TripExchange';

interface TripDetailProps {
    trip: Trip;
    transactions: Transaction[];
    onBack: () => void;
    onEdit: (trip: Trip) => void;
    onDelete: (id: string) => void;
    onUpdateTrip: (trip: Trip) => void;
    onNavigateToShared?: () => void;
    onEditTransaction?: (id: string) => void;
}

export const TripDetail: React.FC<TripDetailProps> = ({ trip, transactions, onBack, onEdit, onDelete, onUpdateTrip, onNavigateToShared, onEditTransaction }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ITINERARY' | 'CHECKLIST' | 'STATS' | 'SHOPPING' | 'EXCHANGE'>('OVERVIEW');

    const totalSpent = transactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE ? t.amount : 0), 0);

    const handleExport = () => {
        const data = prepareTripExpensesForExport(transactions);
        exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Pago Por', 'Valor'], `Viagem_${trip.name}`);
    };

    const tabs = [
        { id: 'OVERVIEW', label: 'Gastos' },
        { id: 'ITINERARY', label: 'Roteiro' },
        { id: 'CHECKLIST', label: 'Checklist' },
        { id: 'STATS', label: 'Relatórios' },
        { id: 'SHOPPING', label: 'Compras' },
        { id: 'EXCHANGE', label: 'Câmbio' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-24">
            {/* Header Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-2">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Voltar
                </Button>

                <div className="flex gap-2">
                    <button onClick={handleExport} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 rounded-xl transition-colors hidden sm:block" title="Baixar CSV">
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={printComponent} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 rounded-xl transition-colors hidden sm:block" title="Imprimir">
                        <Printer className="w-5 h-5" />
                    </button>
                    <button onClick={() => onEdit(trip)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 rounded-xl transition-colors" title="Editar Viagem">
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => { if (confirm('Tem certeza que deseja excluir esta viagem?')) { onDelete(trip.id); } }} className="p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-colors" title="Excluir Viagem">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Premium Header Card */}
            <Card className="bg-gradient-to-br from-violet-700 to-indigo-900 text-white border-none shadow-xl relative overflow-hidden print:bg-white print:text-black print:border-black print:border p-8 rounded-[2rem]">
                <div className="absolute top-0 right-0 p-8 opacity-10 no-print">
                    <Plane className="w-48 h-48 text-white transform translate-x-10 -translate-y-10" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-violet-200">
                            <span className="text-xs font-bold uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">{trip.currency}</span>
                            <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> {parseDate(trip.startDate).getFullYear()}</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight text-white mb-2 leading-none max-w-2xl">{trip.name}</h2>
                        <div className="flex items-center space-x-4 text-violet-100 text-sm print:text-black mb-6">
                            <span>{parseDate(trip.startDate).toLocaleDateString('pt-BR')} - {parseDate(trip.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <div className="flex items-center -space-x-2">
                            {trip.participants.slice(0, 5).map((p, i) => (
                                <div key={p.id} className="w-8 h-8 rounded-full border-2 border-indigo-900 bg-violet-200 text-violet-800 flex items-center justify-center text-xs font-bold">
                                    {p.name[0]}
                                </div>
                            ))}
                            {trip.participants.length > 5 && (
                                <div className="w-8 h-8 rounded-full border-2 border-indigo-900 bg-slate-700 text-white flex items-center justify-center text-xs font-bold">
                                    +{trip.participants.length - 5}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1 text-violet-200">
                            <Wallet className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Total Gasto</span>
                        </div>
                        <p className="text-3xl font-bold tracking-tight text-white">{formatCurrency(totalSpent, trip.currency)}</p>
                    </div>
                </div>
            </Card>

            {/* Premium Tab Navigation */}
            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-x-auto scrollbar-hide no-print gap-1 shadow-inner">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex-1 min-w-[90px] py-2.5 px-3 text-sm font-bold rounded-xl transition-all whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                {activeTab === 'OVERVIEW' && <TripOverview trip={trip} transactions={transactions} onUpdateTrip={onUpdateTrip} onNavigateToShared={onNavigateToShared} onEditTransaction={onEditTransaction} />}
                {activeTab === 'ITINERARY' && <TripItinerary trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'CHECKLIST' && <TripChecklist trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'STATS' && <TripStats trip={trip} transactions={transactions} />}
                {activeTab === 'SHOPPING' && <TripShopping trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'EXCHANGE' && <TripExchange trip={trip} onUpdateTrip={onUpdateTrip} />}
            </div>
        </div>
    );
};
