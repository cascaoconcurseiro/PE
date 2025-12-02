import React, { useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory, Frequency, AccountType } from '../../types';
import { Button } from '../ui/Button';
import {
    Plane, Users, ChevronDown, Calendar, ArrowUpRight, ArrowDownLeft,
    RefreshCcw, Bell, BellRing, Repeat, Undo2, DollarSign, CreditCard, X,
    Pencil, User, Plus, AlertCircle, Globe, ArrowRight
} from 'lucide-react';
import { getCategoryIcon } from '../../utils';
import { SplitModal } from './SplitModal';
import { AccountSelector } from './AccountSelector';
import { useTransactionForm } from '../../hooks/useTransactionForm';

interface TransactionFormProps {
    initialData?: Transaction | null;
    formMode: TransactionType;
    setFormMode: (mode: TransactionType | null) => void;
    accounts: Account[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    customCategories: CustomCategory[];
    onSave: (data: any, isEdit: boolean, updateFuture: boolean) => void;
    onCancel: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
    initialData,
    formMode,
    setFormMode,
    accounts,
    trips = [],
    familyMembers = [],
    customCategories,
    onSave,
    onCancel,
    onNavigateToAccounts,
    onNavigateToTrips,
    onNavigateToFamily
}) => {
    const topRef = useRef<HTMLDivElement>(null);

    const {
        amountStr, setAmountStr,
        destinationAmountStr, setDestinationAmountStr,
        manualExchangeRate,
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
        handleSubmit
    } = useTransactionForm({
        initialData,
        formMode,
        accounts,
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

    // Filter accounts based on Trip Currency logic
    const filteredAccountsForTrip = React.useMemo(() => {
        if (!selectedTrip || selectedTrip.currency === 'BRL') {
            return availableAccounts;
        }
        return availableAccounts.filter(acc =>
            acc.currency === selectedTrip.currency ||
            (acc.type === AccountType.CREDIT_CARD && acc.isInternational)
        );
    }, [availableAccounts, selectedTrip]);

    if (accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400 mb-4">Nenhuma conta encontrada.</p>
                <Button variant="secondary" onClick={onCancel}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-h-[100dvh] bg-white dark:bg-slate-900 relative overflow-hidden">
            <div ref={topRef} />

            {/* Header Tabs */}
            <div className="sticky top-0 px-2 py-1 shrink-0 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5 bg-white dark:bg-slate-900 z-30">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg relative shadow-inner flex-1">
                    <button onClick={() => setFormMode(TransactionType.EXPENSE)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${isExpense ? 'bg-white dark:bg-slate-700 text-red-700 dark:text-red-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}><ArrowDownLeft className="w-3 h-3" /><span className="hidden xs:inline">Despesa</span></button>
                    <button onClick={() => setFormMode(TransactionType.INCOME)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${isIncome ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}><ArrowUpRight className="w-3 h-3" /><span className="hidden xs:inline">Receita</span></button>
                    <button onClick={() => setFormMode(TransactionType.TRANSFER)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${isTransfer ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}><RefreshCcw className="w-3 h-3" /><span className="hidden xs:inline">Transf.</span></button>
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

                {/* Amount Input */}
                <div className={`flex flex-col items-center justify-center py-2 sm:py-3 ${headerBg} transition-colors duration-300 shrink-0`}>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        {isRefund ? <Undo2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span className="hidden xs:inline">{isRefund ? 'Valor do Estorno' : 'Valor'}</span>
                    </label>

                    <div className="relative flex items-center justify-center w-full px-2 sm:px-4">
                        <span className={`text-2xl sm:text-3xl md:text-4xl font-bold mr-1 sm:mr-2 opacity-80 ${mainColor}`}>
                            {activeCurrency === 'BRL' ? 'R$' : activeCurrency}
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="0,00"
                            className={`w-full max-w-[180px] sm:max-w-[240px] text-center text-2xl sm:text-3xl md:text-4xl font-black bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-700 ${mainColor}`}
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

                    {/* Currency Conversion for Travel Expenses */}
                    {isExpense && selectedTrip && selectedAccountObj && selectedTrip.currency !== selectedAccountObj.currency && (
                        <div className="mt-4 mx-4 bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-slate-200/50 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-3 h-3 text-indigo-500" />
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Conversão Automática</span>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Valor {selectedTrip.currency}</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        className="w-full bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none border border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const rate = document.getElementById('exchange-rate-input') as HTMLInputElement;
                                            if (val && rate.value) {
                                                const calc = parseFloat(val) * parseFloat(rate.value);
                                                if (!isNaN(calc)) setAmountStr(calc.toFixed(2));
                                            }
                                        }}
                                    />
                                </div>
                                <div className="text-slate-400 font-bold text-center">x</div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Cotação</label>
                                    <input
                                        id="exchange-rate-input"
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="Ex: 5.50"
                                        className="w-full bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none border border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                                        onChange={(e) => {
                                            const rate = e.target.value;
                                            const valInput = e.target.parentElement?.previousElementSibling?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                                            if (rate && valInput?.value) {
                                                const calc = parseFloat(valInput.value) * parseFloat(rate);
                                                if (!isNaN(calc)) setAmountStr(calc.toFixed(2));
                                            }
                                        }}
                                    />
                                </div>
                            </div>
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
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-10 flex items-center px-3 border border-slate-200 dark:border-slate-700 relative">
                                    <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                                    <input type="date" value={date} onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }} onChange={e => setDate(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-sm outline-none w-full h-full" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Categoria</label>
                                {!isTransfer ? (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-10 flex items-center px-3 border border-slate-200 dark:border-slate-700 relative">
                                        <CategoryIcon className="w-4 h-4 text-slate-400 mr-2" />
                                        <select value={category} onChange={e => setCategory(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer text-slate-900">
                                            <optgroup label="Categorias Padrão">
                                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                            {customCategories.length > 0 && (
                                                <optgroup label="Personalizadas">
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
                                <div onClick={() => setIsTripSelectorOpen(!isTripSelectorOpen)} className={`border rounded-xl p-3 flex items-center gap-3 shadow-sm relative transition-all cursor-pointer ${tripId ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tripId ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}><Plane className="w-4 h-4" /></div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-sm font-bold truncate mb-0.5 ${tripId ? 'text-violet-900 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300'}`}>{tripId ? trips.find(t => t.id === tripId)?.name : 'Vincular a uma Viagem'}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block">{tripId ? `Moeda: ${selectedTrip?.currency}` : 'Opcional'}</span>
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                </div>
                                {isTripSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsTripSelectorOpen(false)} />
                                        <div className="absolute inset-x-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                            <div onClick={() => { setTripId(''); setIsTripSelectorOpen(false); }} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-sm border-b border-slate-50 dark:border-slate-700">Nenhuma</div>
                                            {trips.map(t => (
                                                <div key={t.id} onClick={() => { setTripId(t.id); setIsTripSelectorOpen(false); }} className="p-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-xs"><Plane className="w-4 h-4" /></div>
                                                    <div><span className="text-slate-800 dark:text-slate-200 font-bold text-sm block">{t.name}</span><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{t.currency}</span></div>
                                                </div>
                                            ))}
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
                                accounts={filteredAccountsForTrip}
                                selectedId={accountId}
                                onSelect={setAccountId}
                                filterType={(isIncome || isTransfer) ? 'NO_CREDIT' : 'ALL'}
                                disabled={!!initialData}
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
                                <AccountSelector label="Vai para (Destino)" accounts={accounts.filter(a => a.id !== accountId)} selectedId={destinationAccountId} onSelect={setDestinationAccountId} filterType="NO_CREDIT" />

                                {/* Multi-currency Transfer UI */}
                                {isMultiCurrencyTransfer && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-3 text-blue-800 dark:text-blue-300">
                                            <Globe className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase">Conversão de Moeda</span>
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Saiu ({selectedAccountObj?.currency})</label>
                                                <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{activeAmount.toFixed(2)}</div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-400" />
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-1">Entrou ({selectedDestAccountObj?.currency})</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1 text-lg font-bold text-blue-700 dark:text-blue-300 outline-none focus:ring-2 focus:ring-blue-500"
                                                    value={destinationAmountStr}
                                                    onChange={(e) => setDestinationAmountStr(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {manualExchangeRate && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center">
                                                Taxa Implícita: 1 {selectedAccountObj?.currency} = {manualExchangeRate} {selectedDestAccountObj?.currency}
                                            </p>
                                        )}
                                        {errors.destinationAmount && <p className="text-red-500 text-xs font-bold mt-2">{errors.destinationAmount}</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Options: Repeat, Installment, Reminder, Split */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block pl-1">Opções Adicionais</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${isRecurring ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Repeat className="w-4 h-4" /><span className="text-[9px] font-bold">Repetir</span></button>
                            {isExpense && isCreditCard && <button type="button" onClick={() => setIsInstallment(!isInstallment)} className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${isInstallment ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CreditCard className="w-4 h-4" /><span className="text-[9px] font-bold">Parcelar</span></button>}
                            <button type="button" onClick={() => setEnableNotification(!enableNotification)} className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${enableNotification ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Bell className="w-4 h-4" /><span className="text-[9px] font-bold">Lembrar</span></button>
                            {isExpense && <button type="button" onClick={() => setIsSplitModalOpen(true)} className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${splits.length > 0 || payerId !== 'me' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users className="w-4 h-4" /><span className="text-[9px] font-bold">Dividir</span></button>}
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
                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-4"><Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" /><label className="text-base font-bold text-blue-900 dark:text-blue-300 flex-1">Dia do mês:</label><input type="number" min="1" max="31" value={recurrenceDay} onChange={e => setRecurrenceDay(parseInt(e.target.value))} className="w-20 text-center bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 text-blue-900 dark:text-blue-300 font-bold outline-none text-lg" /></div>
                            )}
                        </div>
                    )}

                    {isInstallment && isCreditCard && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800 animate-in slide-in-from-top-2 space-y-3">
                            <div className="grid grid-cols-4 gap-3">
                                {[2, 3, 4, 5, 6, 10, 12].map(num => (<button key={num} type="button" onClick={() => setTotalInstallments(num)} className={`py-2 rounded-xl text-sm font-bold border ${totalInstallments === num ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30'}`}>{num}x</button>))}
                                <div className="relative"><input type="number" placeholder="Outro" value={totalInstallments || ''} onChange={e => setTotalInstallments(parseInt(e.target.value))} className="w-full h-full rounded-xl text-center font-bold border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800" /></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 fixed bottom-0 left-0 right-0 md:relative md:border-none md:bg-transparent dark:md:bg-transparent z-20">
                    <Button onClick={handleSubmit} className={`w-full h-12 text-base shadow-xl shadow-slate-200 ${buttonMainBg} hover:opacity-90 transition-opacity`}>
                        {initialData ? 'Salvar Alterações' : 'Confirmar Transação'}
                    </Button>
                </div>
            </div>

            <SplitModal isOpen={isSplitModalOpen} onClose={handleConfirmSplit} onConfirm={handleConfirmSplit} payerId={payerId} setPayerId={setPayerId} splits={splits} setSplits={setSplits} familyMembers={familyMembers} activeAmount={activeAmount} onNavigateToFamily={onNavigateToFamily} />
        </div>
    );
};