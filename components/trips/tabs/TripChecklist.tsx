import React, { useState, useEffect } from 'react';
import { Trip, TripChecklistItem } from '../../../types';
import { Button } from '../../ui/Button';
import { ListChecks, Save, Plus, X, Check, Pencil } from 'lucide-react';

interface TripChecklistProps {
    trip: Trip;
    onUpdateTrip: (trip: Trip) => void;
}

export const TripChecklist: React.FC<TripChecklistProps> = ({ trip, onUpdateTrip }) => {
    const [checkItem, setCheckItem] = useState('');
    const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);

    // OPTIMISTIC STATE: Initialize with prop data
    const [localChecklist, setLocalChecklist] = useState<TripChecklistItem[]>(trip.checklist || []);

    // Sync with prop updates (from server)
    useEffect(() => {
        setLocalChecklist(trip.checklist || []);
    }, [trip.checklist]);

    // Helper to sync local state to server
    const syncToServer = (newChecklist: TripChecklistItem[]) => {
        onUpdateTrip({ ...trip, checklist: newChecklist });
    };

    const handleSaveChecklistItem = () => {
        if (!checkItem.trim()) return;
        let updatedChecklist = [...localChecklist];

        if (editingChecklistId) {
            updatedChecklist = updatedChecklist.map(item => item.id === editingChecklistId ? { ...item, text: checkItem } : item);
        } else {
            updatedChecklist.push({ id: Math.random().toString(36).substr(2, 9), text: checkItem, isCompleted: false });
        }

        // Optimistic Update
        setLocalChecklist(updatedChecklist);
        syncToServer(updatedChecklist); // Persist

        setCheckItem('');
        setEditingChecklistId(null);
    };

    const startEditingChecklist = (item: TripChecklistItem) => {
        setCheckItem(item.text);
        setEditingChecklistId(item.id);
    };

    const toggleChecklistItem = (itemId: string) => {
        // Optimistic Update
        const updatedChecklist = localChecklist.map(i => i.id === itemId ? { ...i, isCompleted: !i.isCompleted } : i);
        setLocalChecklist(updatedChecklist);

        // Persist (Debounce could be added here if needed, but not strictly necessary for simple toggles)
        syncToServer(updatedChecklist);
    };

    const deleteChecklistItem = (itemId: string) => {
        const updatedChecklist = localChecklist.filter(i => i.id !== itemId);
        setLocalChecklist(updatedChecklist);
        syncToServer(updatedChecklist);

        if (editingChecklistId === itemId) {
            setCheckItem('');
            setEditingChecklistId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex gap-2 no-print">
                <input
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-3 shadow-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder={editingChecklistId ? "Editar item..." : "Adicionar item (ex: Passaporte, Protetor solar)"}
                    value={checkItem}
                    onChange={e => setCheckItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveChecklistItem()}
                />
                <Button onClick={handleSaveChecklistItem}>
                    {editingChecklistId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </Button>
                {editingChecklistId && (
                    <Button onClick={() => { setEditingChecklistId(null); setCheckItem(''); }} variant="secondary">
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {(!localChecklist || localChecklist.length === 0) && (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        <ListChecks className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm">Sua lista está vazia.</p>
                    </div>
                )}
                {localChecklist.map(item => (
                    <div key={item.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${editingChecklistId === item.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleChecklistItem(item.id)}>
                            {/* Click anywhere on row to toggle is better UX */}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${item.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {item.isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                            </div>
                            <span className={`text-sm font-medium select-none ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                                {item.text}
                            </span>
                        </div>
                        <div className="flex gap-2 no-print" onClick={e => e.stopPropagation()}>
                            <button onClick={() => startEditingChecklist(item)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteChecklistItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
