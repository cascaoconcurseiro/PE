import React, { useState } from 'react';
import { Trip, FamilyMember } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowLeft, Calendar, Users, X, Clock, Globe, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { AVAILABLE_CURRENCIES } from '../../services/currencyService';

interface TripFormProps {
    initialData?: Trip | null;
    familyMembers: FamilyMember[];
    onSave: (trip: Omit<Trip, 'id'> | Trip) => void;
    onCancel: () => void;
    editingTripId?: string | null;
}

export const TripForm: React.FC<TripFormProps> = ({ initialData, familyMembers, onSave, onCancel, editingTripId }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(initialData?.endDate || new Date().toISOString().split('T')[0]);
    const [participants, setParticipants] = useState<string[]>(initialData?.participants.map(p => p.id) || []);
    const [currency, setCurrency] = useState(initialData?.currency || 'BRL');
    const [formError, setFormError] = useState<string | null>(null);

    const calculateDuration = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays + 1 : 0;
    };

    const duration = calculateDuration();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!name.trim()) {
            setFormError("O nome da viagem é obrigatório.");
            return;
        }
        if (!startDate || !endDate) {
            setFormError("Datas de início e fim são obrigatórias.");
            return;
        }
        if (duration <= 0) {
            setFormError("A data de término deve ser igual ou posterior à data de início.");
            return;
        }

        const participantObjects = familyMembers
            .filter(m => participants.includes(m.id))
            .map(m => ({ id: m.id, name: m.name }));

        const tripData: any = {
            name,
            startDate,
            endDate,
            participants: participantObjects,
            currency,
            // Preserve existing data if editing, or set defaults
            budget: initialData?.budget || 0,
            itinerary: initialData?.itinerary || [],
            checklist: initialData?.checklist || [],
            shoppingList: initialData?.shoppingList || [],
            exchangeEntries: initialData?.exchangeEntries || []
        };

        if (editingTripId && initialData) {
            tripData.id = initialData.id;
        }

        onSave(tripData);
    };

    const toggleParticipant = (memberId: string) => {
        if (participants.includes(memberId)) {
            setParticipants(prev => prev.filter(id => id !== memberId));
        } else {
            setParticipants(prev => [...prev, memberId]);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onCancel} className="p-2">
                    <ArrowLeft className="w-5 h-5 text-slate-700" />
                </Button>
                <h2 className="text-xl font-bold text-slate-800">{editingTripId ? 'Editar Viagem' : 'Nova Viagem'}</h2>
            </div>
            <Card className="bg-white dark:bg-slate-800 border-violet-100 dark:border-violet-900 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Viagem</label>
                        <input
                            className="w-full text-lg font-semibold text-slate-900 dark:text-white border-b-2 border-slate-200 dark:border-slate-700 focus:border-violet-500 outline-none py-2 bg-transparent placeholder-slate-500 dark:placeholder-slate-400 transition-colors"
                            placeholder="Ex: Férias em Miami"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative group">
                            <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl flex flex-col justify-center shadow-sm hover:border-violet-400 dark:hover:border-violet-600 transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30 relative h-20 overflow-hidden">
                                <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
                                    <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Início</span>
                                </div>
                                <input
                                    type="date"
                                    className="w-full h-full pt-6 px-3 text-center font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none cursor-pointer"
                                    value={startDate}
                                    onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                    onChange={e => setStartDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="relative group">
                            <div className={`bg-white dark:bg-slate-800 border rounded-xl flex flex-col justify-center shadow-sm transition-all relative h-20 overflow-hidden ${duration <= 0 ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-600 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30'}`}>
                                <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
                                    <Calendar className={`w-4 h-4 ${duration <= 0 ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400'}`} />
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fim</span>
                                </div>
                                <input
                                    type="date"
                                    className="w-full h-full pt-6 px-3 text-center font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none cursor-pointer"
                                    value={endDate}
                                    onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                    onChange={e => setEndDate(e.target.value)}
                                    min={startDate}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    {duration > 0 ? (
                        <div className="flex items-center justify-center p-3 bg-violet-50 rounded-xl border border-violet-100 text-violet-800 gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-bold text-sm">Duração total: {duration} dias</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-3 bg-red-50 rounded-xl border border-red-100 text-red-800 gap-2">
                            <X className="w-4 h-4" />
                            <span className="font-bold text-sm">Data de fim inválida</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Moeda Principal</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
                            >
                                {AVAILABLE_CURRENCIES.map(curr => (
                                    <option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-violet-700 dark:text-violet-400" /> Quem vai?
                        </label>
                        {familyMembers.length === 0 ? (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-800 dark:text-amber-400 text-sm border border-amber-100 dark:border-amber-800">
                                Cadastre membros na aba <strong>Família</strong> para adicioná-los aqui.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {familyMembers.map(member => {
                                    const isSelected = participants.includes(member.id);
                                    return (
                                        <div
                                            key={member.id}
                                            onClick={() => toggleParticipant(member.id)}
                                            className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-violet-700 text-white border-violet-700 shadow-md shadow-violet-200 dark:shadow-violet-900/50' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{member.name}</span>
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {formError && (
                        <div className="text-red-700 text-sm font-bold p-3 bg-red-50 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {formError}
                        </div>
                    )}
                    <div className="pt-4">
                        <Button type="submit" className="w-full h-12 text-lg bg-violet-700 hover:bg-violet-800 shadow-lg shadow-violet-200" disabled={!name || !startDate || !endDate || duration <= 0}>
                            {editingTripId ? 'Salvar Alterações' : 'Criar Viagem'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
