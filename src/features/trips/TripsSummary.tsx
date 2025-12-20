import React from 'react';
import { Card } from '@/components/ui/Card';
import { Plane, Calendar, MapPin } from 'lucide-react';
import { Trip } from '../../types';
import { parseDate } from '../../utils';

interface TripsSummaryProps {
    trips: Trip[];
    userId?: string;
}

export const TripsSummary: React.FC<TripsSummaryProps> = ({ trips, userId }) => {
    // Logic to find next trip
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcomingTrips = trips
        .filter(t => parseDate(t.startDate) >= now)
        .sort((a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime());

    const nextTrip = upcomingTrips[0];
    const activeTripsCount = upcomingTrips.length;

    // Calculate days until next trip
    let daysUntil = 0;
    if (nextTrip) {
        const diff = parseDate(nextTrip.startDate).getTime() - now.getTime();
        daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Next Trip Card */}
            <Card className="bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Plane className="w-32 h-32 text-white" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    {nextTrip ? (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-violet-100 text-xs font-bold uppercase tracking-wider mb-1">Próxima Aventura</p>
                                    <h3 className="text-2xl font-black truncate max-w-[200px]">{nextTrip.name}</h3>
                                    <p className="text-violet-100/90 text-sm mt-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {parseDate(nextTrip.startDate).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                                    <MapPin className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="inline-block bg-white/20 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10">
                                    <span className="text-sm font-bold">Faltam {daysUntil} dias</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-2">
                            <div className="p-3 bg-white/10 rounded-full mb-3">
                                <Plane className="w-8 h-8 text-white/60" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Sem viagens futuras</h3>
                            <p className="text-violet-200 text-xs">Planeje sua próxima jornada!</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Stats Card */}
            <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                    <MapPin className="w-24 h-24 text-white" />
                </div>
                <div className="relative z-10 p-2 flex flex-col justify-center h-full">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center ring-1 ring-indigo-500/40">
                            <Plane className="w-7 h-7 text-indigo-300" />
                        </div>
                        <div>
                            <h4 className="text-3xl font-black text-white leading-none">{trips.length}</h4>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Viagens Totais</p>
                        </div>
                    </div>
                    {activeTripsCount > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10 w-full">
                            <p className="text-xs text-indigo-200 font-medium">
                                {activeTripsCount} viagens planejadas
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
