import React, { useState } from 'react';
import { Trip, TripItineraryItem } from '../../../types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Calendar, Plus, Save, X, MapPin, Pencil, Trash2, Map } from 'lucide-react';
import { parseDate } from '../../../utils';

interface TripItineraryProps {
    trip: Trip;
    onUpdateTrip: (trip: Trip) => void;
}

export const TripItinerary: React.FC<TripItineraryProps> = ({ trip, onUpdateTrip }) => {
    const [itiDesc, setItiDesc] = useState('');
    const [itiDate, setItiDate] = useState(new Date().toISOString().split('T')[0]);
    const [itiTime, setItiTime] = useState('');
    const [itiType, setItiType] = useState<TripItineraryItem['type']>('ACTIVITY');
    const [editingItineraryId, setEditingItineraryId] = useState<string | null>(null);

    const handleSaveItineraryItem = () => {
        if (!itiDesc.trim() || !itiDate) return;
        let updatedItinerary = [...(trip.itinerary || [])];
        if (editingItineraryId) {
            updatedItinerary = updatedItinerary.map(item => item.id === editingItineraryId ? { ...item, description: itiDesc, date: itiDate, time: itiTime, type: itiType } : item);
        } else {
            updatedItinerary.push({ id: Math.random().toString(36).substr(2, 9), description: itiDesc, date: itiDate, time: itiTime, type: itiType });
        }
        onUpdateTrip({ ...trip, itinerary: updatedItinerary });
        setItiDesc('');
        setItiTime('');
        setEditingItineraryId(null);
    };

    const startEditingItinerary = (item: TripItineraryItem) => {
        setItiDesc(item.description);
        setItiDate(item.date);
        setItiTime(item.time || '');
        setItiType(item.type);
        setEditingItineraryId(item.id);
    };

    const deleteItineraryItem = (itemId: string) => {
        onUpdateTrip({
            ...trip,
            itinerary: (trip.itinerary || []).filter(i => i.id !== itemId)
        });
        if (editingItineraryId === itemId) {
            setItiDesc('');
            setItiTime('');
            setEditingItineraryId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Card title={editingItineraryId ? "Editar Evento" : "Adicionar Evento"} className="no-print dark:bg-slate-800 dark:border-slate-700">
                <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 flex items-center gap-2 shadow-sm hover:border-violet-400 dark:hover:border-violet-600 transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30 relative h-12 overflow-hidden">
                                    <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                                        <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <input
                                        type="date"
                                        className="w-full h-full pl-8 pr-2 bg-transparent text-sm font-bold text-slate-900 dark:text-white border-none outline-none cursor-pointer"
                                        value={itiDate}
                                        onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                        onChange={e => setItiDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <input
                                type="time"
                                className="w-24 rounded-xl border border-slate-300 dark:border-slate-600 p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                                value={itiTime}
                                onChange={e => setItiTime(e.target.value)}
                            />
                        </div>
                        <select
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                            value={itiType}
                            onChange={e => setItiType(e.target.value as TripItineraryItem['type'])}
                        >
                            <option value="FLIGHT">Voo</option>
                            <option value="LODGING">Hospedagem</option>
                            <option value="ACTIVITY">Passeio</option>
                            <option value="FOOD">Comida</option>
                            <option value="OTHER">Outro</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                            placeholder="Descrição (ex: Voo LATAM, Jantar)"
                            value={itiDesc}
                            onChange={e => setItiDesc(e.target.value)}
                        />
                        <Button onClick={handleSaveItineraryItem} disabled={!itiDate || !itiDesc} size="sm">
                            {editingItineraryId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                        {editingItineraryId && (
                            <Button onClick={() => { setEditingItineraryId(null); setItiDesc(''); setItiTime(''); }} size="sm" variant="secondary">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
            <div className="relative border-l-2 border-violet-100 ml-4 space-y-6">
                {(!trip.itinerary || trip.itinerary.length === 0) && (
                    <div className="pl-6 py-4">
                        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4 text-center">
                            <Map className="w-8 h-8 text-violet-300 dark:text-violet-600 mx-auto mb-2" />
                            <p className="text-sm font-bold text-violet-900 dark:text-violet-300">Roteiro Vazio</p>
                            <p className="text-xs text-violet-600 dark:text-violet-400">Adicione voos, hotéis e passeios.</p>
                        </div>
                    </div>
                )}
                {trip.itinerary?.sort((a, b) => (a.date + (a.time || '')) > (b.date + (b.time || '')) ? 1 : -1).map(item => (
                    <div key={item.id} className={`relative pl-6 ${editingItineraryId === item.id ? 'opacity-50' : ''}`}>
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${item.type === 'FLIGHT' ? 'bg-blue-500' : item.type === 'LODGING' ? 'bg-indigo-500' : item.type === 'FOOD' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{parseDate(item.date).toLocaleDateString('pt-BR')} {item.time ? `• ${item.time}` : ''}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded text-white font-bold ${item.type === 'FLIGHT' ? 'bg-blue-500' : item.type === 'LODGING' ? 'bg-indigo-500' : item.type === 'FOOD' ? 'bg-orange-500' : 'bg-emerald-500'}`}>{item.type}</span>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">{item.description}</p>
                                {item.location && <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {item.location}</p>}
                            </div>
                            <div className="flex gap-1 no-print">
                                <button onClick={() => startEditingItinerary(item)} className="p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteItineraryItem(item.id)} className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
