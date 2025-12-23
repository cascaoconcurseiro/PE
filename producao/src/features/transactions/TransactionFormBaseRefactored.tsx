import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory, Frequency, AccountType } from '../../types';
import { getCategoryIcon, parseDate } from '../../utils';
import { Calendar, ChevronDown, DollarSign, X, RefreshCcw, BellRing, Undo2, Plane, Pencil, CreditCard, User, Plus, ArrowDownLeft, ArrowUpRight, Globe, Repeat, Bell, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BaseForm, FieldConfig, useBaseForm } from '@/components/forms/BaseForm';
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
    onSave: (data: import('../../types').Transaction, isEdit: boolean, updateFuture: boolean) => void;
    onCancel: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
    currentUserName?: string;
    currentUserId?: string;
}

/**
 * TransactionForm refatorado usando BaseForm
 * Mantém toda funcionalidade complexa mas usa BaseForm como base
 * Reduz duplicação de código de formulário
 * Validates: Requirements 3.4, 8.1
 */
export const TransactionFormBaseRefactored: React.FC<TransactionFormProps> = ({
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
    currentUserName,
    currentUserId
}) => {
    const topRef = useRef<HTMLDivElement>(null);

    // OWNERSHIP CHECK
    const isOwner = !initialData || !initialData.userId || !currentUserId || initialData.userId === currentUserId;
    const isReadOnly = !isOwner;

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
        if (topRef.current?.scrollIntoView) {
            topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [formMode]);

    const CategoryIcon = getCategoryIcon(category);
    const mainColor = isRefund ? 'text-amber-600 dark:text-amber-400' : isExpense ? 'text-red-600 dark:text-red-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';
    const headerBg = isRefund ? 'bg-amber-50 dark:bg-amber-950/30' : isExpense ? 'bg-red-50 dark:bg-red-950/30' : isIncome ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30';
    const buttonMainBg = isRefund ? 'bg-amber-600 hover:bg-amber-700' : isExpense ? 'bg-red-600 hover:bg-red-700' : isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700';

    const isLocked = !!initialData?.sourceTransactionId;
    const selectedTrip = trips.find(t => t.id === tripId);

    // Strict Transfer Logic
    const [isConversion, setIsConversion] = React.useState(false);

    useEffect(() => {
        setIsConversion(false);
    }, [accountId]);

    const filteredDestinationAccounts = React.useMemo(() => {
        if (!isTransfer || !selectedAccountObj) return [];

        return accounts.filter(acc => {
            if (acc.id === accountId) return false;
            if (acc.type === AccountType.CREDIT_CARD || (acc.type as string) === 'CREDIT_CARD') return false;

            const isSourceInternational = selectedAccountObj.isInternational || selectedAccountObj.currency !== 'BRL';

            if (isSourceInternational) {
                if (isConversion) {
                    return !acc.isInternational && acc.currency === 'BRL';
                } else {
                    return acc.isInternational || acc.currency !== 'BRL';
                }
            } else {
                if (isConversion) {
                    return acc.isInternational || acc.currency !== 'BRL';
                } else {
                    return !acc.isInternational && acc.currency === 'BRL';
                }
            }
        });
    }, [accounts, accountId, selectedAccountObj, isTransfer, isConversion]);

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

    // Configuração dos campos básicos usando BaseForm
    const basicFields: FieldConfig[] = [
        {
            name: 'description',
            label: 'Descrição',
            type: 'text',
            placeholder: 'Ex: Almoço, Uber, Salário',
            required: true,
            disabled: isReadOnly,
            gridCols: 2
        },
        {
            name: 'date',
            label: 'Data',
            type: 'date',
            required: true,
            disabled: isReadOnly
        },
        {
            name: 'category',
            label: 'Categoria',
            type: 'select',
            disabled: isReadOnly || isTransfer,
            options: isTransfer ? [
                { value: 'Automático', label: 'Automático' }
            ] : isIncome ? [
                // Opções de receita
                { value: Category.INCOME, label: Category.INCOME },
                { value: Category.FREELANCE, label: Category.FREELANCE },
                { value: Category.BUSINESS, label: Category.BUSINESS },
                { value: Category.SALES, label: Category.SALES },
                { value: Category.DIVIDENDS, label: Category.DIVIDENDS },
                { value: Category.INVESTMENT, label: Category.INVESTMENT },
                { value: Category.REFUND, label: Category.REFUND },
                { value: Category.GIFT_RECEIVED, label: Category.GIFT_RECEIVED },
                { value: Category.OTHER, label: Category.OTHER }
            ] : [
                // Opções de despesa
                { value: Category.HOUSING, label: Category.HOUSING },
                { value: Category.RENT, label: Category.RENT },
                { value: Category.MAINTENANCE, label: Category.MAINTENANCE },
                { value: Category.FURNITURE, label: Category.FURNITURE },
                { value: Category.UTILITIES, label: Category.UTILITIES },
                { value: Category.FOOD, label: Category.FOOD },
                { value: Category.RESTAURANTS, label: Category.RESTAURANTS },
                { value: Category.GROCERY, label: Category.GROCERY },
                { value: Category.SNACKS, label: Category.SNACKS },
                { value: Category.TRANSPORTATION, label: Category.TRANSPORTATION },
                { value: Category.UBER, label: Category.UBER },
                { value: Category.FUEL, label: Category.FUEL },
                { value: Category.PUBLIC_TRANSPORT, label: Category.PUBLIC_TRANSPORT },
                { value: Category.VEHICLE_MAINTENANCE, label: Category.VEHICLE_MAINTENANCE },
                { value: Category.PARKING, label: Category.PARKING },
                { value: Category.HEALTH, label: Category.HEALTH },
                { value: Category.PHARMACY, label: Category.PHARMACY },
                { value: Category.DOCTOR, label: Category.DOCTOR },
                { value: Category.EXAMS, label: Category.EXAMS },
                { value: Category.GYM, label: Category.GYM },
                { value: Category.LEISURE, label: Category.LEISURE },
                { value: Category.ENTERTAINMENT, label: Category.ENTERTAINMENT },
                { value: Category.STREAMING, label: Category.STREAMING },
                { value: Category.TRAVEL, label: Category.TRAVEL },
                { value: Category.HOBBIES, label: Category.HOBBIES },
                { value: Category.SHOPPING, label: Category.SHOPPING },
                { value: Category.CLOTHING, label: Category.CLOTHING },
                { value: Category.ELECTRONICS, label: Category.ELECTRONICS },
                { value: Category.BEAUTY, label: Category.BEAUTY },
                { value: Category.HOME_SHOPPING, label: Category.HOME_SHOPPING },
                { value: Category.EDUCATION, label: Category.EDUCATION },
                { value: Category.COURSES, label: Category.COURSES },
                { value: Category.BOOKS, label: Category.BOOKS },
                { value: Category.PERSONAL, label: Category.PERSONAL },
                { value: Category.PERSONAL_CARE, label: Category.PERSONAL_CARE },
                { value: Category.PETS, label: Category.PETS },
                { value: Category.GIFTS, label: Category.GIFTS },
                { value: Category.DONATION, label: Category.DONATION },
                { value: Category.FINANCIAL, label: Category.FINANCIAL },
                { value: Category.INVESTMENT, label: Category.INVESTMENT },
                { value: Category.INSURANCE, label: Category.INSURANCE },
                { value: Category.TAXES, label: Category.TAXES },
                { value: Category.FEES, label: Category.FEES },
                { value: Category.LOANS, label: Category.LOANS },
                { value: Category.OTHER, label: Category.OTHER },
                ...customCategories.map(c => ({ value: c.name, label: c.name }))
            ]
        }
    ];

    // Valores básicos para o formulário
    const basicValues = {
        description,
        date,
        category: isTransfer ? 'Automático' : category
    };

    // Erros básicos do formulário
    const basicErrors = {
        description: errors.description || '',
        date: errors.date || '',
        category: errors.category || ''
    };

    // Handler para mudanças nos campos básicos
    const handleBasicFieldChange = (name: string, value: any) => {
        switch (name) {
            case 'description':
                setDescription(value);
                break;
            case 'date':
                setDate(value);
                break;
            case 'category':
                if (!isTransfer) {
                    setCategory(value);
                }
                break;
        }
    };

    return (
        <div className="flex flex-col h-screen max-h-[100dvh] bg-white dark:bg-slate-900 relative overflow-hidden">
            <div ref={topRef} />

            {/* Header Tabs */}
            <div className="sticky top-0 px-2 py-1 shrink-0 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5 bg-white dark:bg-slate-900 z-30">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg relative shadow-inner flex-1 gap-1">
                    <button onClick={() => setFormMode(TransactionType.EXPENSE)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md transition-all ${isExpense ? 'bg-white dark:bg-red-500/10 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-slate-200 dark:ring-red-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span className="text-xs">Despesa</span>
                    </button>
                    <button onClick={() => setFormMode(TransactionType.INCOME)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md transition-all ${isIncome ? 'bg-white dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-emerald-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span className="text-xs">Receita</span>
                    </button>
                    <button onClick={() => setFormMode(TransactionType.TRANSFER)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md transition-all ${isTransfer ? 'bg-white dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-blue-900/50 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 font-medium'} `}>
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
                    <div className="px-3 sm:px-5 pt-2 sm:pt-3 animate-in slide-in-from-top-2 space-y-2">
                        {isReadOnly ? (
                            <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
                                <User className="w-3 h-3" />
                                <span>Criado por outro membro (Leitura)</span>
                            </div>
                        ) : (
                            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 border border-amber-100 dark:border-amber-800">
                                <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Editando
                            </div>
                        )}
                    </div>
                )}

                {/* Duplicate Warning */}
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
                <div className={`flex flex-col items-center justify-center py-2 sm:py-3 ${headerBg} transition-colors duration-300 shrink-0`}>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        {isRefund ? <Undo2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span className="hidden xs:inline">{isRefund ? 'Valor do Estorno' : 'Valor'}</span>
                    </label>

                    <div className="relative flex items-center justify-center w-full px-2 sm:px-4">
                        <span className={`text-2xl sm:text-3xl md:text-4xl font-bold mr-1 sm:mr-2 opacity-80 ${mainColor} `}>
                            {activeCurrency === 'BRL' ? 'R$' : activeCurrency}
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="0,00"
                            className={`w-full max-w-[180px] sm:max-w-[240px] text-center text-2xl sm:text-3xl md:text-4xl font-black bg-transparent border-none outline-none placeholder-slate-300 dark:placeholder-slate-700 ${mainColor} disabled:opacity-50`}
                            autoFocus={!initialData && !isReadOnly}
                            disabled={isReadOnly}
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

                {/* Formulário Base - Usa BaseForm para campos padronizados */}
                <div className="p-3 sm:p-4">
                    <BaseForm
                        title=""
                        fields={basicFields}
                        values={basicValues}
                        errors={basicErrors}
                        onFieldChange={handleBasicFieldChange}
                        onSubmit={(e) => e.preventDefault()}
                        showCard={false}
                        isReadOnly={isReadOnly}
                    />
                </div>

                {/* Conteúdo específico que não pode ser padronizado */}
                <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {/* Trip Selection (Expense Only) */}
                    {isExpense && (
                        <div className="space-y-1">
                            <div className={`relative z-20 ${isReadOnly ? 'pointer-events-none opacity-60' : ''}`}>
                                <div onClick={() => !isReadOnly && setIsTripSelectorOpen(!isTripSelectorOpen)} className={`border rounded-xl p-3 flex items-center gap-3 shadow-sm relative transition-all cursor-pointer ${tripId ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} `}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tripId ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} `}>
                                        <Plane className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-sm font-bold truncate mb-0.5 ${tripId ? 'text-violet-900 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300'} `}>
                                            {tripId ? trips.find(t => t.id === tripId)?.name || 'Vincular a uma Viagem' : 'Vincular a uma Viagem'}
                                        </span>
                                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate block">
                                            {tripId ? `Moeda: ${selectedTrip?.currency} ` : 'Opcional'}
                                        </span>
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                </div>

                                {isTripSelectorOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsTripSelectorOpen(false)} />
                                        <div className="absolute inset-x-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                            <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300" onClick={() => { setTripId(''); setIsTripSelectorOpen(false); }}>
                                                Nenhuma viagem
                                            </div>
                                            {trips.length === 0 ? (
                                                <div className="p-4 text-center">
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                                                        <Plane className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nenhuma viagem cadastrada</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Crie uma viagem para vincular despesas</p>
                                                    {onNavigateToTrips && (
                                                        <button
                                                            onClick={() => { onNavigateToTrips(); setIsTripSelectorOpen(false); }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold transition-colors"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Criar Viagem
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                trips.map(t => (
                                                    <div key={t.id} onClick={() => { setTripId(t.id); setIsTripSelectorOpen(false); }} className="p-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">
                                                            <Plane className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{t.name}</span>
                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{t.currency}</span>
                                                        </div>
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
                    {payerId === 'me' ? (
                        <div className="grid grid-cols-1 gap-3">
                            <AccountSelector
                                label={isTransfer ? 'Sair de (Origem)' : (isExpense ? 'Pagar com' : 'Receber em')}
                                selectedId={accountId}
                                onSelect={setAccountId}
                                accounts={availableAccounts}
                                filterType={(isIncome || isTransfer) ? 'NO_CREDIT' : 'ALL'}
                                disabled={!!initialData || isReadOnly}
                                emptyMessage={activeCurrency !== 'BRL' ? `Você não possui conta em ${activeCurrency}. Crie uma conta internacional.` : 'Nenhuma conta encontrada.'}
                            />
                        </div>
                    ) : (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-indigo-700 dark:text-indigo-300">Pago por</span>
                                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">{familyMembers.find(m => m.id === payerId)?.name || 'Outro'}</span>
                                </div>
                            </div>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400">Não sai da sua conta</span>
                        </div>
                    )}

                    {/* Multi-Currency Transfer UI */}
                    {isMultiCurrencyTransfer && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 animate-in slide-in-from-top-2 fade-in space-y-4">
                            <div className="flex items-center gap-2 mb-2 text-blue-800 dark:text-blue-300">
                                <Globe className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Conversão Internacional</span>
                            </div>

                            {/* Conversion Toggle for International/Cross-Currency */}
                            {selectedAccountObj && (
                                <div className="flex justify-end mb-2">
                                    <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors ${isConversion ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-600 dark:text-slate-400'} `}>
                                        <input
                                            type="checkbox"
                                            checked={isConversion}
                                            onChange={(e) => setIsConversion(e.target.checked)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                        />
                                        <Globe className="w-3.5 h-3.5" />
                                        {selectedAccountObj.isInternational ? (isConversion ? 'Convertendo para Real (BRL)' : 'Enviando para Internacional') : (isConversion ? 'Convertendo para Internacional (Câmbio)' : 'Enviando para Real (BRL)')}
                                    </label>
                                </div>
                            )}

                            <AccountSelector
                                label="Vai para (Destino)"
                                selectedId={destinationAccountId}
                                onSelect={setDestinationAccountId}
                                accounts={filteredDestinationAccounts}
                            />

                            {/* Exchange Rate Input */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Cotação do Dia</label>
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-3">
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{selectedAccountObj?.currency}</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="0.00"
                                            value={manualExchangeRate}
                                            onChange={(e) => {
                                                const rate = e.target.value;
                                                setManualExchangeRate(rate);
                                                // Auto-calculate Destination Amount
                                                if (activeAmount > 0 && parseFloat(rate) > 0) {
                                                    setDestinationAmountStr((activeAmount * parseFloat(rate)).toFixed(2));
                                                }
                                            }}
                                            className="flex-1 bg-transparent text-lg font-bold text-blue-700 dark:text-blue-300 outline-none placeholder-blue-300"
                                        />
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{selectedDestAccountObj?.currency}</span>
                                    </div>
                                    {errors.exchangeRate && <p className="text-red-500 text-xs font-bold mt-2">{errors.exchangeRate}</p>}
                                </div>

                                {errors.destinationAmount && <p className="text-red-500 text-xs font-bold mt-2">{errors.destinationAmount}</p>}

                                {/* Final Value Display */}
                                <div className="bg-slate-900 dark:bg-white p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-inner">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Valor Final a Receber</span>
                                    <span className="text-xl font-black text-white dark:text-black">
                                        {selectedDestAccountObj?.currency} {destinationAmountStr || '0.00'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Conditional sections for notifications, recurring, installments, splits */}
                    {/* Opções Adicionais */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">Opções Adicionais</label>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Repetir */}
                            <button
                                type="button"
                                onClick={() => setIsRecurring(!isRecurring)}
                                className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${isRecurring ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}
                            >
                                <Repeat className="w-4 h-4" />
                                <span className="text-[9px] font-bold">Repetir</span>
                            </button>

                            {/* Parcelar */}
                            {isExpense && isCreditCard && (
                                <button
                                    type="button"
                                    onClick={() => setIsInstallment(!isInstallment)}
                                    className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${isInstallment ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}
                                >
                                    <CreditCard className="w-4 h-4" />
                                    <span className="text-[9px] font-bold">Parcelar</span>
                                </button>
                            )}

                            {/* Lembrar */}
                            <button
                                type="button"
                                onClick={() => setEnableNotification(!enableNotification)}
                                className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${enableNotification ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}
                            >
                                <Bell className="w-4 h-4" />
                                <span className="text-[9px] font-bold">Lembrar</span>
                            </button>

                            {/* Dividir */}
                            {isExpense && (
                                <button
                                    type="button"
                                    onClick={() => setIsSplitModalOpen(true)}
                                    className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${payerId !== 'me' || splits.length > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'} `}
                                >
                                    <Users className="w-4 h-4" />
                                    <span className="text-[9px] font-bold">Dividir</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Conditional sections for notifications, recurring, installments */}
                    {enableNotification && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 rounded-2xl animate-in slide-in-from-top-2 space-y-2">
                            <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-400">
                                <BellRing className="w-5 h-5" />
                                <span className="text-sm font-bold">Configurar Lembrete</span>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <select
                                        value={reminderOption}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const reminderVal = val === 'custom' ? 'custom' : parseInt(val);
                                            setReminderOption(reminderVal);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-amber-400"
                                    >
                                        <option value={0}>No dia do vencimento</option>
                                        <option value={1}>1 dia antes</option>
                                        <option value={2}>2 dias antes</option>
                                        <option value={7}>1 semana antes</option>
                                        <option value="custom">Data Personalizada</option>
                                    </select>
                                </div>

                                {reminderOption === 'custom' && (
                                    <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-2">
                                        <input
                                            type="date"
                                            value={notificationDate}
                                            onChange={(e) => setNotificationDate(e.target.value)}
                                            onClick={(e) => {
                                                try {
                                                    e.currentTarget.showPicker();
                                                } catch (e) {
                                                    /* ignore */
                                                }
                                            }}
                                            className="w-full cursor-pointer outline-none text-slate-700 dark:text-slate-200 font-bold bg-transparent disabled:cursor-not-allowed"
                                            disabled={isLocked}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isRecurring && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-5 rounded-2xl animate-in slide-in-from-top-2 space-y-4">
                            <div className="flex gap-3">
                                <select
                                    value={frequency as string}
                                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                                    className="flex-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value={Frequency.WEEKLY}>Semanalmente</option>
                                    <option value={Frequency.MONTHLY}>Mensalmente</option>
                                    <option value={Frequency.YEARLY}>Anualmente</option>
                                </select>
                            </div>

                            {frequency === Frequency.MONTHLY && (
                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    <label className="text-base font-bold text-blue-900 dark:text-blue-300 flex-1">Dia do mês:</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="1"
                                        max="31"
                                        value={recurrenceDay}
                                        onChange={e => setRecurrenceDay(parseInt(e.target.value))}
                                        className="w-full text-lg font-bold outline-none text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 text-center"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {isInstallment && isCreditCard && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-2xl animate-in slide-in-from-top-2 space-y-3">
                            <div className="grid grid-cols-4 gap-3">
                                {[2, 3, 4, 5, 6, 10, 12].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setTotalInstallments(num)}
                                        className={`py-2 rounded-xl text-sm font-bold border ${totalInstallments === num ? 'bg-purple-600 border text-white hover:bg-purple-700' : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30'} `}
                                    >
                                        {num}x
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="Outro"
                                    value={totalInstallments || ''}
                                    onChange={e => setTotalInstallments(parseInt(e.target.value))}
                                    className="w-full h-full rounded-xl text-center font-bold outline-none border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 bg-transparent focus:ring-2 focus:ring-purple-400"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Split Modal */}
                {isSplitModalOpen && (
                    <SplitModal
                        isOpen={isSplitModalOpen}
                        onClose={() => setIsSplitModalOpen(false)}
                        onConfirm={handleConfirmSplit}
                        splits={splits}
                        setSplits={setSplits}
                        payerId={payerId}
                        setPayerId={setPayerId}
                        familyMembers={familyMembers}
                        amount={activeAmount}
                        onNavigateToFamily={onNavigateToFamily}
                        currentUserName={currentUserName}
                        currentUserId={currentUserId}
                        totalInstallments={totalInstallments}
                        setTotalInstallments={setTotalInstallments}
                        isInstallment={isInstallment}
                        setIsInstallment={setIsInstallment}
                    />
                )}
            </div>

            {/* Submit Button */}
            {!isReadOnly && (
                <div className="fixed left-0 right-0 bottom-0 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 pb-safe md:bg-transparent md:border-none md:relative md:transparent z-20">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`w-full h-12 text-base font-bold shadow-xl shadow-slate-200 hover:opacity-90 transition-opacity ${buttonMainBg}`}
                    >
                        {isSubmitting ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Confirmar Transação')}
                    </Button>
                </div>
            )}
        </div>
    );
};