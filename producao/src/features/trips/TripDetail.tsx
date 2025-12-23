import React, { useState } from 'react';
import { Trip, Transaction, TransactionType, Account, FamilyMember } from '../../types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, Download, Printer, Pencil, Trash2, Plane, Users, Calendar, Wallet } from 'lucide-react';
import { formatCurrency, parseDate } from '../../utils';
import { exportToCSV, prepareTripExpensesForExport, printComponent } from '../../services/exportUtils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

import { TripOverview } from './tabs/TripOverview';
import { TripItinerary } from './tabs/TripItinerary';
import { TripChecklist } from './tabs/TripChecklist';
import { TripStats } from './tabs/TripStats';
import { TripShopping } from './tabs/TripShopping';
import { TripExchange } from './tabs/TripExchange';

interface TripDetailProps {
    trip: Trip;
    transactions: Transaction[];
    accounts: Account[];
    familyMembers: FamilyMember[];
    onBack: () => void;
    onEdit: (trip: Trip) => void;
    onDelete: (id: string) => void;
    onUpdateTrip: (trip: Trip) => void;
    onNavigateToShared?: () => void;
    onEditTransaction?: (id: string) => void; // Trigger modal/form
    onUpdateTransactionInternal: (t: Transaction) => void;
    onDeleteTransactionInternal: (id: string) => void;
    userId?: string;
}

export const TripDetail: React.FC<TripDetailProps> = ({ trip, transactions, accounts, familyMembers, onBack, onEdit, onDelete, onUpdateTrip, onNavigateToShared, onEditTransaction, onUpdateTransactionInternal, onDeleteTransactionInternal, userId }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ITINERARY' | 'CHECKLIST' | 'STATS' | 'SHOPPING' | 'EXCHANGE'>('OVERVIEW');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
                    {/* Owner Governance: Only Owner can Edit/Delete */}
                    {userId === trip.userId && (
                        <>
                            <button onClick={() => onEdit(trip)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 rounded-xl transition-colors" title="Editar Viagem">
                                <Pencil className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-colors" title="Excluir Viagem">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Premium Hero Section */}
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-slate-900 group select-none">
                {/* Background Image / Abstract Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-700 to-fuchsia-800 opacity-90 transition-transform duration-[20s] ease-linear group-hover:scale-110"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-30 grayscale hover:grayscale-0 transition-all duration-700"></div>

                {/* Content Overlay */}
                <div className="relative z-10 p-4 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-10">

                    {/* Left Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold text-white uppercase tracking-widest shadow-lg flex items-center gap-1.5">
                                <Plane className="w-3 h-3 text-indigo-200" />
                                {trip.currency}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-xs font-bold text-indigo-100 uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {Math.ceil((parseDate(trip.endDate).getTime() - parseDate(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))} Dias
                            </span>
                        </div>

                        <div>
                            <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tighter drop-shadow-lg leading-none mb-2">
                                {trip.name}
                            </h1>
                            <p className="text-indigo-100 font-medium text-lg flex items-center gap-2 opacity-90">
                                {parseDate(trip.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                <span className="w-1 h-1 bg-indigo-300 rounded-full"></span>
                                {parseDate(trip.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>

                        <div className="flex items-center -space-x-3 pt-2">
                            {(trip.participants || []).map((p, i) => (
                                <div key={p.id} className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shadow-lg hover:translate-y-1 hover:border-white transition-all z-0 hover:z-10" title={p.name}>
                                    {p.name[0]}
                                </div>
                            ))}
                            {trip.userId === userId && (
                                <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/30 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer" onClick={() => onEdit(trip)}>
                                    <Users className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Metrics - Glass Cards */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex-1 md:min-w-[200px] hover:bg-white/15 transition-colors group/card">
                            <div className="flex items-center gap-2 mb-2 text-indigo-200 group-hover/card:text-white transition-colors">
                                <Wallet className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">Total Gasto</span>
                            </div>
                            <div className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                                {formatCurrency(totalSpent, trip.currency)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Tab Navigation */}
            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-x-auto scrollbar-hide no-print gap-1 shadow-inner">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
                {activeTab === 'OVERVIEW' && (
                    <TripOverview
                        trip={trip}
                        transactions={transactions}
                        accounts={accounts}
                        familyMembers={familyMembers}
                        onUpdateTrip={onUpdateTrip}
                        onNavigateToShared={onNavigateToShared}
                        onEditTransaction={onEditTransaction}
                        onDeleteTransaction={onDeleteTransactionInternal}
                    />
                )}
                {activeTab === 'ITINERARY' && <TripItinerary trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'CHECKLIST' && <TripChecklist trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'STATS' && <TripStats trip={trip} transactions={transactions} />}
                {activeTab === 'SHOPPING' && <TripShopping trip={trip} onUpdateTrip={onUpdateTrip} />}
                {activeTab === 'EXCHANGE' && <TripExchange trip={trip} onUpdateTrip={onUpdateTrip} />}
            </div>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    onDelete(trip.id);
                    setIsDeleteModalOpen(false);
                }}
                title="Excluir Viagem e Despesas?"
                message={`Você está prestes a excluir a viagem "${trip.name}".\n\n⚠️ ATENÇÃO: Todas as despesas e transações vinculadas a esta viagem serão excluídas permanentemente. Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir Tudo"
                isDanger
            />
        </div>
    );
};
