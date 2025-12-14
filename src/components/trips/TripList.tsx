import React from 'react';
import { Trip } from '../../types';
import { Button } from '../ui/Button';
import { Plane, Plus, Calendar } from 'lucide-react';
import { parseDate } from '../../utils';
import { TripsSummary } from './TripsSummary';

interface TripListProps {
    trips: Trip[];
    onTripClick: (tripId: string) => void;
    onCreateClick: () => void;
interface TripListProps {
    trips: Trip[];
    onTripClick: (tripId: string) => void;
    onCreateClick: () => void;
    userId?: string;
}

export const TripList: React.FC<TripListProps> = ({ trips, onTripClick, onCreateClick, userId }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Minhas Viagens</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Explore o mundo e controle gastos.</p>
                </div>
                <Button onClick={onCreateClick} size="sm" className="shadow-md shadow-violet-500/20 bg-violet-600 hover:bg-violet-700 text-white h-9 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Viagem
                </Button>
            </div>

            <TripsSummary trips={trips} />

            {trips.length === 0 && (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-sm">
                        <Plane className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Nenhuma viagem encontrada</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs mx-auto">Crie sua primeira viagem para começar a organizar.</p>
                    <Button onClick={onCreateClick} variant="secondary" className="bg-white dark:bg-slate-700 shadow-sm">Criar Viagem Agora</Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {trips.map(trip => (
                    <div
                        key={trip.id}
                        className="group relative bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                        onClick={() => onTripClick(trip.id)}
                    >
                        <div className="h-44 bg-gradient-to-br from-blue-400 to-violet-500 relative overflow-hidden pointer-events-none">
                            {trip.imageUrl ? (
                                <img
                                    src={trip.imageUrl}
                                    alt={trip.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-5xl font-black opacity-30">
                                    {trip.name.charAt(0).toUpperCase()}
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-90" />

                            <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm border border-white/20">
                                {trip.currency}
                            </span>

                            <div className="absolute bottom-4 left-5 text-white pr-4">
                                <h3 className="font-bold text-xl drop-shadow-md leading-tight mb-1">{trip.name}</h3>
                                <p className="text-xs text-slate-300 flex items-center font-medium">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-80" />
                                    {parseDate(trip.startDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>

                        <div className="p-5 pointer-events-none">
                            <div className="flex items-center justify-between">
                                <div className="flex -space-x-3 pl-1">
                                    {trip.participants.slice(0, 4).map((p, i) => (
                                        <div
                                            key={p.id}
                                            className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-slate-800 bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-violet-700 dark:text-violet-300 text-xs font-bold uppercase shadow-sm"
                                            title={p.name}
                                            style={{ zIndex: 10 - i }}
                                        >
                                            {p.name[0]}
                                        </div>
                                    ))}
                                    {trip.participants.length > 4 && (
                                        <div className="h-9 w-9 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs font-bold uppercase shadow-sm" style={{ zIndex: 0 }}>
                                            +{trip.participants.length - 4}
                                        </div>
                                    )}
                                </div>
                                <span className="text-violet-600 dark:text-violet-400 font-bold text-[10px] bg-violet-50 dark:bg-violet-900/30 px-3 py-1.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition-colors tracking-wide">
                                    VER DETALHES
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
