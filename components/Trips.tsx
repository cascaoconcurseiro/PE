import React, { useState, useRef } from 'react';
import { Trip, Transaction, TransactionType, Category, Account, FamilyMember, TripItineraryItem, TripChecklistItem, TripShoppingItem, TripExchangeEntry } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { calculateTripDebts } from '../services/balanceEngine';
import { AVAILABLE_CURRENCIES } from '../services/currencyService';
import { MapPin, Users, Calendar, Plus, Calculator, Sparkles, ArrowLeft, Check, Plane, ListChecks, PieChart as PieIcon, Map, Hotel, Utensils, Flag, Trash2, X, Clock, Target, Pencil, Save, AlertCircle, ShoppingBag, Banknote, RefreshCw, ArrowRight, Globe, ChevronDown, Download, Printer } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatCurrency, getCategoryIcon } from '../utils';
import { exportToCSV, prepareTripExpensesForExport, printComponent } from '../services/exportUtils';

interface TripsProps {
    trips: Trip[];
    transactions: Transaction[];
    accounts: Account[];
    familyMembers: FamilyMember[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onAddTrip: (t: Trip) => void;
    onUpdateTrip?: (t: Trip) => void;
    onDeleteTrip?: (id: string) => void;
    onNavigateToShared?: () => void;
}

export const Trips: React.FC<TripsProps> = ({ trips, transactions, accounts, familyMembers, onAddTransaction, onAddTrip, onUpdateTrip, onDeleteTrip, onNavigateToShared }) => {
    // ... (Keep state logic exactly as is)
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ITINERARY' | 'CHECKLIST' | 'STATS' | 'SHOPPING' | 'EXCHANGE'>('OVERVIEW');

    const [newTripName, setNewTripName] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTripParticipants, setNewTripParticipants] = useState<string[]>([]);
    const [newTripCurrency, setNewTripCurrency] = useState('BRL');
    const [formError, setFormError] = useState<string | null>(null);
    const [editingTripId, setEditingTripId] = useState<string | null>(null);

    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState('');

    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [loadingAi, setLoadingAi] = useState(false);

    const [itiDesc, setItiDesc] = useState('');
    const [itiDate, setItiDate] = useState(new Date().toISOString().split('T')[0]);
    const [itiTime, setItiTime] = useState('');
    const [itiType, setItiType] = useState<TripItineraryItem['type']>('ACTIVITY');
    const [editingItineraryId, setEditingItineraryId] = useState<string | null>(null);

