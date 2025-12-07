import React from 'react';
import { Trip } from '../../types';
import { Button } from '../ui/Button';
import { Plane, Plus, Calendar } from 'lucide-react';

interface TripListProps {
    trips: Trip[];
    onTripClick: (tripId: string) => void;
    onCreateClick: () => void;
}

export const TripList: React.FC<TripListProps> = ({ trips, onTripClick, onCreateClick }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Minhas Viagens</h2>
                    <p className="text-slate-600 text-sm">Gerencie orçamentos e roteiros.</p>
                </div>
                <Button onClick={onCreateClick} className="rounded-xl shadow-md shadow-emerald-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Nova Viagem
                </Button>
            </div>

            {trips.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Plane className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Nenhuma viagem encontrada</h3>
                    <p className="text-slate-500 text-sm mb-4">Crie sua primeira viagem para começar a organizar.</p>
                    <Button onClick={onCreateClick} variant="secondary">Criar Viagem Agora</Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map(trip => (
                    <div
                        key={trip.id}
                        className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                        onClick={() => onTripClick(trip.id)}
                    >
                        <div className="h-40 bg-slate-200 relative overflow-hidden pointer-events-none">
                            <img
                                src={trip.imageUrl || `https://picsum.photos/seed/${trip.id}/500/300`}
                                alt={trip.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-80" />
                            <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm border border-white/20">
                                {trip.currency}
                            </span>
                            <div className="absolute bottom-3 left-4 text-white">
                                <h3 className="font-bold text-lg drop-shadow-md">{trip.name}</h3>
                                <p className="text-xs text-slate-300 flex items-center mt-1">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(trip.startDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>
                        <div className="p-5 pointer-events-none">
                            <div className="flex items-center justify-between">
                                <div className="flex -space-x-2 pl-1">
                                    {trip.participants.slice(0, 4).map(p => (
                                        <div
                                            key={p.id}
                                            className="h-8 w-8 rounded-full ring-2 ring-white bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold uppercase shadow-sm"
                                            title={p.name}
                                        >
                                            {p.name[0]}
                                        </div>
                                    ))}
                                    {trip.participants.length > 4 && (
                                        <div className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold uppercase shadow-sm">
                                            +{trip.participants.length - 4}
                                        </div>
                                    )}
                                </div>
                                <span className="text-violet-600 font-bold text-xs bg-violet-50 px-3 py-1.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                    ABRIR
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
