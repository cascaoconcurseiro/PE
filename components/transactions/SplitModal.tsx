import React from 'react';
import { X, User, Users, ChevronDown, Check, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { FamilyMember, TransactionSplit } from '../../types';

interface SplitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    payerId: string;
    setPayerId: (id: string) => void;
    splits: TransactionSplit[];
    setSplits: (splits: TransactionSplit[]) => void;
    familyMembers: FamilyMember[];
    activeAmount: number;
    onNavigateToFamily?: () => void;
}

export const SplitModal: React.FC<SplitModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    payerId,
    setPayerId,
    splits,
    setSplits,
    familyMembers,
    activeAmount,
    onNavigateToFamily
}) => {
    if (!isOpen) return null;

    const toggleSplitMember = (memberId: string) => {
        const exists = splits.find(s => s.memberId === memberId);
        if (exists) {
            setSplits(splits.filter(s => s.memberId !== memberId));
        } else {
            setSplits([...splits, { memberId, percentage: 50, assignedAmount: activeAmount * 0.5 }]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full sm:max-w-md h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
                    <div><h3 className="font-bold text-slate-800 text-lg">Divisão e Pagamento</h3></div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full border border-slate-200"><X className="w-5 h-5 text-slate-600" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                    {/* 1. QUEM PAGOU? */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Quem pagou?</label>
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-3">
                            <button
                                onClick={() => setPayerId('me')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${payerId === 'me' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Eu Paguei
                            </button>
                            <button
                                onClick={() => setPayerId(familyMembers.length > 0 ? familyMembers[0].id : 'other')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${payerId !== 'me' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Outro Pagou
                            </button>
                        </div>

                        {payerId !== 'me' && (
                            <div className="relative animate-in fade-in slide-in-from-top-1">
                                {familyMembers.length === 0 ? (
                                    <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                                        <p className="text-sm text-amber-800 mb-2">Nenhum membro cadastrado.</p>
                                        {onNavigateToFamily && (
                                            <Button size="sm" onClick={onNavigateToFamily} className="w-full">
                                                Cadastrar Família
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-indigo-500" />
                                        </div>
                                        <select
                                            value={payerId} onChange={e => setPayerId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                        >
                                            {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-indigo-400 pointer-events-none" />
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. QUEM DIVIDE? */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Dividir com quem?</label>
                        {familyMembers.length === 0 ? (
                            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 mb-3">Adicione pessoas para dividir despesas.</p>
                                {onNavigateToFamily && (
                                    <Button size="sm" variant="secondary" onClick={onNavigateToFamily}>
                                        Ir para Família
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {familyMembers.map(member => {
                                    const split = splits.find(s => s.memberId === member.id);
                                    const isSelected = !!split;
                                    return (
                                        <div key={member.id} className={`rounded-2xl border transition-all overflow-hidden ${isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                            <div onClick={() => toggleSplitMember(member.id)} className="p-4 flex items-center justify-between cursor-pointer active:bg-indigo-50">
                                                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{member.name[0]}</div><span className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{member.name}</span></div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. PRESETS DE DIVISÃO RÁPIDA */}
                    {splits.length > 0 && familyMembers.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Divisão Rápida</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: '50/50', myPct: 50 },
                                    { label: '60/40', myPct: 60 },
                                    { label: '70/30', myPct: 70 },
                                    { label: '80/20', myPct: 80 },
                                    { label: 'Só eu', myPct: 100 },
                                    { label: 'Só parceiro', myPct: 0 }
                                ].map(preset => {
                                    const otherPct = 100 - preset.myPct;
                                    const isActive = splits.length > 0 &&
                                        Math.round(splits[0].percentage) === otherPct;

                                    return (
                                        <button
                                            key={preset.label}
                                            onClick={() => {
                                                const newSplits = splits.map(s => ({
                                                    ...s,
                                                    percentage: otherPct,
                                                    assignedAmount: activeAmount * (otherPct / 100)
                                                }));
                                                setSplits(newSplits);
                                            }}
                                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${isActive
                                                    ? 'bg-indigo-600 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                Parceiro paga: <span className="font-bold text-indigo-600">
                                    {splits[0]?.percentage || 50}% = R$ {((activeAmount * (splits[0]?.percentage || 50)) / 100).toFixed(2)}
                                </span>
                            </p>
                        </div>
                    )}

                    <div className="p-4 bg-blue-50 rounded-xl text-xs text-blue-800 leading-relaxed border border-blue-100">
                        <p><strong>Nota:</strong> Se você selecionou que "Outro Pagou", o valor total da transação será registrado como uma dívida sua com essa pessoa, descontando a parte que você dividiu (se houver).</p>
                    </div>

                    <div className="pt-4"><Button onClick={onConfirm} className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg">Confirmar</Button></div>
                </div>
            </div>
        </div>
    );
};