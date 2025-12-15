
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory, Frequency, AccountType } from '../../types';
import { formatCurrency, getCategoryIcon, parseDate } from '../../utils';
import { Calendar, Check, ChevronDown, DollarSign, X, RefreshCcw, BellRing, Undo2, Plane, AlertTriangle, Pencil, CreditCard, Wallet, ArrowRight, User, Plus, ArrowDownLeft, ArrowUpRight, Globe, Repeat, Bell, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { AccountSelector } from './AccountSelector';
import { useTransactionForm } from '../../hooks/useTransactionForm';
import { SplitModal } from './SplitModal';

interface TransactionFormProps {
    initialData?: Transaction | null;
    formMode: TransactionType;
    setFormMode: (mode: TransactionType | null) => void;
    accounts: Account[];
    transactions?: Transaction[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    customCategories: CustomCategory[];
    onSave: (data: any, isEdit: boolean, updateFuture: boolean) => void;
    onCancel: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
    currentUserName?: string;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
    initialData,
    formMode,
    setFormMode,
    accounts,
    transactions = [],
    trips = [],
    familyMembers = [],
    customCategories,
    onSave,
    onCancel,
    onNavigateToAccounts,
    onNavigateToTrips,
    onNavigateToFamily,
    currentUserName
}) => {
    const topRef = useRef<HTMLDivElement>(null);

    const {
        amountStr, setAmountStr,
        destinationAmountStr, setDestinationAmountStr,
        manualExchangeRate, setManualExchangeRate,
        description, setDescription,
        date, setDate,
        category, setCategory,
        accountId, setAccountId,
        destinationAccountId, setDestinationAccountId,
        tripId, setTripId,
        isTripSelectorOpen, setIsTripSelectorOpen,
        splits, setSplits,
        isSplitModalOpen, setIsSplitModalOpen,
        payerId, setPayerId,
        isRecurring, setIsRecurring,
        frequency, setFrequency,
        recurrenceDay, setRecurrenceDay,
        isInstallment, setIsInstallment,
        currentInstallment, setCurrentInstallment,
        totalInstallments, setTotalInstallments,
        enableNotification, setEnableNotification,
        notificationDate, setNotificationDate,
        reminderOption, setReminderOption,
        isRefund,
        errors,
        activeAmount,
        activeCurrency,
        availableAccounts,
        isMultiCurrencyTransfer,
        selectedAccountObj,
        selectedDestAccountObj,
        isCreditCard,
        isExpense,
        isIncome,
        isTransfer,
        handleConfirmSplit,
        handleSubmit,
        duplicateWarning,
        isSubmitting
    } = useTransactionForm({
        initialData,
        formMode,
        accounts,
        transactions,
        trips,
        onSave
    });

    useEffect(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [formMode]);

    const CategoryIcon = getCategoryIcon(category);
    const mainColor = isRefund ? 'text-amber-600 dark:text-amber-400' : isExpense ? 'text-red-600 dark:text-red-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';
    const headerBg = isRefund ? 'bg-amber-50 dark:bg-amber-950/30' : isExpense ? 'bg-red-50 dark:bg-red-950/30' : isIncome ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30';
    const buttonMainBg = isRefund ? 'bg-amber-600 hover:bg-amber-700' : isExpense ? 'bg-red-600 hover:bg-red-700' : isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700';

    const selectedTrip = trips.find(t => t.id === tripId);

    // STRICT CURRENCY MATCH: Trip expenses can ONLY use accounts with the SAME currency
    const filteredAccountsForTrip = React.useMemo(() => {
        if (!selectedTrip) {
            return availableAccounts; // No trip = all accounts available
        }
        // Only show accounts that match the trip's currency
        return availableAccounts.filter(acc => acc.currency === selectedTrip.currency);
    }, [availableAccounts, selectedTrip]);

    // NEW: Strict Transfer Logic
    const [isConversion, setIsConversion] = React.useState(false);

    // Reset conversion toggle if account changes
    useEffect(() => {
        setIsConversion(false);
    }, [accountId]);

    const filteredDestinationAccounts = React.useMemo(() => {
        if (!isTransfer || !selectedAccountObj) return [];

        return accounts.filter(acc => {
            // Cannot transfer to itself
            if (acc.id === accountId) return false;
            // NEVER transfer TO credit card
            if (acc.type === AccountType.CREDIT_CARD || (acc.type as string) === 'CREDIT_CARD') return false;

            // Conversion Logic
            // Conversion Logic
            const isSourceInternational = selectedAccountObj.isInternational || selectedAccountObj.currency !== 'BRL';

            if (isSourceInternational) {
                // Sender is International (or Foreign Currency)
                if (isConversion) {
                    // Câmbio: sending from USD to BRL -> Show BRL accounts
                    return !acc.isInternational && acc.currency === 'BRL';
                } else {
                    // Transfer: sending from USD to USD (or other Int) -> Show International accounts
                    // Allow ANY International account (flagged OR foreign currency)
                    return acc.isInternational || acc.currency !== 'BRL';
                }
            } else {
                // Sender is BRL
                if (isConversion) {
                    // Câmbio: sending from BRL to USD -> Show International accounts
                    return acc.isInternational || acc.currency !== 'BRL';
                } else {
                    // Transfer: sending from BRL to BRL -> Show BRL accounts
                    return !acc.isInternational && acc.currency === 'BRL';
                }
            }
        });
    }, [accounts, accountId, selectedAccountObj, isTransfer, isConversion]);

    // Reset dest account if filtered out
    useEffect(() => {
        if (destinationAccountId && filteredDestinationAccounts.length > 0) {
            const exists = filteredDestinationAccounts.find(a => a.id === destinationAccountId);
            if (!exists) setDestinationAccountId('');
        }
    }, [filteredDestinationAccounts, destinationAccountId]);

    if (accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhuma conta encontrada</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Crie uma conta para começar a registrar transações</p>
                {onNavigateToAccounts && (
                    <button
                        onClick={onNavigateToAccounts}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors mb-3"
                    >
                        <Plus className="w-5 h-5" />
                        Criar Conta
                    </button>
                )}
                <Button variant="secondary" onClick={onCancel}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-h-[100dvh] bg-white dark:bg-slate-900 relative overflow-hidden">
            <div ref={topRef} />

            {/* Header Tabs */}
            <div className="sticky top-0 px-2 py-1 shrink-0 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5 bg-white dark:bg-slate-900 z-30">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg relative shadow-inner flex-1 gap-1">
                    <button onClick={() => setFormMode(TransactionType.EXPENSE)} className={`flex - 1 flex items - center justify - center gap - 1.5 py - 2 rounded - md transition - all ${isExpense ? 'bg-white dark:bg-red-500/10 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-slate-200 dark:ring-red-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span className="text-xs">Despesa</span>
                    </button>
                    <button onClick={() => setFormMode(TransactionType.INCOME)} className={`flex - 1 flex items - center justify - center gap - 1.5 py - 2 rounded - md transition - all ${isIncome ? 'bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-emerald-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span className="text-xs">Receita</span>
                    </button>
                    <button onClick={() => setFormMode(TransactionType.TRANSFER)} className={`flex - 1 flex items - center justify - center gap - 1.5 py - 2 rounded - md transition - all ${isTransfer ? 'bg-white dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-blue-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
                        <RefreshCcw className="w-3.5 h-3.5" />
                        <span className="text-xs">Transf.</span>
                    </button>
                </div>
                <div className="shrink-0">
                    <button onClick={onCancel} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
                {initialData && (
                    <div className="px-3 sm:px-5 pt-2 sm:pt-3 animate-in slide-in-from-top-2">
                        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 border border-amber-100 dark:border-amber-800">
                            <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Editando
                        </div>
                    </div>
                )}

                {/* ✅ BLINKING DUPLICATE ALERT */}
                {duplicateWarning && (
                    <div className="px-3 sm:px-5 pt-2 sm:pt-3 animate-pulse">
                        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-xl text-xs font-bold flex items-center gap-3 border-2 border-red-500 dark:border-red-500 shadow-lg">
                            <BellRing className="w-5 h-5 text-red-600 dark:text-red-400 animate-bounce" />
                            <div className="flex-1">
                                <p className="uppercase tracking-wider text-[10px] text-red-600 dark:text-red-400 mb-0.5">Atenção!</p>
                                <p>Possível transação duplicada detectada.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Amount Input */}
                <div className={`flex flex - col items - center justify - center py - 2 sm: py - 3 ${headerBg} transition - colors duration - 300 shrink - 0`}>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        {isRefund ? <Undo2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span className="hidden xs:inline">{isRefund ? 'Valor do Estorno' : 'Valor'}</span>
                    </label>

                    <div className="relative flex items-center justify-center w-full px-2 sm:px-4">
                        <span className={`text - 2xl sm: text - 3xl md: text - 4xl font - bold mr - 1 sm: mr - 2 opacity - 80 ${mainColor} `}>
                            {activeCurrency === 'BRL' ? 'R$' : activeCurrency}
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="0,00"
                            className={`w - full max - w - [180px] sm: max - w - [240px] text - center text - 2xl sm: text - 3xl md: text - 4xl font - black bg - transparent border - none outline - none placeholder - slate - 300 dark: placeholder - slate - 700 ${mainColor} `}
                            autoFocus={!initialData}
                        />
                    </div>
                    {errors.amount && <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-1 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">{errors.amount}</p>}

                    {selectedTrip && !isTransfer && (
                        <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg">
                            <Plane className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            Moeda: <strong>{selectedTrip.currency}</strong>
                        </div>
                    )}


                </div>

                <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {/* Description & Date */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Descrição</label>
                            <input placeholder="Ex: Almoço, Uber, Salário" value={description} onChange={e => setDescription(e.target.value)} className="w-full text-base font-medium text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1 outline-none focus:border-indigo-500 bg-transparent placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors rounded-none px-0" />
                            {errors.description && <p className="text-red-600 text-[10px] mt-1 font-bold">{errors.description}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Data</label>
                                <div className={`bg - slate - 50 dark: bg - slate - 800 rounded - xl h - 10 flex items - center px - 3 border ${selectedTrip && (date < (selectedTrip.startDate || '') || date > (selectedTrip.endDate || '')) ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700'} relative`}>
                                    <Calendar className={`w - 4 h - 4 mr - 2 ${selectedTrip && (date < (selectedTrip.startDate || '') || date > (selectedTrip.endDate || '')) ? 'text-amber-500' : 'text-slate-400'} `} />
                                    <input type="date" value={date} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setDate(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-sm outline-none w-full h-full" />
                                </div>
                                {selectedTrip && (date < (selectedTrip.startDate || '') || date > (selectedTrip.endDate || '')) && (
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 leading-tight">
                                        ⚠️ Fora período: {parseDate(selectedTrip.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {parseDate(selectedTrip.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Categoria</label>
                                {!isTransfer ? (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-10 flex items-center px-3 border border-slate-200 dark:border-slate-700 relative">
                                        <CategoryIcon className="w-4 h-4 text-slate-400 mr-2" />
                                        <select value={category} onChange={e => setCategory(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer text-slate-900">
                                            {isIncome ? (
                                                <>
                                                    <optgroup label="💰 Entradas">
                                                        <option value={Category.INCOME}>{Category.INCOME}</option>
                                                        <option value={Category.FREELANCE}>{Category.FREELANCE}</option>
                                                        <option value={Category.BUSINESS}>{Category.BUSINESS}</option>
                                                        <option value={Category.SALES}>{Category.SALES}</option>
                                                    </optgroup>
                                                    <optgroup label="📈 Rendimentos">
                                                        <option value={Category.DIVIDENDS}>{Category.DIVIDENDS}</option>
                                                        <option value={Category.INVESTMENT}>{Category.INVESTMENT}</option>
                                                    </optgroup>
                                                    <optgroup label="↩️ Outros">
                                                        <option value={Category.REFUND}>{Category.REFUND}</option>
                                                        <option value={Category.GIFT_RECEIVED}>{Category.GIFT_RECEIVED}</option>
                                                        <option value={Category.OTHER}>{Category.OTHER}</option>
                                                    </optgroup>
                                                </>
                                            ) : (
                                                <>
                                                    <optgroup label="🏠 Moradia">
                                                        <option value={Category.HOUSING}>{Category.HOUSING}</option>
                                                        <option value={Category.RENT}>{Category.RENT}</option>
                                                        <option value={Category.MAINTENANCE}>{Category.MAINTENANCE}</option>
                                                        <option value={Category.FURNITURE}>{Category.FURNITURE}</option>
                                                        <option value={Category.UTILITIES}>{Category.UTILITIES}</option>
                                                    </optgroup>
                                                    <optgroup label="🍽️ Alimentação">
                                                        <option value={Category.FOOD}>{Category.FOOD}</option>
                                                        <option value={Category.RESTAURANTS}>{Category.RESTAURANTS}</option>
                                                        <option value={Category.GROCERY}>{Category.GROCERY}</option>
                                                        <option value={Category.SNACKS}>{Category.SNACKS}</option>
                                                    </optgroup>
                                                    <optgroup label="🚗 Transporte">
                                                        <option value={Category.TRANSPORTATION}>{Category.TRANSPORTATION}</option>
                                                        <option value={Category.UBER}>{Category.UBER}</option>
                                                        <option value={Category.FUEL}>{Category.FUEL}</option>
                                                        <option value={Category.PUBLIC_TRANSPORT}>{Category.PUBLIC_TRANSPORT}</option>
                                                        <option value={Category.VEHICLE_MAINTENANCE}>{Category.VEHICLE_MAINTENANCE}</option>
                                                        <option value={Category.PARKING}>{Category.PARKING}</option>
                                                    </optgroup>
                                                    <optgroup label="🏥 Saúde">
                                                        <option value={Category.HEALTH}>{Category.HEALTH}</option>
                                                        <option value={Category.PHARMACY}>{Category.PHARMACY}</option>
                                                        <option value={Category.DOCTOR}>{Category.DOCTOR}</option>
                                                        <option value={Category.EXAMS}>{Category.EXAMS}</option>
                                                        <option value={Category.GYM}>{Category.GYM}</option>
                                                    </optgroup>
                                                    <optgroup label="🎬 Lazer">
                                                        <option value={Category.LEISURE}>{Category.LEISURE}</option>
                                                        <option value={Category.ENTERTAINMENT}>{Category.ENTERTAINMENT}</option>
                                                        <option value={Category.STREAMING}>{Category.STREAMING}</option>
                                                        <option value={Category.TRAVEL}>{Category.TRAVEL}</option>
                                                        <option value={Category.HOBBIES}>{Category.HOBBIES}</option>
                                                    </optgroup>
                                                    <optgroup label="🛍️ Compras">
                                                        <option value={Category.SHOPPING}>{Category.SHOPPING}</option>
                                                        <option value={Category.CLOTHING}>{Category.CLOTHING}</option>
                                                        <option value={Category.ELECTRONICS}>{Category.ELECTRONICS}</option>
                                                        <option value={Category.BEAUTY}>{Category.BEAUTY}</option>
                                                        <option value={Category.HOME_SHOPPING}>{Category.HOME_SHOPPING}</option>
                                                    </optgroup>
                                                    <optgroup label="🎓 Educação">
                                                        <option value={Category.EDUCATION}>{Category.EDUCATION}</option>
                                                        <option value={Category.COURSES}>{Category.COURSES}</option>
                                                        <option value={Category.BOOKS}>{Category.BOOKS}</option>
                                                    </optgroup>
                                                    <optgroup label="👤 Pessoal">
                                                        <option value={Category.PERSONAL}>{Category.PERSONAL}</option>
                                                        <option value={Category.PERSONAL_CARE}>{Category.PERSONAL_CARE}</option>
                                                        <option value={Category.PETS}>{Category.PETS}</option>
                                                        <option value={Category.GIFTS}>{Category.GIFTS}</option>
                                                        <option value={Category.DONATION}>{Category.DONATION}</option>
                                                    </optgroup>
                                                    <optgroup label="💰 Financeiro">
                                                        <option value={Category.FINANCIAL}>{Category.FINANCIAL}</option>
                                                        <option value={Category.INVESTMENT}>{Category.INVESTMENT}</option>
                                                        <option value={Category.INSURANCE}>{Category.INSURANCE}</option>
                                                        <option value={Category.TAXES}>{Category.TAXES}</option>
                                                        <option value={Category.FEES}>{Category.FEES}</option>
                                                        <option value={Category.LOANS}>{Category.LOANS}</option>
                                                    </optgroup>
                                                    <optgroup label="📦 Outros">
                                                        <option value={Category.OTHER}>{Category.OTHER}</option>
                                                    </optgroup>
                                                </>
                                            )}
                                            {customCategories.length > 0 && (
                                                <optgroup label="⭐ Personalizadas">
                                                    {customCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </optgroup>
                                            )}
                                        </select>
                                        <span className="pointer-events-none truncate text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">{category}</span>
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-10 flex items-center justify-center border border-slate-200 dark:border-slate-700"><span className="text-xs font-bold text-slate-400">Automático</span></div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Trip Selection (Expense Only) */}
                    {isExpense && (
                        <div className="space-y-1">
                            <div className="relative z-20">
                                <div onClick={() => setIsTripSelectorOpen(!isTripSelectorOpen)} className={`border rounded - xl p - 3 flex items - center gap - 3 shadow - sm relative transition - all cursor - pointer ${tripId ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} `}>
                                    <div className={`w - 9 h - 9 rounded - full flex items - center justify - center shrink - 0 ${tripId ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} `}><Plane className="w-4 h-4" /></div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text - sm font - bold truncate mb - 0.5 ${tripId ? 'text-violet-900 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300'} `}>{tripId ? trips.find(t => t.id === tripId)?.name : 'Vincular a uma Viagem'}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block">{tripId ? `Moeda: ${selectedTrip?.currency} ` : 'Opcional'}</span>
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                </div>
                                {isTripSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsTripSelectorOpen(false)} />
                                        <div className="absolute inset-x-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                            <div onClick={() => { setTripId(''); setIsTripSelectorOpen(false); }} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-sm border-b border-slate-50 dark:border-slate-700">Nenhuma</div>
                                            {trips.length === 0 ? (
                                                <div className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                                            <Plane className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nenhuma viagem cadastrada</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Crie uma viagem para vincular despesas</p>
                                                        </div>
                                                        {onNavigateToTrips && (
                                                            <button
                                                                onClick={() => {
                                                                    setIsTripSelectorOpen(false);
                                                                    onNavigateToTrips();
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold transition-colors"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                                Criar Viagem
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                trips.map(t => (
                                                    <div key={t.id} onClick={() => { setTripId(t.id); setIsTripSelectorOpen(false); }} className="p-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-xs"><Plane className="w-4 h-4" /></div>
                                                        <div><span className="text-slate-800 dark:text-slate-200 font-bold text-sm block">{t.name}</span><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{t.currency}</span></div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Account Selection */}
                    <div className="grid grid-cols-1 gap-3">
                        {payerId === 'me' ? (
                            <AccountSelector
                                label={isTransfer ? 'Sai de (Origem)' : (isExpense ? 'Pagar com' : 'Receber em')}
                                accounts={React.useMemo(() => {
                                    // 1. Base Filter: Available Accounts (already filtered by user access)
                                    let accs = availableAccounts;

                                    // 2. Strict Currency Match (CRITICAL USER REQUIREMENT)
                                    // If handling Foreign Currency (e.g. USD), ONLY show accounts of that currency.
                                    // If handling BRL, ONLY show BRL accounts.
                                    if (activeCurrency === 'BRL') {
                                        accs = accs.filter(a => !a.currency || a.currency === 'BRL');
                                    } else {
                                        accs = accs.filter(a => a.currency === activeCurrency);
                                    }

                                    // 3. Trip Filter (Legacy/Optional - ensure we don't relax the strictness)
                                    if (selectedTrip) {
                                        // Trip currency usually dictates activeCurrency, but double check
                                        accs = accs.filter(a => a.currency === selectedTrip.currency);
                                    }

                                    return accs;
                                }, [availableAccounts, activeCurrency, selectedTrip])}
                                selectedId={accountId}
                                onSelect={setAccountId}
                                filterType={(isIncome || isTransfer) ? 'NO_CREDIT' : 'ALL'}
                                disabled={!!initialData}
                                emptyMessage={activeCurrency !== 'BRL' ? `Você não possui conta em ${activeCurrency}. Crie uma conta internacional.` : 'Nenhuma conta encontrada.'}
                            />
                        ) : (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400"><User className="w-5 h-5" /></div>
                                    <div>
                                        <span className="block text-sm font-bold text-indigo-900 dark:text-indigo-300">Pago por {familyMembers.find(m => m.id === payerId)?.name || 'Outro'}</span>
                                        <span className="text-xs text-indigo-600 dark:text-indigo-400">Não sai da sua conta</span>
                                    </div>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => setIsSplitModalOpen(true)} className="text-xs h-8">Alterar</Button>
                            </div>
                        )}

                        {isTransfer && (
                            <>
                                {/* Conversion Toggle for International/Cross-Currency */}
                                {selectedAccountObj && (
                                    <div className="flex justify-end mb-2">
                                        <label className={`flex items - center gap - 2 text - xs font - bold cursor - pointer transition - colors ${isConversion
                                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800'
                                            : 'text-slate-500 hover:text-slate-700'
                                            } `}>
                                            <input
                                                type="checkbox"
                                                checked={isConversion}
                                                onChange={(e) => setIsConversion(e.target.checked)}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <Globe className="w-3.5 h-3.5" />
                                                {selectedAccountObj.isInternational
                                                    ? (isConversion ? 'Convertendo para Real (BRL)' : 'Converter para Real (BRL)?')
                                                    : (isConversion ? 'Enviando para Internacional' : 'Enviar para Internacional (Câmbio)?')}
                                            </div>
                                        </label>
                                    </div>
                                )}

                                <AccountSelector
                                    label="Vai para (Destino)"
                                    accounts={filteredDestinationAccounts}
                                    selectedId={destinationAccountId}
                                    onSelect={setDestinationAccountId}
                                // filterType="NO_CREDIT" -> Already filtered in filteredDestinationAccounts
                                />

                                {/* Multi-currency Transfer UI */}
                                {isMultiCurrencyTransfer && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-3 text-blue-800 dark:text-blue-300">
                                            <Globe className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase">Conversão Internacional</span>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Exchange Rate Input */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                                    Cotação do Dia
                                                </label>
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 text-sm">1 {selectedAccountObj?.currency} = </span>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        className="flex-1 bg-transparent text-center font-bold text-blue-700 dark:text-blue-300 text-lg outline-none placeholder-blue-300"
                                                        placeholder="0.00"
                                                        value={manualExchangeRate}
                                                        onChange={(e) => {
                                                            const rate = e.target.value;
                                                            setManualExchangeRate(rate);
                                                            // Auto-calculate Destination Amount
                                                            if (activeAmount && parseFloat(rate) > 0) {
                                                                // Logic: If transferring Account A (USD) -> Account B (BRL)
                                                                // Rate is typically X BRL per 1 USD.
                                                                // So Amount * Rate = Dest Amount.
                                                                // If transferring Account A (BRL) -> Account B (USD)
                                                                // Rule: "1 BRL = X USD"? No, usually "1 USD = X BRL".
                                                                // Standard convention: Base currency is usually the stronger one or the source.

                                                                // For simplicity in this UI: "1 SourceCurrency = X DestCurrency".
                                                                // The user defines the direct multiplier.
                                                                setDestinationAmountStr((activeAmount * parseFloat(rate)).toFixed(2));
                                                            }
                                                        }}
                                                    />
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 text-sm">{selectedDestAccountObj?.currency}</span>
                                                </div>
                                            </div>

                                            {/* Final Value Display */}
                                            <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-between border border-slate-700 shadow-inner">
                                                <span className="text-xs font-bold text-slate-400">Valor Final a Receber</span>
                                                <span className="text-xl font-black text-white">
                                                    {selectedDestAccountObj?.currency} {destinationAmountStr || '0.00'}
                                                </span>
                                            </div>
                                        </div>

                                        {errors.destinationAmount && <p className="text-red-500 text-xs font-bold mt-2">{errors.destinationAmount}</p>}
                                        {errors.exchangeRate && <p className="text-red-500 text-xs font-bold mt-2">{errors.exchangeRate}</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Options: Repeat, Installment, Reminder, Split */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block pl-1">Opções Adicionais</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`h - 14 rounded - xl border flex flex - col items - center justify - center gap - 0.5 transition - all ${isRecurring ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}><Repeat className="w-4 h-4" /><span className="text-[9px] font-bold">Repetir</span></button>
                            {isExpense && isCreditCard && <button type="button" onClick={() => setIsInstallment(!isInstallment)} className={`h - 14 rounded - xl border flex flex - col items - center justify - center gap - 0.5 transition - all ${isInstallment ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}><CreditCard className="w-4 h-4" /><span className="text-[9px] font-bold">Parcelar</span></button>}
                            <button type="button" onClick={() => setEnableNotification(!enableNotification)} className={`h - 14 rounded - xl border flex flex - col items - center justify - center gap - 0.5 transition - all ${enableNotification ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}><Bell className="w-4 h-4" /><span className="text-[9px] font-bold">Lembrar</span></button>
                            {isExpense && <button type="button" onClick={() => setIsSplitModalOpen(true)} className={`h - 14 rounded - xl border flex flex - col items - center justify - center gap - 0.5 transition - all ${splits.length > 0 || payerId !== 'me' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}><Users className="w-4 h-4" /><span className="text-[9px] font-bold">Dividir</span></button>}
                        </div>
                    </div>

                    {enableNotification && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800 animate-in slide-in-from-top-2 space-y-3">
                            <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-400">
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
                                    className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value={0}>No dia do vencimento</option>
                                    <option value={1}>1 dia antes</option>
                                    <option value={2}>2 dias antes</option>
                                    <option value={7}>1 semana antes</option>
                                    <option value="custom">Data Personalizada</option>
                                </select>
                                {reminderOption === 'custom' && (
                                    <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-2">
                                        <input
                                            type="date"
                                            value={notificationDate}
                                            onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                            onChange={e => setNotificationDate(e.target.value)}
                                            className="w-full p-2 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none bg-transparent"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isRecurring && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800 animate-in slide-in-from-top-2 space-y-4">
                            <div className="flex gap-3">
                                <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="flex-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value={Frequency.WEEKLY}>Semanalmente</option>
                                    <option value={Frequency.MONTHLY}>Mensalmente</option>
                                    <option value={Frequency.YEARLY}>Anualmente</option>
                                </select>
                            </div>
                            {frequency === Frequency.MONTHLY && (
                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-4"><Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" /><label className="text-base font-bold text-blue-900 dark:text-blue-300 flex-1">Dia do mês:</label><input type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="31" value={recurrenceDay} onChange={e => setRecurrenceDay(parseInt(e.target.value))} className="w-20 text-center bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 text-blue-900 dark:text-blue-300 font-bold outline-none text-lg" /></div>
                            )}
                        </div>
                    )}

                    {isInstallment && isCreditCard && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800 animate-in slide-in-from-top-2 space-y-3">
                            <div className="grid grid-cols-4 gap-3">
                                {[2, 3, 4, 5, 6, 10, 12].map(num => (<button key={num} type="button" onClick={() => setTotalInstallments(num)} className={`py - 2 rounded - xl text - sm font - bold border ${totalInstallments === num ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30'} `}>{num}x</button>))}
                                <div className="relative"><input type="number" placeholder="Outro" value={totalInstallments || ''} onChange={e => setTotalInstallments(parseInt(e.target.value))} className="w-full h-full rounded-xl text-center font-bold border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800" /></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 pb-safe bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 fixed bottom-0 left-0 right-0 md:relative md:border-none md:bg-transparent dark:md:bg-transparent z-20">
                    <Button onClick={handleSubmit} disabled={isSubmitting} className={`w - full h - 12 text - base shadow - xl shadow - slate - 200 ${buttonMainBg} hover: opacity - 90 transition - opacity`}>
                        {isSubmitting ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Confirmar Transação')}
                    </Button>
                </div>
            </div>

            <SplitModal
                isOpen={isSplitModalOpen}
                onClose={handleConfirmSplit}
                onConfirm={handleConfirmSplit}
                payerId={payerId}
                setPayerId={setPayerId}
                splits={splits}
                setSplits={setSplits}
                familyMembers={familyMembers}
                activeAmount={activeAmount}
                onNavigateToFamily={onNavigateToFamily}
                isInstallment={isInstallment}
                setIsInstallment={setIsInstallment}
                totalInstallments={totalInstallments}
                setTotalInstallments={setTotalInstallments}
                currentUserName={currentUserName}
            />
        </div>
    );
};