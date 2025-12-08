import React, { useState } from 'react';
import { Trip, Transaction, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ArrowLeft, Download, Printer, Pencil, Trash2, Plane, Users, Calendar } from 'lucide-react';
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
}

export const TripDetail: React.FC<TripDetailProps> = ({ trip, transactions, onBack, onEdit, onDelete, onUpdateTrip, onNavigateToShared }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ITINERARY' | 'CHECKLIST' | 'STATS' | 'SHOPPING' | 'EXCHANGE'>('OVERVIEW');

    const totalSpent = transactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE ? t.amount : 0), 0);

    const handleExport = () => {
        const data = prepareTripExpensesForExport(transactions);
        exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Pago Por', 'Valor'], `Viagem_${trip.name}`);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-24">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="text-slate-700 hover:text-slate-900 px-0">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Voltar
                </Button>
                <h2 className="text-xl font-bold text-violet-900 truncate max-w-[150px]">{trip.name}</h2>
                <div className="flex gap-2">
                    {/* EXPORT BUTTONS */}
                    <button onClick={handleExport} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 rounded-full transition-colors hidden sm:block" title="Baixar CSV">
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={printComponent} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-full transition-colors hidden sm:block" title="Imprimir">
                        <Printer className="w-5 h-5" />
                    </button>

                    <button onClick={() => onEdit(trip)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-violet-600 rounded-full transition-colors" title="Editar Viagem">
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => { if (confirm('Tem certeza que deseja excluir esta viagem?')) { onDelete(trip.id); } }} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="Excluir Viagem">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <Card className="bg-gradient-to-br from-violet-700 to-indigo-800 text-white border-none shadow-lg relative overflow-hidden print:bg-white print:text-black print:border-black print:border">
                <div className="absolute top-0 right-0 p-8 opacity-10 no-print">
                    <Plane className="w-32 h-32 text-white" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-violet-200 text-xs font-bold uppercase tracking-wider print:text-black">Total Gasto</p>
                            <p className="text-4xl font-bold tracking-tight mt-1">{formatCurrency(totalSpent, trip.currency)}</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-full backdrop-blur-md no-print">
                            <Plane className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Users className="text-violet-200 h-4 w-4 print:text-black" />
                            <p className="text-sm text-violet-100 font-medium print:text-black">
                                {trip.participants.length > 0 ? trip.participants.map(p => p.name).join(', ') : 'Sem participantes'}
                            </p>
                        </div>
                        <div className="flex items-center space-x-2 text-violet-200 text-xs print:text-black">
                            <Calendar className="w-3 h-3" />
                            <span>{parseDate(trip.startDate).toLocaleDateString('pt-BR')} - {parseDate(trip.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* TABS NAVIGATION */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar no-print">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'OVERVIEW' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Gastos</button>
                <button onClick={() => setActiveTab('ITINERARY')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ITINERARY' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Roteiro</button>
                <button onClick={() => setActiveTab('CHECKLIST')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'CHECKLIST' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Checklist</button>
                <button onClick={() => setActiveTab('STATS')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'STATS' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Relatórios</button>
                <button onClick={() => setActiveTab('SHOPPING')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'SHOPPING' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Compras</button>
                <button onClick={() => setActiveTab('EXCHANGE')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'EXCHANGE' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Câmbio</button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'OVERVIEW' && <TripOverview trip={trip} transactions={transactions} onUpdateTrip={onUpdateTrip} onNavigateToShared={onNavigateToShared} />}
            {activeTab === 'ITINERARY' && <TripItinerary trip={trip} onUpdateTrip={onUpdateTrip} />}
            {activeTab === 'CHECKLIST' && <TripChecklist trip={trip} onUpdateTrip={onUpdateTrip} />}
            {activeTab === 'STATS' && <TripStats trip={trip} transactions={transactions} />}
            {activeTab === 'SHOPPING' && <TripShopping trip={trip} onUpdateTrip={onUpdateTrip} />}
            {activeTab === 'EXCHANGE' && <TripExchange trip={trip} onUpdateTrip={onUpdateTrip} />}

        </div>
    );
};
