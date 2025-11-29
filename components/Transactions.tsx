import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, TransactionSplit, Frequency, CustomCategory, AccountType } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Check, Plane, Users, Trash2, ChevronDown, Calendar, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCcw, Bell, BellRing, Repeat, Undo2, Download, CreditCard, Layers, AlertCircle, X, Percent, DollarSign, Loader2, ScanLine, Pencil, ArrowRight, TrendingUp, Banknote, PiggyBank, Landmark, AlertTriangle, Clock, User } from 'lucide-react';
import { formatCurrency, getCategoryIcon, isSameMonth, parseDate } from '../utils';
import { useToast } from './ui/Toast';
import { ConfirmModal } from './ui/ConfirmModal';

interface TransactionsProps {
    transactions: Transaction[];
    accounts: Account[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    customCategories: CustomCategory[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAnticipate?: (ids: string[], date: string) => void;
    initialEditId?: string | null;
    onCancel?: () => void;
    modalMode?: boolean;
    currentDate?: Date;
    onClearEditId?: () => void;
    showValues?: boolean;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
}

export const Transactions: React.FC<TransactionsProps> = ({
    transactions,
    accounts,
    trips,
    familyMembers,
    customCategories,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    onAnticipate,
    initialEditId,
    onCancel,
    modalMode = false,
    currentDate: propDate,
    onClearEditId: propOnClearEditId,
    showValues: propShowValues,
    onNavigateToAccounts: propOnNavigateToAccounts,
    onNavigateToTrips: propOnNavigateToTrips,
    onNavigateToFamily: propOnNavigateToFamily,
}) => {
    const currentDate = propDate || new Date();
    const showValues = propShowValues !== undefined ? propShowValues : true;
    const onClearEditId = propOnClearEditId || (() => { });

    const [formMode, setFormMode] = useState<TransactionType | null>(modalMode ? TransactionType.EXPENSE : null);
    
    const [editingId, setEditingId] = useState<string | null>(null);

    const [amountStr, setAmountStr] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<string>(Category.FOOD);

    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [destinationAccountId, setDestinationAccountId] = useState('');
    const [destinationAmountStr, setDestinationAmountStr] = useState('');

    const [tripId, setTripId] = useState('');
    const [isTripSelectorOpen, setIsTripSelectorOpen] = useState(false);
    
    // --- SHARED / PAYER STATE ---
    const [isShared, setIsShared] = useState(false);
    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [payerId, setPayerId] = useState<string>('me');

    // --- REMINDER STATE ---
    const [enableNotification, setEnableNotification] = useState(false);
    const [notificationDate, setNotificationDate] = useState(new Date().toISOString().split('T')[0]);
    const [reminderOption, setReminderOption] = useState<number | 'custom'>(0); 

    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
    const [recurrenceDay, setRecurrenceDay] = useState<number>(new Date().getDate());

    const [isInstallment, setIsInstallment] = useState(false);
    const [currentInstallment, setCurrentInstallment] = useState(1);
    const [totalInstallments, setTotalInstallments] = useState(2);

    const [isRefund, setIsRefund] = useState(false);

    const topRef = useRef<HTMLDivElement>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const activeAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    const selectedAccountObj = accounts.find(a => a.id === accountId);
    const destAccountObj = accounts.find(a => a.id === destinationAccountId);

    const isCreditCard = selectedAccountObj?.type === AccountType.CREDIT_CARD;
    const activeCurrency = selectedAccountObj?.currency || 'BRL';

    const isExpense = formMode === TransactionType.EXPENSE;
    const isIncome = formMode === TransactionType.INCOME;
    const isTransfer = formMode === TransactionType.TRANSFER;
    const CategoryIcon = getCategoryIcon(category);

    useEffect(() => {
        if (modalMode && !editingId) {
            setFormMode(TransactionType.EXPENSE);
            const defaultAcc = accounts.find(a => a.type === AccountType.CHECKING) || accounts[0];
            if (defaultAcc) setAccountId(defaultAcc.id);
        }
    }, [modalMode, accounts, editingId]);

    // Sync Reminder Date
    useEffect(() => {
        if (enableNotification && reminderOption !== 'custom' && date) {
            const txDate = new Date(date);
            txDate.setHours(12, 0, 0, 0); 
            const notifDate = new Date(txDate);
            notifDate.setDate(txDate.getDate() - (reminderOption as number));
            setNotificationDate(notifDate.toISOString().split('T')[0]);
        }
    }, [date, reminderOption, enableNotification]);

    useEffect(() => {
        if (!isRecurring) {
            setRecurrenceDay(new Date(date).getDate());
        }
    }, [date, isRecurring]);

    useEffect(() => {
        if (initialEditId && !editingId && transactions.length > 0) {
            const txToEdit = transactions.find(t => t.id === initialEditId);
            if (txToEdit) {
                handleEditClick(txToEdit);
                if (onClearEditId) onClearEditId();
            }
        }
    }, [initialEditId, transactions]);

    const handleEditClick = (t: Transaction) => {
        setEditingId(t.id);
        setFormMode(t.type);
        setAmountStr(t.amount.toString());
        setDescription(t.description);
        setDate(new Date(t.date).toISOString().split('T')[0]);
        setCategory(t.category);
        setAccountId(t.accountId);
        setDestinationAccountId(t.destinationAccountId || '');
        setDestinationAmountStr(t.destinationAmount ? t.destinationAmount.toString() : '');

        setTripId(t.tripId || '');
        
        // Payer Logic
        setPayerId(t.payerId || 'me');
        setIsShared(!!t.isShared || (!!t.payerId && t.payerId !== 'me'));
        setSplits(t.sharedWith || []);

        setEnableNotification(!!t.enableNotification);
        if (t.enableNotification && t.notificationDate) {
            setNotificationDate(t.notificationDate);
            const dDate = new Date(t.date); dDate.setHours(12,0,0,0);
            const nDate = new Date(t.notificationDate); nDate.setHours(12,0,0,0);
            const diffTime = dDate.getTime() - nDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if ([0, 1, 2, 7].includes(diffDays)) {
                setReminderOption(diffDays);
            } else {
                setReminderOption('custom');
            }
        } else {
            setNotificationDate(new Date(t.date).toISOString().split('T')[0]);
            setReminderOption(0);
        }

        setIsRecurring(!!t.isRecurring);
        setFrequency(t.frequency || Frequency.MONTHLY);
        setRecurrenceDay(t.recurrenceDay || new Date(t.date).getDate());

        setIsInstallment(!!t.isInstallment);
        setCurrentInstallment(t.currentInstallment || 1);
        setTotalInstallments(t.totalInstallments || 2);

        setIsRefund(!!t.isRefund);

        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        resetForm();
    };

    const resetForm = () => {
        setAmountStr('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setSplits([]);
        setIsShared(false);
        setPayerId('me');
        setIsRecurring(false);
        setFrequency(Frequency.MONTHLY);
        setRecurrenceDay(new Date().getDate());
        setIsInstallment(false);
        setCurrentInstallment(1);
        setTotalInstallments(2);
        setTripId('');
        setIsTripSelectorOpen(false);
        
        setEnableNotification(false);
        setNotificationDate(new Date().toISOString().split('T')[0]);
        setReminderOption(0);

        setIsRefund(false);
        setDestinationAccountId('');
        setDestinationAmountStr('');
        setErrors({});
    };

    const toggleSplitMember = (memberId: string) => {
        const exists = splits.find(s => s.memberId === memberId);
        if (exists) {
            setSplits(splits.filter(s => s.memberId !== memberId));
        } else {
            setSplits([...splits, { memberId, percentage: 50, assignedAmount: activeAmount * 0.5 }]);
        }
    };

    const handleConfirmSplit = () => {
        if (splits.length === 0 && payerId === 'me') {
            setIsShared(false);
        } else {
            setIsShared(true);
        }
        setIsSplitModalOpen(false);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: { [key: string]: string } = {};
        if (!activeAmount || activeAmount <= 0) errors.amount = 'Valor inválido';
        if (!description.trim()) errors.description = 'Descrição obrigatória';
        if (!date) errors.date = 'Data obrigatória';
        if (!accountId && payerId === 'me') errors.account = 'Conta obrigatória';
        if (isTransfer) {
            if (!destinationAccountId) errors.destination = 'Conta destino obrigatória';
            if (destinationAccountId === accountId) errors.destination = 'Conta de origem e destino devem ser diferentes';
        }

        if (Object.keys(errors).length > 0) {
            setErrors(errors);
            return;
        }

        let finalDestinationAmount = activeAmount;
        if (isTransfer && destinationAccountId) {
            const destAcc = accounts.find(a => a.id === destinationAccountId);
            const account = accounts.find(a => a.id === accountId);
            if (account && destAcc && account.currency !== destAcc.currency) {
                if (destinationAmountStr) {
                    finalDestinationAmount = parseFloat(destinationAmountStr.replace(',', '.'));
                }
            }
        }

        let updateFuture = false;
        if (editingId) {
            const original = transactions.find(t => t.id === editingId);
            if (original && (original.seriesId || original.isRecurring)) {
                if (confirm(`Esta transação faz parte de uma série/recorrência.\n\nDeseja aplicar as alterações para TODAS as transações futuras desta série?\n\n[OK] = Sim, atualizar futuras também\n[Cancelar] = Não, apenas esta`)) {
                    updateFuture = true;
                }
            }
        }

        const finalSplits = splits
            .filter(s => s.percentage > 0)
            .map(s => ({
                ...s,
                assignedAmount: (activeAmount * s.percentage) / 100
            }));

        const isExternalPayer = payerId && payerId !== 'me';
        const shouldBeShared = formMode === TransactionType.EXPENSE && (isShared || finalSplits.length > 0 || isExternalPayer);

        const transactionData = {
            amount: activeAmount,
            description: description.trim(),
            date,
            type: formMode!,
            category: formMode === TransactionType.TRANSFER ? Category.TRANSFER : category,
            accountId: accountId || (accounts[0] ? accounts[0].id : ''), 
            destinationAccountId: isTransfer ? destinationAccountId : undefined,
            destinationAmount: isTransfer && destinationAccountId ? finalDestinationAmount : undefined,
            tripId: tripId || undefined,

            isShared: shouldBeShared,
            sharedWith: finalSplits,
            payerId: payerId === 'me' ? undefined : payerId,

            isRecurring: isRecurring,
            recurrenceDay: isRecurring ? recurrenceDay : undefined,
            lastGenerated: isRecurring ? date : undefined,
            frequency: isRecurring ? frequency : Frequency.ONE_TIME,

            isInstallment: isInstallment,
            currentInstallment: isInstallment ? currentInstallment : undefined,
            totalInstallments: isInstallment ? totalInstallments : undefined,

            enableNotification: enableNotification,
            notificationDate: enableNotification ? notificationDate : undefined,
            isRefund: isRefund
        };

        if (editingId && onUpdateTransaction) {
            onUpdateTransaction({ ...transactionData, id: editingId });
            if (updateFuture) {
                const original = transactions.find(t => t.id === editingId);
                if (original) {
                    const futureTxs = transactions.filter(t =>
                        (t.seriesId === original.seriesId || (t.isRecurring && t.description === original.description)) &&
                        t.id !== editingId &&
                        new Date(t.date) > new Date(original.date)
                    );
                    futureTxs.forEach(ft => {
                        onUpdateTransaction({
                            ...ft,
                            amount: transactionData.amount,
                            description: transactionData.description,
                            category: transactionData.category,
                            accountId: transactionData.accountId,
                        });
                    });
                }
            }
        } else {
            onAddTransaction(transactionData);
        }

        handleCancelEdit();
        if (onCancel) onCancel();
    };

    if (formMode) {
        const mainColor = isRefund ? 'text-amber-800' : isExpense ? 'text-red-700' : isIncome ? 'text-emerald-700' : 'text-blue-700';
        const mainBg = isRefund ? 'bg-amber-600' : isExpense ? 'bg-red-600' : isIncome ? 'bg-emerald-600' : 'bg-blue-600';
        const secondaryBg = isRefund ? 'bg-amber-50' : isExpense ? 'bg-red-50' : isIncome ? 'bg-emerald-50' : 'bg-blue-50';

        return (
            <div className="flex flex-col h-full bg-white relative">
                <div ref={topRef} />
                <div className="px-3 py-2 shrink-0 border-b border-slate-100 flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl relative shadow-inner flex-1">
                        <button onClick={() => setFormMode(TransactionType.EXPENSE)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isExpense ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><ArrowDownLeft className="w-3.5 h-3.5" /> Despesa</button>
                        <button onClick={() => setFormMode(TransactionType.INCOME)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isIncome ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}><ArrowUpRight className="w-3.5 h-3.5" /> Receita</button>
                        <button onClick={() => setFormMode(TransactionType.TRANSFER)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isTransfer ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}><RefreshCcw className="w-3.5 h-3.5" /> Transf.</button>
                    </div>
                    {editingId && (
                        <div className="shrink-0">
                            <button onClick={handleCancelEdit} className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all" title="Cancelar Edição"><X className="w-5 h-5" /></button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
                    {editingId && (
                        <div className="px-5 pt-4 animate-in slide-in-from-top-2">
                            <div className="bg-amber-50 text-amber-800 p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-amber-100">
                                <Pencil className="w-3 h-3" /> Editando Transação
                            </div>
                        </div>
                    )}

                    <div className={`flex flex-col items-center justify-center py-6 ${secondaryBg} border-b border-slate-100/50 transition-colors duration-300 shrink-0`}>
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                            {isRefund ? <Undo2 className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />} {isRefund ? 'Valor do Estorno' : 'Valor da Transação'}
                        </label>
                        <div className="relative flex items-center justify-center w-full px-4">
                            <span className={`text-3xl font-bold mr-1.5 opacity-70 ${mainColor}`}>{activeCurrency === 'USD' ? '$' : activeCurrency === 'EUR' ? '€' : 'R$'}</span>
                            <input type="number" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0,00" className={`w-full max-w-[240px] text-center text-5xl font-black bg-transparent border-none outline-none placeholder-slate-400 ${mainColor}`} autoFocus={!editingId} />
                        </div>
                        {errors.amount && <p className="text-red-700 text-xs font-bold mt-2 bg-red-100 px-3 py-1 rounded-full border border-red-200">{errors.amount}</p>}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Descrição</label>
                                <input placeholder="Ex: Almoço, Uber, Salário" value={description} onChange={e => { setDescription(e.target.value); }} className="w-full text-lg font-bold text-slate-900 border-b-2 border-slate-100 pb-2 outline-none focus:border-indigo-500 bg-transparent placeholder:text-slate-300 transition-colors" />
                                {errors.description && <p className="text-red-700 text-[10px] mt-0.5 pl-1 font-bold">{errors.description}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Data</label>
                                    <div className="bg-slate-50 rounded-xl h-12 flex items-center px-3 border border-slate-200 relative group cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-bold text-slate-700 text-sm outline-none w-full" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Categoria</label>
                                    {!isTransfer ? (
                                        <div className="bg-slate-50 rounded-xl h-12 flex items-center px-3 border border-slate-200 relative group cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                                            <CategoryIcon className="w-4 h-4 text-slate-400 mr-2" />
                                            <select value={category} onChange={e => setCategory(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer">
                                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <span className="pointer-events-none truncate text-sm font-bold text-slate-700 flex-1">{category}</span>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl h-12 flex items-center justify-center border border-slate-200"><span className="text-xs font-bold text-slate-400">Automático</span></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- ACCOUNT SELECTION --- */}
                        <div className="grid grid-cols-1 gap-3">
                            {payerId === 'me' ? (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block pl-1">{isTransfer ? 'Sai de (Origem)' : (isExpense ? 'Pagar com' : 'Receber em')}</label>
                                    <div className={`relative rounded-xl p-3 flex items-center gap-3 shadow-md transition-all active:scale-[0.99] cursor-pointer overflow-hidden group ${!selectedAccountObj ? 'bg-white border border-slate-200' : selectedAccountObj.type === AccountType.CREDIT_CARD ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${selectedAccountObj ? 'bg-white/20 backdrop-blur-sm' : 'bg-slate-100 text-slate-500'}`}><Wallet className="w-5 h-5" /></div>
                                        <div className="flex-1 overflow-hidden z-10"><span className={`block text-sm font-bold truncate mb-0.5 ${selectedAccountObj ? 'text-white' : 'text-slate-900'}`}>{selectedAccountObj?.name || 'Selecione uma conta'}</span></div>
                                        <ChevronDown className={`w-5 h-5 shrink-0 z-10 ${selectedAccountObj ? 'text-white/70' : 'text-slate-400'}`} />
                                        <select value={accountId} onChange={e => setAccountId(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer">{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block pl-1">Status do Pagamento</label>
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700"><User className="w-5 h-5" /></div>
                                            <div>
                                                <span className="block text-sm font-bold text-indigo-900">Pago por {familyMembers.find(m => m.id === payerId)?.name || 'Outro'}</span>
                                                <span className="text-xs text-indigo-600">Você deve este valor</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => setIsSplitModalOpen(true)} className="text-xs h-8">Alterar</Button>
                                    </div>
                                </div>
                            )}

                            {isTransfer && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block pl-1">Vai para (Destino)</label>
                                    <div className={`relative rounded-xl p-3 flex items-center gap-3 shadow-md transition-all active:scale-[0.99] cursor-pointer overflow-hidden group ${!destAccountObj ? 'bg-white border border-slate-200' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${destAccountObj ? 'bg-white/20 backdrop-blur-sm' : 'bg-slate-100 text-slate-500'}`}><Wallet className="w-5 h-5" /></div>
                                        <div className="flex-1 overflow-hidden z-10"><span className={`block text-sm font-bold truncate mb-0.5 ${destAccountObj ? 'text-white' : 'text-slate-900'}`}>{destAccountObj?.name || 'Selecione o destino'}</span></div>
                                        <ChevronDown className={`w-5 h-5 shrink-0 z-10 ${destAccountObj ? 'text-white/70' : 'text-slate-400'}`} />
                                        <select value={destinationAccountId} onChange={e => setDestinationAccountId(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer">{accounts.filter(a => a.id !== accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isExpense && trips.length > 0 && (
                            <div className="relative z-20">
                                <div 
                                    onClick={() => setIsTripSelectorOpen(!isTripSelectorOpen)}
                                    className={`border rounded-2xl p-4 flex items-center gap-3 shadow-sm relative transition-all cursor-pointer ${tripId ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tripId ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Plane className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-lg font-bold truncate mb-0.5 ${tripId ? 'text-violet-900' : 'text-slate-600'}`}>
                                            {tripId ? trips.find(t => t.id === tripId)?.name : 'Vincular a uma Viagem'}
                                        </span>
                                        <span className="text-sm text-slate-500 font-medium truncate block">Opcional</span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 ${isTripSelectorOpen ? 'rotate-180' : ''} transition-transform text-slate-400`} />
                                </div>

                                {isTripSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsTripSelectorOpen(false)} />
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
                                            <div 
                                                onClick={() => { setTripId(''); setIsTripSelectorOpen(false); }}
                                                className="p-3 hover:bg-slate-50 cursor-pointer text-slate-600 font-medium text-sm border-b border-slate-50"
                                            >
                                                Nenhuma
                                            </div>
                                            {trips.map(t => (
                                                <div 
                                                    key={t.id}
                                                    onClick={() => { setTripId(t.id); setIsTripSelectorOpen(false); }}
                                                    className={`p-3 hover:bg-violet-50 cursor-pointer flex items-center gap-3 ${tripId === t.id ? 'bg-violet-50' : ''}`}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">
                                                        <Plane className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-slate-800 font-bold text-sm">{t.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block pl-1">Opções Adicionais</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${isRecurring ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Repeat className="w-5 h-5" /><span className="text-[10px] font-bold">Repetir</span></button>
                                {isExpense && <button type="button" onClick={() => setIsInstallment(!isInstallment)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${isInstallment ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><CreditCard className="w-5 h-5" /><span className="text-[10px] font-bold">Parcelar</span></button>}
                                <button type="button" onClick={() => setEnableNotification(!enableNotification)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${enableNotification ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Bell className="w-5 h-5" /><span className="text-[10px] font-bold">Lembrar</span></button>
                                {isExpense && <button type="button" onClick={() => setIsSplitModalOpen(true)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${splits.length > 0 || payerId !== 'me' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Users className="w-5 h-5" /><span className="text-[10px] font-bold">Dividir</span></button>}
                            </div>
                        </div>

                        {enableNotification && (
                            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 animate-in slide-in-from-top-2 space-y-3">
                                <div className="flex items-center gap-2 mb-2 text-amber-800">
                                    <BellRing className="w-5 h-5" />
                                    <span className="font-bold text-sm">Configurar Lembrete</span>
                                </div>
                                <div className="space-y-3">
                                    <select
                                        value={reminderOption}
                                        onChange={(e) => {
                                            const val = e.target.value === 'custom' ? 'custom' : parseInt(e.target.value);
                                            setReminderOption(val);
                                        }}
                                        className="w-full bg-white border border-amber-200 text-amber-900 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-amber-400"
                                    >
                                        <option value={0}>No dia do vencimento</option>
                                        <option value={1}>1 dia antes</option>
                                        <option value={2}>2 dias antes</option>
                                        <option value={7}>1 semana antes</option>
                                        <option value="custom">Data Personalizada</option>
                                    </select>
                                    {reminderOption === 'custom' && (
                                        <div className="bg-white border border-amber-200 rounded-xl p-2">
                                            <input type="date" value={notificationDate} onChange={e => setNotificationDate(e.target.value)} className="w-full p-2 text-sm font-bold text-slate-700 outline-none" />
                                        </div>
                                    )}
                                    {reminderOption !== 'custom' && (
                                        <div className="flex items-center gap-2 text-xs text-amber-700 font-medium px-1">
                                            <Clock className="w-3 h-3" />
                                            <span>Lembrete: <strong>{new Date(notificationDate).toLocaleDateString('pt-BR')}</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {isRecurring && (
                            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 animate-in slide-in-from-top-2 space-y-4">
                                <div className="flex gap-3">
                                    <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="flex-1 bg-white border border-blue-200 text-blue-900 text-base rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-blue-400">
                                        <option value={Frequency.WEEKLY}>Semanalmente</option>
                                        <option value={Frequency.MONTHLY}>Mensalmente</option>
                                        <option value={Frequency.YEARLY}>Anualmente</option>
                                    </select>
                                </div>
                                {frequency === Frequency.MONTHLY && (
                                    <div className="flex items-center gap-4 bg-white border border-blue-200 rounded-xl p-4"><Calendar className="w-6 h-6 text-blue-600" /><label className="text-base font-bold text-blue-900 flex-1">Dia do mês:</label><input type="number" min="1" max="31" value={recurrenceDay} onChange={e => setRecurrenceDay(parseInt(e.target.value))} className="w-20 text-center bg-blue-50 rounded-lg p-2 text-blue-900 font-bold outline-none text-lg" /></div>
                                )}
                            </div>
                        )}

                        {isInstallment && (
                            <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100 animate-in slide-in-from-top-2 space-y-5">
                                <div className="grid grid-cols-4 gap-3">
                                    {[2, 3, 4, 5, 6, 10, 12].map(num => (<button key={num} type="button" onClick={() => setTotalInstallments(num)} className={`py-4 rounded-xl text-base font-bold border ${totalInstallments === num ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'}`}>{num}x</button>))}
                                    <div className="relative"><input type="number" placeholder="Outro" value={totalInstallments || ''} onChange={e => setTotalInstallments(parseInt(e.target.value))} className="w-full h-full rounded-xl text-center font-bold border border-purple-200 text-purple-900 outline-none focus:ring-2 focus:ring-purple-400 bg-white" /></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 fixed bottom-0 left-0 right-0 md:relative md:border-none md:bg-transparent z-20">
                        <Button onClick={handleSubmit} className={`w-full h-14 text-lg shadow-xl shadow-slate-200 ${mainBg} hover:opacity-90 transition-opacity`}>
                            {editingId ? 'Salvar Alterações' : 'Confirmar Transação'}
                        </Button>
                    </div>
                </div>

                {isSplitModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleConfirmSplit}></div>
                        <div className="bg-white w-full sm:max-w-md h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
                                <div><h3 className="font-bold text-slate-800 text-lg">Divisão e Pagamento</h3></div>
                                <button onClick={handleConfirmSplit} className="p-2 bg-white rounded-full border border-slate-200"><X className="w-5 h-5 text-slate-600" /></button>
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
                                        </div>
                                    )}
                                </div>

                                {/* 2. QUEM DIVIDE? */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Dividir com quem?</label>
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
                                </div>

                                <div className="p-4 bg-blue-50 rounded-xl text-xs text-blue-800 leading-relaxed border border-blue-100">
                                    <p><strong>Nota:</strong> Se você selecionou que "Outro Pagou", o valor total da transação será registrado como uma dívida sua com essa pessoa, descontando a parte que você dividiu (se houver).</p>
                                </div>

                                <div className="pt-4"><Button onClick={handleConfirmSplit} className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg">Confirmar</Button></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};