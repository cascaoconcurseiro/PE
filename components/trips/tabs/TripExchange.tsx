import React, { useState } from 'react';
import { Trip, TripExchangeEntry } from '../../../types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Save, Plus, Trash2, Pencil } from 'lucide-react';
import { formatCurrency, parseDate } from '../../../utils';

interface TripExchangeProps {
    trip: Trip;
    onUpdateTrip: (trip: Trip) => void;
}

export const TripExchange: React.FC<TripExchangeProps> = ({ trip, onUpdateTrip }) => {
    const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);
    const [exchangeBRL, setExchangeBRL] = useState('');
    const [exchangeForeign, setExchangeForeign] = useState('');
    const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null);

    const handleSaveExchangeEntry = () => {
        if (!exchangeBRL || !exchangeForeign) return;

        const brl = parseFloat(exchangeBRL);
        const foreign = parseFloat(exchangeForeign);

        // Validation
        if (isNaN(brl) || brl <= 0) {
            alert('Valor em BRL deve ser maior que zero');
            return;
        }

        if (isNaN(foreign) || foreign <= 0) {
            alert(`Valor em ${trip.currency} deve ser maior que zero`);
            return;
        }

        const rate = brl / foreign;
        let updatedEntries = [...(trip.exchangeEntries || [])];

        if (editingExchangeId) {
            updatedEntries = updatedEntries.map(entry => entry.id === editingExchangeId ? { ...entry, date: exchangeDate, amountBRL: brl, amountForeign: foreign, exchangeRate: rate } : entry);
        } else {
            updatedEntries.push({ id: Math.random().toString(36).substr(2, 9), date: exchangeDate, amountBRL: brl, amountForeign: foreign, exchangeRate: rate, currency: trip.currency });
        }

        onUpdateTrip({ ...trip, exchangeEntries: updatedEntries });
        setExchangeBRL('');
        setExchangeForeign('');
        setEditingExchangeId(null);
    };

    const startEditingExchange = (entry: TripExchangeEntry) => {
        setExchangeDate(entry.date);
        setExchangeBRL(entry.amountBRL.toString());
        setExchangeForeign(entry.amountForeign.toString());
        setEditingExchangeId(entry.id);
    };

    const deleteExchangeEntry = (itemId: string) => {
        onUpdateTrip({
            ...trip,
            exchangeEntries: (trip.exchangeEntries || []).filter(i => i.id !== itemId)
        });
        if (editingExchangeId === itemId) {
            setExchangeBRL('');
            setExchangeForeign('');
            setEditingExchangeId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Card title={editingExchangeId ? "Editar Câmbio" : "Controle de Câmbio"}>
                <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl mb-6 border border-violet-100 dark:border-violet-800">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">Média Ponderada</p>
                            <h3 className="text-2xl font-black text-violet-900 dark:text-violet-300">
                                {(() => {
                                    const entries = trip.exchangeEntries || [];
                                    const totalBRL = entries.reduce((acc, e) => acc + e.amountBRL, 0);
                                    const totalForeign = entries.reduce((acc, e) => acc + e.amountForeign, 0);
                                    const avg = totalForeign > 0 ? totalBRL / totalForeign : 0;
                                    return `R$ ${avg.toFixed(2)}`;
                                })()}
                            </h3>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">Total Comprado</p>
                            <p className="text-lg font-bold text-violet-800 dark:text-violet-300">
                                {formatCurrency((trip.exchangeEntries || []).reduce((acc, e) => acc + e.amountForeign, 0), trip.currency)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm no-print">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{editingExchangeId ? "Editar Entrada" : "Nova Compra de Moeda"}</h4>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            className="w-32 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            value={exchangeDate}
                            onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                            onChange={e => setExchangeDate(e.target.value)}
                        />
                        <input
                            type="number"
                            className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            placeholder="Valor em R$ (BRL)"
                            value={exchangeBRL}
                            onChange={e => setExchangeBRL(e.target.value)}
                        />
                        <input
                            type="number"
                            className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            placeholder={`Valor em ${trip.currency}`}
                            value={exchangeForeign}
                            onChange={e => setExchangeForeign(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveExchangeEntry} disabled={!exchangeBRL || !exchangeForeign} className="w-full">
                            {editingExchangeId ? <><Save className="w-4 h-4 mr-2" /> Salvar</> : <><Plus className="w-4 h-4 mr-2" /> Registrar Câmbio</>}
                        </Button>
                        {editingExchangeId && (
                            <Button onClick={() => { setEditingExchangeId(null); setExchangeBRL(''); setExchangeForeign(''); }} variant="secondary">
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    {trip.exchangeEntries?.map(entry => (
                        <div key={entry.id} className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm ${editingExchangeId === entry.id ? 'ring-2 ring-violet-200 dark:ring-violet-800' : ''}`}>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{parseDate(entry.date).toLocaleDateString('pt-BR')}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Taxa: R$ {entry.exchangeRate.toFixed(4)}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-emerald-600 dark:text-emerald-400">+ {formatCurrency(entry.amountForeign, entry.currency)}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">- {formatCurrency(entry.amountBRL, 'BRL')}</p>
                            </div>
                            <div className="flex gap-2 ml-4 no-print">
                                <button onClick={() => startEditingExchange(entry)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteExchangeEntry(entry.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};