    const [checkItem, setCheckItem] = useState('');
    const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);

    const [shopItem, setShopItem] = useState('');
    const [shopEstCost, setShopEstCost] = useState('');
    const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);

    const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);
    const [exchangeBRL, setExchangeBRL] = useState('');
    const [exchangeForeign, setExchangeForeign] = useState('');
    const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const tripTransactions = transactions.filter(t => t.tripId === selectedTripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalSpent = tripTransactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE ? t.amount : 0), 0);

    const calculateDuration = () => {
        if (!newStartDate || !newEndDate) return 0;
        const start = new Date(newStartDate);
        const end = new Date(newEndDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays + 1 : 0;
    };

    const duration = calculateDuration();

    const handleCreateOrUpdateTrip = (e: React.FormEvent) => {
        // ... (Keep existing implementation)
        e.preventDefault();
        setFormError(null);
        if (!newTripName.trim()) { setFormError("O nome da viagem é obrigatório."); return; }
        if (!newStartDate || !newEndDate) { setFormError("Datas de início e fim são obrigatórias."); return; }
        if (duration <= 0) { setFormError("A data de término deve ser igual ou posterior à data de início."); return; }
        const participants = familyMembers.filter(m => newTripParticipants.includes(m.id)).map(m => ({ id: m.id, name: m.name }));
        if (editingTripId && onUpdateTrip) {
            const existingTrip = trips.find(t => t.id === editingTripId);
            if (existingTrip) {
                onUpdateTrip({ ...existingTrip, name: newTripName, startDate: newStartDate, endDate: newEndDate, participants: participants, currency: newTripCurrency });
            }
        } else {
            onAddTrip({ id: Math.random().toString(36).substr(2, 9), name: newTripName, startDate: newStartDate, endDate: newEndDate, participants: participants, currency: newTripCurrency, budget: 0, itinerary: [], checklist: [] });
        }
        setIsCreatingTrip(false); setEditingTripId(null); setNewTripName(''); setNewStartDate(new Date().toISOString().split('T')[0]); setNewEndDate(new Date().toISOString().split('T')[0]); setNewTripParticipants([]); setNewTripCurrency('BRL');
    };

    const startEditingTrip = (trip: Trip) => {
        setEditingTripId(trip.id); setNewTripName(trip.name); setNewStartDate(trip.startDate); setNewEndDate(trip.endDate); setNewTripParticipants(trip.participants.map(p => p.id)); setNewTripCurrency(trip.currency || 'BRL'); setIsCreatingTrip(true); setSelectedTripId(null);
    };

    const toggleParticipant = (memberId: string) => {
        if (newTripParticipants.includes(memberId)) { setNewTripParticipants(prev => prev.filter(id => id !== memberId)); } else { setNewTripParticipants(prev => [...prev, memberId]); }
    };

    const handleSettlement = async () => {
        if (!selectedTrip) return;
        setLoadingAi(true);
        const settlementLines = calculateTripDebts(tripTransactions, selectedTrip.participants);
        const report = `# Resumo do Acerto de Contas\n\n${settlementLines.map(l => `- ${l}`).join('\n')}\n\n---\n*Este cálculo considera apenas dívidas não quitadas.*`;
        setAiAnalysis(report); setLoadingAi(false);
    };

    const handleSaveBudget = () => {
        if (!selectedTrip || !onUpdateTrip) return;
        const budgetVal = parseFloat(tempBudget);
        if (isNaN(budgetVal) || budgetVal < 0) { alert("Orçamento inválido."); return; }
        onUpdateTrip({ ...selectedTrip, budget: budgetVal }); setIsEditingBudget(false);
    };

    const startEditingBudget = () => { setTempBudget(selectedTrip?.budget?.toString() || ''); setIsEditingBudget(true); };

    // ... (Keep itinerary, checklist, shopping handlers exactly as is)
    const handleSaveItineraryItem = () => {
        if (!selectedTrip || !onUpdateTrip || !itiDesc.trim() || !itiDate) return;
        let updatedItinerary = [...(selectedTrip.itinerary || [])];
        if (editingItineraryId) { updatedItinerary = updatedItinerary.map(item => item.id === editingItineraryId ? { ...item, description: itiDesc, date: itiDate, time: itiTime, type: itiType } : item); } else { updatedItinerary.push({ id: Math.random().toString(36).substr(2, 9), description: itiDesc, date: itiDate, time: itiTime, type: itiType }); }
        onUpdateTrip({ ...selectedTrip, itinerary: updatedItinerary }); setItiDesc(''); setItiTime(''); setEditingItineraryId(null);
    };
    const startEditingItinerary = (item: TripItineraryItem) => { setItiDesc(item.description); setItiDate(item.date); setItiTime(item.time || ''); setItiType(item.type); setEditingItineraryId(item.id); };
    const deleteItineraryItem = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, itinerary: (selectedTrip.itinerary || []).filter(i => i.id !== itemId) }); if (editingItineraryId === itemId) { setItiDesc(''); setItiTime(''); setEditingItineraryId(null); } };

    const handleSaveChecklistItem = () => {
        if (!selectedTrip || !onUpdateTrip || !checkItem.trim()) return;
        let updatedChecklist = [...(selectedTrip.checklist || [])];
        if (editingChecklistId) { updatedChecklist = updatedChecklist.map(item => item.id === editingChecklistId ? { ...item, text: checkItem } : item); } else { updatedChecklist.push({ id: Math.random().toString(36).substr(2, 9), text: checkItem, isCompleted: false }); }
        onUpdateTrip({ ...selectedTrip, checklist: updatedChecklist }); setCheckItem(''); setEditingChecklistId(null);
    };
    const startEditingChecklist = (item: TripChecklistItem) => { setCheckItem(item.text); setEditingChecklistId(item.id); };
    const toggleChecklistItem = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, checklist: (selectedTrip.checklist || []).map(i => i.id === itemId ? { ...i, isCompleted: !i.isCompleted } : i) }); };
    const deleteChecklistItem = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, checklist: (selectedTrip.checklist || []).filter(i => i.id !== itemId) }); if (editingChecklistId === itemId) { setCheckItem(''); setEditingChecklistId(null); } };

    const handleSaveShoppingItem = () => {
        if (!selectedTrip || !onUpdateTrip || !shopItem.trim()) return;
        let updatedList = [...(selectedTrip.shoppingList || [])];
        const estCost = shopEstCost ? parseFloat(shopEstCost) : 0;
        if (editingShoppingId) { updatedList = updatedList.map(item => item.id === editingShoppingId ? { ...item, item: shopItem, estimatedCost: estCost } : item); } else { updatedList.push({ id: Math.random().toString(36).substr(2, 9), item: shopItem, estimatedCost: estCost, purchased: false }); }
        onUpdateTrip({ ...selectedTrip, shoppingList: updatedList }); setShopItem(''); setShopEstCost(''); setEditingShoppingId(null);
    };
    const startEditingShopping = (item: TripShoppingItem) => { setShopItem(item.item); setShopEstCost(item.estimatedCost?.toString() || ''); setEditingShoppingId(item.id); };
    const toggleShoppingItem = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, shoppingList: (selectedTrip.shoppingList || []).map(i => i.id === itemId ? { ...i, purchased: !i.purchased } : i) }); };
    const deleteShoppingItem = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, shoppingList: (selectedTrip.shoppingList || []).filter(i => i.id !== itemId) }); if (editingShoppingId === itemId) { setShopItem(''); setShopEstCost(''); setEditingShoppingId(null); } };

    const handleSaveExchangeEntry = () => {
        if (!selectedTrip || !onUpdateTrip || !exchangeBRL || !exchangeForeign) return;
        const brl = parseFloat(exchangeBRL); const foreign = parseFloat(exchangeForeign); const rate = foreign > 0 ? brl / foreign : 0;
        let updatedEntries = [...(selectedTrip.exchangeEntries || [])];
        if (editingExchangeId) { updatedEntries = updatedEntries.map(entry => entry.id === editingExchangeId ? { ...entry, date: exchangeDate, amountBRL: brl, amountForeign: foreign, exchangeRate: rate } : entry); } else { updatedEntries.push({ id: Math.random().toString(36).substr(2, 9), date: exchangeDate, amountBRL: brl, amountForeign: foreign, exchangeRate: rate, currency: selectedTrip.currency }); }
        onUpdateTrip({ ...selectedTrip, exchangeEntries: updatedEntries }); setExchangeBRL(''); setExchangeForeign(''); setEditingExchangeId(null);
    };
    const startEditingExchange = (entry: TripExchangeEntry) => { setExchangeDate(entry.date); setExchangeBRL(entry.amountBRL.toString()); setExchangeForeign(entry.amountForeign.toString()); setEditingExchangeId(entry.id); };
    const deleteExchangeEntry = (itemId: string) => { if (!selectedTrip || !onUpdateTrip) return; onUpdateTrip({ ...selectedTrip, exchangeEntries: (selectedTrip.exchangeEntries || []).filter(i => i.id !== itemId) }); if (editingExchangeId === itemId) { setExchangeBRL(''); setExchangeForeign(''); setEditingExchangeId(null); } };

    const handleExport = () => {
        if (!selectedTrip) return;
        const data = prepareTripExpensesForExport(tripTransactions);
        exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Pago Por', 'Valor'], `Viagem_${selectedTrip.name}`);
    };

    if (isCreatingTrip) {
        // ... (Keep existing Create Trip form)
        return (
            <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-300">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => { setIsCreatingTrip(false); setEditingTripId(null); }} className="p-2"><ArrowLeft className="w-5 h-5 text-slate-700" /></Button>
                    <h2 className="text-xl font-bold text-slate-800">{editingTripId ? 'Editar Viagem' : 'Nova Viagem'}</h2>
                </div>
                <Card className="bg-white dark:bg-slate-800 border-violet-100 dark:border-violet-900 shadow-lg">
                    <form onSubmit={handleCreateOrUpdateTrip} className="space-y-6">
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Viagem</label><input className="w-full text-lg font-semibold text-slate-900 dark:text-white border-b-2 border-slate-200 dark:border-slate-700 focus:border-violet-500 outline-none py-2 bg-transparent placeholder-slate-500 dark:placeholder-slate-400 transition-colors" placeholder="Ex: Férias em Miami" value={newTripName} onChange={e => setNewTripName(e.target.value)} autoFocus required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative group"><div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl flex flex-col justify-center shadow-sm hover:border-violet-400 dark:hover:border-violet-600 transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30 relative h-20 overflow-hidden"><div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none"><Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" /><span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Início</span></div><input type="date" className="w-full h-full pt-6 px-3 text-center font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none cursor-pointer" value={newStartDate} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setNewStartDate(e.target.value)} required /></div></div>
                            <div className="relative group"><div className={`bg-white dark:bg-slate-800 border rounded-xl flex flex-col justify-center shadow-sm transition-all relative h-20 overflow-hidden ${duration <= 0 ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-600 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30'}`}><div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none"><Calendar className={`w-4 h-4 ${duration <= 0 ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400'}`} /><span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fim</span></div><input type="date" className="w-full h-full pt-6 px-3 text-center font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none cursor-pointer" value={newEndDate} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setNewEndDate(e.target.value)} min={newStartDate} required /></div></div>
                        </div>
                        {duration > 0 ? (<div className="flex items-center justify-center p-3 bg-violet-50 rounded-xl border border-violet-100 text-violet-800 gap-2"><Clock className="w-4 h-4" /><span className="font-bold text-sm">Duração total: {duration} dias</span></div>) : (<div className="flex items-center justify-center p-3 bg-red-50 rounded-xl border border-red-100 text-red-800 gap-2"><X className="w-4 h-4" /><span className="font-bold text-sm">Data de fim inválida</span></div>)}
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Moeda Principal</label><div className="relative"><Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" /><select value={newTripCurrency} onChange={(e) => setNewTripCurrency(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-violet-500 appearance-none">{AVAILABLE_CURRENCIES.map(curr => (<option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>))}</select><ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" /></div></div>
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-violet-700 dark:text-violet-400" /> Quem vai?</label>{familyMembers.length === 0 ? (<div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-800 dark:text-amber-400 text-sm border border-amber-100 dark:border-amber-800">Cadastre membros na aba <strong>Família</strong> para adicioná-los aqui.</div>) : (<div className="grid grid-cols-2 gap-3">{familyMembers.map(member => { const isSelected = newTripParticipants.includes(member.id); return (<div key={member.id} onClick={() => toggleParticipant(member.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-violet-700 text-white border-violet-700 shadow-md shadow-violet-200 dark:shadow-violet-900/50' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{member.name}</span>{isSelected && <Check className="w-4 h-4" />}</div>); })}</div>)}</div>
                        {formError && (<div className="text-red-700 text-sm font-bold p-3 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {formError}</div>)}
                        <div className="pt-4"><Button type="submit" className="w-full h-12 text-lg bg-violet-700 hover:bg-violet-800 shadow-lg shadow-violet-200" disabled={!newTripName || !newStartDate || !newEndDate || duration <= 0}>{editingTripId ? 'Salvar Alterações' : 'Criar Viagem'}</Button></div>
                    </form>
                </Card>
            </div>
        );
    }

    if (selectedTrip) {
        const budget = selectedTrip.budget || 0;
        const percentUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;
        const isOverBudget = totalSpent > budget && budget > 0;
        const remaining = budget - totalSpent;

        return (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-24">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setSelectedTripId(null)} className="text-slate-700 hover:text-slate-900 px-0">
                        <ArrowLeft className="w-5 h-5 mr-1" /> Voltar
                    </Button>
                    <h2 className="text-xl font-bold text-violet-900 truncate max-w-[150px]">{selectedTrip.name}</h2>
                    <div className="flex gap-2">
                        {/* EXPORT BUTTONS */}
                        <button onClick={handleExport} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 rounded-full transition-colors hidden sm:block" title="Baixar CSV">
                            <Download className="w-5 h-5" />
                        </button>
                        <button onClick={printComponent} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-full transition-colors hidden sm:block" title="Imprimir">
                            <Printer className="w-5 h-5" />
                        </button>

                        <button onClick={() => startEditingTrip(selectedTrip)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-violet-600 rounded-full transition-colors" title="Editar Viagem"><Pencil className="w-5 h-5" /></button>
                        {onDeleteTrip && (<button onClick={() => { if (confirm('Tem certeza que deseja excluir esta viagem?')) { onDeleteTrip(selectedTrip.id); setSelectedTripId(null); } }} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="Excluir Viagem"><Trash2 className="w-5 h-5" /></button>)}
                    </div>
                </div>

                <Card className="bg-gradient-to-br from-violet-700 to-indigo-800 text-white border-none shadow-lg relative overflow-hidden print:bg-white print:text-black print:border-black print:border">
                    <div className="absolute top-0 right-0 p-8 opacity-10 no-print"><Plane className="w-32 h-32 text-white" /></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div><p className="text-violet-200 text-xs font-bold uppercase tracking-wider print:text-black">Total Gasto</p><p className="text-4xl font-bold tracking-tight mt-1">{formatCurrency(totalSpent, selectedTrip.currency)}</p></div>
                            <div className="p-3 bg-white/20 rounded-full backdrop-blur-md no-print"><Plane className="h-6 w-6 text-white" /></div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2"><Users className="text-violet-200 h-4 w-4 print:text-black" /><p className="text-sm text-violet-100 font-medium print:text-black">{selectedTrip.participants.length > 0 ? selectedTrip.participants.map(p => p.name).join(', ') : 'Sem participantes'}</p></div>
                            <div className="flex items-center space-x-2 text-violet-200 text-xs print:text-black"><Calendar className="w-3 h-3" /><span>{new Date(selectedTrip.startDate).toLocaleDateString('pt-BR')} - {new Date(selectedTrip.endDate).toLocaleDateString('pt-BR')}</span></div>
                        </div>
                    </div>
                </Card>

                {/* TABS NAVIGATION */}
                <div className="flex p-1 bg-slate-200 rounded-xl overflow-x-auto no-scrollbar no-print">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'OVERVIEW' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Gastos</button>
                    <button onClick={() => setActiveTab('ITINERARY')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ITINERARY' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Roteiro</button>
                    <button onClick={() => setActiveTab('CHECKLIST')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'CHECKLIST' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Checklist</button>
                    <button onClick={() => setActiveTab('STATS')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'STATS' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Relatórios</button>
                    <button onClick={() => setActiveTab('SHOPPING')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'SHOPPING' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Compras</button>
                    <button onClick={() => setActiveTab('EXCHANGE')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'EXCHANGE' ? 'bg-white dark:bg-slate-700 text-violet-800 dark:text-violet-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Câmbio</button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        {/* BUDGET CARD */}
                        <Card className="border-violet-100 dark:border-violet-900">
                            <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2 text-violet-800"><Target className="w-5 h-5" /><h3 className="font-bold">Orçamento da Viagem</h3></div>{!isEditingBudget ? (<button onClick={startEditingBudget} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-colors no-print"><Pencil className="w-4 h-4" /></button>) : (<div className="flex gap-2"><button onClick={() => setIsEditingBudget(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button><button onClick={handleSaveBudget} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full"><Save className="w-4 h-4" /></button></div>)}</div>
                            {isEditingBudget ? (<div className="mb-4"><label className="text-xs font-bold text-slate-600 uppercase">Definir Limite Total</label><input type="number" autoFocus className="w-full text-2xl font-bold text-slate-800 border-b-2 border-violet-200 outline-none py-1 focus:border-violet-500" value={tempBudget} onChange={e => setTempBudget(e.target.value)} placeholder="0,00" /></div>) : (<><div className="mb-3"><div className="flex justify-between text-sm font-medium mb-1"><span className={`${isOverBudget ? 'text-red-700' : 'text-slate-700'}`}>{formatCurrency(totalSpent, selectedTrip.currency)} ({percentUsed.toFixed(0)}%)</span><span className="text-slate-500">Meta: {formatCurrency(budget, selectedTrip.currency)}</span></div><div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${percentUsed > 100 ? 'bg-red-600' : percentUsed > 75 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(percentUsed, 100)}%` }}></div></div></div>{budget > 0 && (<div className={`text-xs font-bold p-2 rounded-lg text-center ${isOverBudget ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{isOverBudget ? `Orçamento excedido em ${formatCurrency(Math.abs(remaining), selectedTrip.currency)}` : `Resta ${formatCurrency(remaining, selectedTrip.currency)} disponível`}</div>)}{budget === 0 && (<div className="text-xs text-center text-slate-500 italic">Defina um orçamento para acompanhar seu progresso.</div>)}</>)}
                        </Card>

                        {/* Transactions List */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">Histórico de Gastos</h3>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {tripTransactions.length === 0 ? <div className="p-8 text-center text-slate-500 dark:text-slate-400"><Sparkles className="w-8 h-8 text-violet-300 dark:text-violet-700 mx-auto mb-2" /><p className="text-sm font-medium">Nenhuma despesa registrada ainda.</p><p className="text-xs text-slate-400 dark:text-slate-500">Comece a aproveitar sua viagem!</p></div> :
                                    tripTransactions.map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-400 font-bold border border-violet-100 dark:border-violet-800">{getCategoryIcon(t.category)({ className: "w-5 h-5" })}</div><div><p className="text-sm font-bold text-slate-900 dark:text-white">{t.description}</p><div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{new Date(t.date).toLocaleDateString('pt-BR')}</span><span>•</span><span>{t.category}</span></div></div></div><span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(t.amount, selectedTrip.currency)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* AI Settlement */}
                        <div className="space-y-4 no-print">
                            <Card className="bg-slate-900 text-white border-none shadow-xl">
                                <div className="flex flex-col items-center text-center space-y-4 p-2"><div className="p-3 bg-white/10 rounded-full"><Sparkles className="w-8 h-8 text-yellow-400" /></div><h3 className="text-xl font-bold">Divisão Inteligente</h3><p className="text-slate-300 text-sm leading-relaxed">Calcular quem deve quanto a quem (Split).</p><div className="w-full space-y-2"><Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl" onClick={handleSettlement} isLoading={loadingAi}><Calculator className="w-4 h-4 mr-2" />Calcular Acerto Pendente</Button>{onNavigateToShared && (<Button variant="secondary" className="w-full bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold rounded-xl border-slate-700" onClick={onNavigateToShared}>Ver Detalhes no Compartilhado<ArrowRight className="w-4 h-4 ml-2" /></Button>)}</div></div>
                            </Card>
                            {aiAnalysis && (<Card title="Resultado do Acerto (Pendentes)" className="border-violet-200 shadow-md bg-violet-50/50"><div className="prose prose-sm prose-violet max-w-none">{aiAnalysis.split('\n').map((line, i) => (<p key={i} className={`text-slate-700 text-sm mb-2 ${line.startsWith('#') ? 'font-bold mt-2 text-violet-900' : ''} ${line.startsWith('-') ? 'ml-4' : ''}`}>{line.replace(/^#+\s/, '').replace(/^-\s/, '• ')}</p>))}</div></Card>)}
                        </div>
                    </div>
                )}

                {/* ... (Other Tabs remain the same but I'll ensure they are rendered correctly) ... */}
                {/* TAB 2: ITINERARY */}
                {activeTab === 'ITINERARY' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <Card title={editingItineraryId ? "Editar Evento" : "Adicionar Evento"} className="no-print dark:bg-slate-800 dark:border-slate-700">
                            <div className="space-y-3"><div className="flex flex-col gap-2"><div className="flex gap-2"><div className="relative flex-1"><div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 flex items-center gap-2 shadow-sm hover:border-violet-400 dark:hover:border-violet-600 transition-all focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 dark:focus-within:ring-violet-900/30 relative h-12 overflow-hidden"><div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none"><Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" /></div><input type="date" className="w-full h-full pl-8 pr-2 bg-transparent text-sm font-bold text-slate-900 dark:text-white border-none outline-none cursor-pointer" value={itiDate} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setItiDate(e.target.value)} /></div></div><input type="time" className="w-24 rounded-xl border border-slate-300 dark:border-slate-600 p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold" value={itiTime} onChange={e => setItiTime(e.target.value)} /></div><select className="w-full rounded-xl border border-slate-300 dark:border-slate-600 p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold" value={itiType} onChange={e => setItiType(e.target.value as any)}><option value="FLIGHT">Voo</option><option value="LODGING">Hospedagem</option><option value="ACTIVITY">Passeio</option><option value="FOOD">Comida</option><option value="OTHER">Outro</option></select></div><div className="flex gap-2"><input className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400" placeholder="Descrição (ex: Voo LATAM, Jantar)" value={itiDesc} onChange={e => setItiDesc(e.target.value)} /><Button onClick={handleSaveItineraryItem} disabled={!itiDate || !itiDesc} size="sm">{editingItineraryId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</Button>{editingItineraryId && (<Button onClick={() => { setEditingItineraryId(null); setItiDesc(''); setItiTime(''); }} size="sm" variant="secondary"><X className="w-4 h-4" /></Button>)}</div></div>
                        </Card>
                        <div className="relative border-l-2 border-violet-100 ml-4 space-y-6">
                            {(!selectedTrip.itinerary || selectedTrip.itinerary.length === 0) && (<div className="pl-6 py-4"><div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-center"><Map className="w-8 h-8 text-violet-300 mx-auto mb-2" /><p className="text-sm font-bold text-violet-900">Roteiro Vazio</p><p className="text-xs text-violet-600">Adicione voos, hotéis e passeios.</p></div></div>)}
                            {selectedTrip.itinerary?.sort((a, b) => (a.date + (a.time || '')) > (b.date + (b.time || '')) ? 1 : -1).map(item => (
                                <div key={item.id} className={`relative pl-6 ${editingItineraryId === item.id ? 'opacity-50' : ''}`}><div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${item.type === 'FLIGHT' ? 'bg-blue-500' : item.type === 'LODGING' ? 'bg-indigo-500' : item.type === 'FOOD' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div><div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-start"><div><div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{new Date(item.date).toLocaleDateString('pt-BR')} {item.time ? `• ${item.time}` : ''}</span><span className={`text-[9px] px-1.5 py-0.5 rounded text-white font-bold ${item.type === 'FLIGHT' ? 'bg-blue-500' : item.type === 'LODGING' ? 'bg-indigo-500' : item.type === 'FOOD' ? 'bg-orange-500' : 'bg-emerald-500'}`}>{item.type}</span></div><p className="font-bold text-slate-800 dark:text-white text-sm">{item.description}</p>{item.location && <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {item.location}</p>}</div><div className="flex gap-1 no-print"><button onClick={() => startEditingItinerary(item)} className="p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteItineraryItem(item.id)} className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></div></div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other tabs content is preserved but abbreviated in thought process, fully rendered in code */}
                {/* TAB 3: CHECKLIST */}
                {activeTab === 'CHECKLIST' && (<div className="space-y-6 animate-in slide-in-from-right-4 duration-300"><div className="flex gap-2 no-print"><input className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-3 shadow-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400" placeholder={editingChecklistId ? "Editar item..." : "Adicionar item (ex: Passaporte, Protetor solar)"} value={checkItem} onChange={e => setCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveChecklistItem()} /><Button onClick={handleSaveChecklistItem}>{editingChecklistId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}</Button>{editingChecklistId && (<Button onClick={() => { setEditingChecklistId(null); setCheckItem(''); }} variant="secondary"><X className="w-5 h-5" /></Button>)}</div><div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">{(!selectedTrip.checklist || selectedTrip.checklist.length === 0) && (<div className="p-8 text-center text-slate-500 dark:text-slate-400"><ListChecks className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" /><p className="text-sm">Sua lista está vazia.</p></div>)}{selectedTrip.checklist?.map(item => (<div key={item.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${editingChecklistId === item.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}><div className="flex items-center gap-3 flex-1"><button onClick={() => toggleChecklistItem(item.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${item.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>{item.isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}</button><span className={`text-sm font-medium ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{item.text}</span></div><div className="flex gap-2 no-print"><button onClick={() => startEditingChecklist(item)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteChecklistItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"><X className="w-4 h-4" /></button></div></div>))}</div></div>)}

                {/* TAB 4: STATS */}
                {activeTab === 'STATS' && (<div className="space-y-6 animate-in slide-in-from-right-4 duration-300"><Card title="Gastos por Categoria">{tripTransactions.length > 0 ? (<div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={Object.entries(tripTransactions.reduce((acc, t) => { if (t.type === TransactionType.EXPENSE) acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as any)).map(([name, value]) => ({ name, value }))} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>{Object.entries(tripTransactions).map((_, index) => (<Cell key={`cell-${index}`} fill={['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][index % 5]} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></div>) : (<div className="h-32 flex items-center justify-center text-slate-500 text-sm">Sem dados suficientes</div>)}</Card><div className="grid grid-cols-2 gap-4"><Card className="bg-violet-50 border-violet-100"><p className="text-xs font-bold text-violet-600 uppercase">Média Diária</p><p className="text-2xl font-bold text-violet-800 mt-1">{formatCurrency(totalSpent / (Math.max(1, (new Date(selectedTrip.endDate).getTime() - new Date(selectedTrip.startDate).getTime()) / (1000 * 3600 * 24))))}</p></Card><Card className="bg-indigo-50 border-indigo-100"><p className="text-xs font-bold text-indigo-600 uppercase">Total Itens</p><p className="text-2xl font-bold text-indigo-800 mt-1">{tripTransactions.length}</p></Card></div></div>)}

                {/* TAB 5: SHOPPING */}
                {activeTab === 'SHOPPING' && (<div className="space-y-6 animate-in slide-in-from-right-4 duration-300"><Card title={editingShoppingId ? "Editar Item" : "Lista de Desejos"}><div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl mb-4 border border-violet-100 dark:border-violet-800 flex justify-between items-center"><span className="text-sm font-bold text-violet-700 dark:text-violet-400">Previsão Total de Gastos</span><span className="text-lg font-black text-violet-900 dark:text-violet-300">{formatCurrency((selectedTrip.shoppingList || []).reduce((acc, item) => acc + (item.estimatedCost || 0), 0), selectedTrip.currency)}</span></div><div className="flex gap-2 mb-4 no-print"><input className="flex-[2] rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400" placeholder="Item (ex: iPhone, Perfume)" value={shopItem} onChange={e => setShopItem(e.target.value)} /><input type="number" className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400" placeholder="Valor Est." value={shopEstCost} onChange={e => setShopEstCost(e.target.value)} /><Button onClick={handleSaveShoppingItem} disabled={!shopItem}>{editingShoppingId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}</Button>{editingShoppingId && (<Button onClick={() => { setEditingShoppingId(null); setShopItem(''); setShopEstCost(''); }} variant="secondary"><X className="w-5 h-5" /></Button>)}</div><div className="space-y-2">{(!selectedTrip.shoppingList || selectedTrip.shoppingList.length === 0) && (<div className="p-8 text-center text-slate-500 dark:text-slate-400"><ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" /><p className="text-sm">Lista vazia.</p></div>)}{selectedTrip.shoppingList?.map(item => (<div key={item.id} className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${editingShoppingId === item.id ? 'ring-2 ring-violet-200 dark:ring-violet-800' : ''}`}><div className="flex items-center gap-3 flex-1"><button onClick={() => toggleShoppingItem(item.id)} className={`w-5 h-5 rounded border flex items-center justify-center ${item.purchased ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'}`}>{item.purchased && <Check className="w-3 h-3 text-white" />}</button><div><p className={`font-bold text-sm ${item.purchased ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>{item.item}</p>{item.estimatedCost ? <p className="text-xs text-slate-500 dark:text-slate-400">Est: {formatCurrency(item.estimatedCost, selectedTrip.currency)}</p> : null}</div></div><div className="flex gap-2 no-print"><button onClick={() => startEditingShopping(item)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteShoppingItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></div>))}</div></Card></div>)}

                {/* TAB 6: EXCHANGE */}
                {activeTab === 'EXCHANGE' && (<div className="space-y-6 animate-in slide-in-from-right-4 duration-300"><Card title={editingExchangeId ? "Editar Câmbio" : "Controle de Câmbio"}><div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl mb-6 border border-violet-100 dark:border-violet-800"><div className="flex justify-between items-center"><div><p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">Média Ponderada</p><h3 className="text-2xl font-black text-violet-900 dark:text-violet-300">{(() => { const entries = selectedTrip.exchangeEntries || []; const totalBRL = entries.reduce((acc, e) => acc + e.amountBRL, 0); const totalForeign = entries.reduce((acc, e) => acc + e.amountForeign, 0); const avg = totalForeign > 0 ? totalBRL / totalForeign : 0; return `R$ ${avg.toFixed(2)}`; })()}</h3></div><div className="text-right"><p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">Total Comprado</p><p className="text-lg font-bold text-violet-800 dark:text-violet-300">{formatCurrency((selectedTrip.exchangeEntries || []).reduce((acc, e) => acc + e.amountForeign, 0), selectedTrip.currency)}</p></div></div></div><div className="flex flex-col gap-3 mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm no-print"><h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">{editingExchangeId ? "Editar Entrada" : "Nova Compra de Moeda"}</h4><div className="flex gap-2"><input type="date" className="w-32 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" value={exchangeDate} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setExchangeDate(e.target.value)} /><input type="number" className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400" placeholder="Valor em R$ (BRL)" value={exchangeBRL} onChange={e => setExchangeBRL(e.target.value)} /><input type="number" className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400" placeholder={`Valor em ${selectedTrip.currency}`} value={exchangeForeign} onChange={e => setExchangeForeign(e.target.value)} /></div><div className="flex gap-2"><Button onClick={handleSaveExchangeEntry} disabled={!exchangeBRL || !exchangeForeign} className="w-full">{editingExchangeId ? <><Save className="w-4 h-4 mr-2" /> Salvar</> : <><Plus className="w-4 h-4 mr-2" /> Registrar Câmbio</>}</Button>{editingExchangeId && (<Button onClick={() => { setEditingExchangeId(null); setExchangeBRL(''); setExchangeForeign(''); }} variant="secondary">Cancelar</Button>)}</div></div><div className="space-y-2">{selectedTrip.exchangeEntries?.map(entry => (<div key={entry.id} className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm ${editingExchangeId === entry.id ? 'ring-2 ring-violet-200 dark:ring-violet-800' : ''}`}><div><p className="font-bold text-slate-800 dark:text-white">{new Date(entry.date).toLocaleDateString('pt-BR')}</p><p className="text-xs text-slate-500 dark:text-slate-400">Taxa: R$ {entry.exchangeRate.toFixed(4)}</p></div><div className="text-right"><p className="font-bold text-emerald-600 dark:text-emerald-400">+ {formatCurrency(entry.amountForeign, entry.currency)}</p><p className="text-xs text-slate-500 dark:text-slate-400">- {formatCurrency(entry.amountBRL, 'BRL')}</p></div><div className="flex gap-2 ml-4 no-print"><button onClick={() => startEditingExchange(entry)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteExchangeEntry(entry.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></div>))}</div></Card></div>)}

            </div>
        );
    }

    // Trips List View
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Minhas Viagens</h2>
                    <p className="text-slate-600 text-sm">Gerencie orçamentos e roteiros.</p>
                </div>
                <Button onClick={() => setIsCreatingTrip(true)} className="rounded-xl shadow-md shadow-emerald-500/20">
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
                    <Button onClick={() => setIsCreatingTrip(true)} variant="secondary">Criar Viagem Agora</Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map(trip => (
                    <div
                        key={trip.id}
                        className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                        onClick={() => {
                            console.log('Clicou na viagem:', trip.id, trip.name);
                            setSelectedTripId(trip.id);
                        }}
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