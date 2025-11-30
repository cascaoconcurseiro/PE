import React, { useRef } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory, Frequency, AccountType } from '../../types';
import { Button } from '../ui/Button';
import {
    Plane, Users, ChevronDown, Calendar, Wallet, ArrowUpRight, ArrowDownLeft,
    RefreshCcw, Bell, BellRing, Repeat, Undo2, DollarSign, CreditCard, X,
    Pencil, User, Plus, Clock
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
    trips,
    familyMembers,
    customCategories,
    onSave,
    onCancel,
    onNavigateToAccounts,
    onNavigateToTrips,
    onNavigateToFamily
}) => {
    const topRef = useRef<HTMLDivElement>(null);

    const {
        // State
        amountStr, setAmountStr,
        description, setDescription,
        date, setDate,
        category, setCategory,
        accountId, setAccountId,
        destinationAccountId, setDestinationAccountId,
        destinationAmountStr, setDestinationAmountStr,
        tripId, setTripId,
        isTripSelectorOpen, setIsTripSelectorOpen,
        // isShared, setIsShared, // Not used directly in JSX, logic handled in hook/modal
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
        convertedAmountStr, setConvertedAmountStr,
        errors,

        // Derived
        activeAmount,
        activeCurrency,
        accountCurrency,
        needsConversion,
        isCreditCard,
        isExpense,
        isIncome,
        isTransfer,

        // Handlers
        handleConfirmSplit,
        handleSubmit
    } = useTransactionForm({
        initialData,
        formMode,
        accounts,
        trips,
        onSave
    });

    const CategoryIcon = getCategoryIcon(category);

    const mainColor = isRefund ? 'text-amber-800' : isExpense ? 'text-red-700' : isIncome ? 'text-emerald-700' : 'text-blue-700';
    const mainBg = isRefund ? 'bg-amber-600' : isExpense ? 'bg-red-600' : isIncome ? 'bg-emerald-600' : 'bg-blue-600';
    const secondaryBg = isRefund ? 'bg-amber-50' : isExpense ? 'bg-red-50' : isIncome ? 'bg-emerald-50' : 'bg-blue-50';

    if (accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in-95">
                <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-6">
                    <Wallet className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhuma conta encontrada</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs">
                    Para criar uma transação, você precisa ter pelo menos uma conta ou cartão cadastrado.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    {onNavigateToAccounts && (
                        <Button onClick={onNavigateToAccounts} className="bg-slate-900 text-white shadow-xl h-12 w-full">
                            Cadastrar Conta
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onCancel} className="w-full h-12">
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative">
            <div ref={topRef} />

            {/* Header Tabs */}
            <div className="px-3 py-2 shrink-0 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl relative shadow-inner flex-1">
                    <button onClick={() => setFormMode(TransactionType.EXPENSE)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isExpense ? 'bg-white dark:bg-slate-700 text-red-700 dark:text-red-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}><ArrowDownLeft className="w-3.5 h-3.5" /> Despesa</button>
                    <button onClick={() => setFormMode(TransactionType.INCOME)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isIncome ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}><ArrowUpRight className="w-3.5 h-3.5" /> Receita</button>
                    <button onClick={() => setFormMode(TransactionType.TRANSFER)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isTransfer ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}><RefreshCcw className="w-3.5 h-3.5" /> Transf.</button>
                </div>
                <div className="shrink-0">
                    <button onClick={onCancel} className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" title="Cancelar"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
                {initialData && (
                    <div className="px-5 pt-4 animate-in slide-in-from-top-2">
                        <div className="bg-amber-50 text-amber-800 p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-amber-100">
                            <Pencil className="w-3 h-3" /> Editando Transação
                        </div>
                    </div>
                )}

                {/* Amount Input */}
                <div className={`flex flex-col items-center justify-center py-6 ${secondaryBg} border-b border-slate-100/50 transition-colors duration-300 shrink-0`}>
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                        {isRefund ? <Undo2 className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />} {isRefund ? 'Valor do Estorno' : 'Valor da Transação'}
                    </label>
                    <div className="relative flex items-center justify-center w-full px-4">
                        <span className={`text-3xl font-bold mr-1.5 opacity-70 ${mainColor}`}>{activeCurrency === 'USD' ? '$' : activeCurrency === 'EUR' ? '€' : 'R$'}</span>
                        <input type="number" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0,00" className={`w-full max-w-[240px] text-center text-5xl font-black bg-transparent border-none outline-none placeholder-slate-400 ${mainColor}`} autoFocus={!initialData} />
                    </div>
                    {errors.amount && <p className="text-red-700 text-xs font-bold mt-2 bg-red-100 px-3 py-1 rounded-full border border-red-200">{errors.amount}</p>}

                    {needsConversion && (
                        <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-top-2 w-full border-t border-slate-200/50 pt-4">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <RefreshCcw className="w-3 h-3" /> Valor Convertido ({accountCurrency})
                            </label>
                            <div className="relative flex items-center justify-center w-full px-4">
                                <span className="text-xl font-bold mr-1 opacity-70 text-slate-600">R$</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={convertedAmountStr}
                                    onChange={(e) => setConvertedAmountStr(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full max-w-[150px] text-center text-2xl font-bold bg-transparent border-b-2 border-slate-300 outline-none placeholder-slate-400 text-slate-700 focus:border-slate-500 transition-all"
                                />
                            </div>
                            {errors.convertedAmount && <p className="text-red-700 text-xs font-bold mt-1">{errors.convertedAmount}</p>}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                    {/* Basic Info */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Descrição</label>
                            <input placeholder="Ex: Almoço, Uber, Salário" value={description} onChange={e => { setDescription(e.target.value); }} className="w-full text-lg font-medium text-slate-900 dark:text-white border-b-2 border-slate-100 dark:border-slate-700 pb-2 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors" />
                            {errors.description && <p className="text-red-700 text-[10px] mt-0.5 pl-1 font-bold">{errors.description}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Data</label>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-12 flex items-center px-3 border border-slate-200 dark:border-slate-700 relative group cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30">
                                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-300 mr-2" />
                                    <input
                                        type="date"
                                        value={date}
                                        onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                        onChange={e => setDate(e.target.value)}
                                        className="bg-transparent font-medium text-slate-700 dark:text-slate-200 text-sm outline-none w-full h-full cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Categoria</label>
                                {!isTransfer ? (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-12 flex items-center px-3 border border-slate-200 dark:border-slate-700 relative group cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30">
                                        <CategoryIcon className="w-4 h-4 text-slate-400 dark:text-slate-300 mr-2" />
                                        <select value={category} onChange={e => setCategory(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer text-slate-900">
                                            <optgroup label="Essenciais" className="text-slate-900">
                                                {Object.values(Category).filter(c => [Category.HOUSING, Category.FOOD, Category.TRANSPORTATION, Category.UTILITIES, Category.HEALTH].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                            <optgroup label="Estilo de Vida" className="text-slate-900">
                                                {Object.values(Category).filter(c => [Category.SHOPPING, Category.ENTERTAINMENT, Category.PERSONAL_CARE, Category.TRAVEL, Category.PETS].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                            <optgroup label="Financeiro" className="text-slate-900">
                                                {Object.values(Category).filter(c => [Category.INCOME, Category.INVESTMENT, Category.TAXES, Category.INSURANCE, Category.GIFTS].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                            <optgroup label="Outros" className="text-slate-900">
                                                <option value={Category.EDUCATION}>{Category.EDUCATION}</option>
                                                <option value={Category.OTHER}>{Category.OTHER}</option>
                                            </optgroup>
                                            {customCategories.length > 0 && (
                                                <optgroup label="Personalizadas" className="text-slate-900">
                                                    {customCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </optgroup>
                                            )}
                                        </select>
                                        <span className="pointer-events-none truncate text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{category}</span>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl h-12 flex items-center justify-center border border-slate-200 dark:border-slate-700"><span className="text-xs font-bold text-slate-400">Automático</span></div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Account Selection with Custom Selector */}
                    <div className="grid grid-cols-1 gap-3">
                        {payerId === 'me' ? (
                            <AccountSelector
                                label={isTransfer ? 'Sai de (Origem)' : (isExpense ? 'Pagar com' : 'Receber em')}
                                accounts={accounts}
                                selectedId={accountId}
                                onSelect={setAccountId}
                                filterType={(isIncome || isTransfer) ? 'NO_CREDIT' : 'ALL'}
                            />
                        ) : (
                            <div>
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block pl-1">Status do Pagamento</label>
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
                            </div>
                        )}

                        {isTransfer && (
                            <AccountSelector
                                label="Vai para (Destino)"
                                accounts={accounts.filter(a => a.id !== accountId)}
                                selectedId={destinationAccountId}
                                onSelect={setDestinationAccountId}
                                filterType="NO_CREDIT"
                            />
                        )}
                    </div>

                    {/* Trip Selection */}
                    {isExpense && (
                        <div className="space-y-3">
                            <div className="relative z-20">
                                <div
                                    onClick={() => setIsTripSelectorOpen(!isTripSelectorOpen)}
                                    className={`border rounded-2xl p-4 flex items-center gap-3 shadow-sm relative transition-all cursor-pointer ${tripId ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tripId ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                        <Plane className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-lg font-bold truncate mb-0.5 ${tripId ? 'text-violet-900 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {tripId ? trips.find(t => t.id === tripId)?.name : 'Vincular a uma Viagem'}
                                        </span>
                                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate block">Opcional</span>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 ${isTripSelectorOpen ? 'rotate-180' : ''} transition-transform text-slate-400 dark:text-slate-300`} />
                                </div>

                                {isTripSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsTripSelectorOpen(false)} />
                                        <div className="absolute inset-x-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
                                            <div
                                                onClick={() => { setTripId(''); setIsTripSelectorOpen(false); }}
                                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300 font-medium text-sm border-b border-slate-50 dark:border-slate-700"
                                            >
                                                Nenhuma
                                            </div>
                                            {trips.map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => { setTripId(t.id); setIsTripSelectorOpen(false); }}
                                                    className={`p-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer flex items-center gap-3 ${tripId === t.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">
                                                        <Plane className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold text-sm">{t.name}</span>
                                                </div>
                                            ))}
                                            {onNavigateToTrips && (
                                                <div
                                                    onClick={onNavigateToTrips}
                                                    className="p-3 hover:bg-violet-100 dark:hover:bg-violet-900/30 cursor-pointer flex items-center gap-2 text-violet-700 dark:text-violet-400 font-bold text-sm border-t border-slate-100 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20"
                                                >
                                                    <Plus className="w-4 h-4" /> Criar Nova Viagem
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>


                        </div>
                    )}

                    {/* Additional Options */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block pl-1">Opções Adicionais</label>
                        <div className="grid grid-cols-4 gap-2">
                            <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${isRecurring ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Repeat className="w-5 h-5" /><span className="text-[10px] font-bold">Repetir</span></button>
                            {isExpense && isCreditCard && (
                                <button type="button" onClick={() => setIsInstallment(!isInstallment)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${isInstallment ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CreditCard className="w-5 h-5" /><span className="text-[10px] font-bold">Parcelar</span></button>
                            )}
                            <button type="button" onClick={() => setEnableNotification(!enableNotification)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${enableNotification ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Bell className="w-5 h-5" /><span className="text-[10px] font-bold">Lembrar</span></button>
                            {isExpense && <button type="button" onClick={() => setIsSplitModalOpen(true)} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all aspect-square ${splits.length > 0 || payerId !== 'me' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users className="w-5 h-5" /><span className="text-[10px] font-bold">Dividir</span></button>}
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
                                            className="w-full p-2 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none"
                                        />
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
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800 animate-in slide-in-from-top-2 space-y-4">
                            <div className="flex gap-3">
                                <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="flex-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-base rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-blue-400">
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
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-5 border border-purple-100 dark:border-purple-800 animate-in slide-in-from-top-2 space-y-5">
                            <div className="grid grid-cols-4 gap-3">
                                {[2, 3, 4, 5, 6, 10, 12].map(num => (<button key={num} type="button" onClick={() => setTotalInstallments(num)} className={`py-4 rounded-xl text-base font-bold border ${totalInstallments === num ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30'}`}>{num}x</button>))}
                                <div className="relative"><input type="number" placeholder="Outro" value={totalInstallments || ''} onChange={e => setTotalInstallments(parseInt(e.target.value))} className="w-full h-full rounded-xl text-center font-bold border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-slate-800" /></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 fixed bottom-0 left-0 right-0 md:relative md:border-none md:bg-transparent dark:md:bg-transparent z-20">
                    <Button onClick={handleSubmit} className={`w-full h-14 text-lg shadow-xl shadow-slate-200 ${mainBg} hover:opacity-90 transition-opacity`}>
                        {initialData ? 'Salvar Alterações' : 'Confirmar Transação'}
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
            />
        </div>
    );
};