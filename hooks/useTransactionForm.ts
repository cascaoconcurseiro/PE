import { useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, TransactionSplit, Frequency, AccountType } from '../types';

interface UseTransactionFormProps {
    initialData?: Transaction | null;
    formMode: TransactionType;
    accounts: Account[];
    trips: Trip[];
    onSave: (data: any, isEdit: boolean, updateFuture: boolean) => void;
}

export const useTransactionForm = ({
    initialData,
    formMode,
    accounts,
    trips = [],
    onSave
}: UseTransactionFormProps) => {
    const getDefaultAccount = () => {
        if (initialData) return initialData.accountId;
        if (formMode === TransactionType.INCOME || formMode === TransactionType.TRANSFER) {
            const liquid = accounts.find(a => a.type !== AccountType.CREDIT_CARD);
            return liquid ? liquid.id : '';
        }
        const prefer = accounts.find(a => a.type === AccountType.CREDIT_CARD || a.type === AccountType.CHECKING);
        return prefer ? prefer.id : accounts[0]?.id || '';
    };

    // Helper function to format date locally
    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // State
    const [amountStr, setAmountStr] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(formatLocalDate(new Date()));
    const [category, setCategory] = useState<string>(Category.FOOD);
    const [accountId, setAccountId] = useState('');
    const [destinationAccountId, setDestinationAccountId] = useState('');

    // Multi-currency fields
    const [destinationAmountStr, setDestinationAmountStr] = useState('');
    const [manualExchangeRate, setManualExchangeRate] = useState('');

    const [tripId, setTripId] = useState('');
    const [isTripSelectorOpen, setIsTripSelectorOpen] = useState(false);

    // Shared/Split
    const [isShared, setIsShared] = useState(false);
    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [payerId, setPayerId] = useState<string>('me');

    // Recurring/Installments
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
    const [recurrenceDay, setRecurrenceDay] = useState<number>(new Date().getDate());
    const [isInstallment, setIsInstallment] = useState(false);
    const [currentInstallment, setCurrentInstallment] = useState(1);
    const [totalInstallments, setTotalInstallments] = useState(2);
    const [enableNotification, setEnableNotification] = useState(false);
    const [notificationDate, setNotificationDate] = useState(formatLocalDate(new Date()));
    const [reminderOption, setReminderOption] = useState<number | 'custom'>(0);
    const [isRefund, setIsRefund] = useState(false);

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!accountId) setAccountId(getDefaultAccount());
    }, [accounts, formMode, initialData]);

    // Derived Values
    const activeAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    const selectedAccountObj = accounts.find(a => a.id === accountId);
    const selectedDestAccountObj = accounts.find(a => a.id === destinationAccountId);
    const selectedTrip = trips.find(t => String(t.id) === String(tripId));
    const availableAccounts = accounts;

    // Multi-currency Check
    const isMultiCurrencyTransfer = formMode === TransactionType.TRANSFER &&
        selectedAccountObj &&
        selectedDestAccountObj &&
        selectedAccountObj.currency !== selectedDestAccountObj.currency;

    // Calculate implied rate if both amounts exist
    useEffect(() => {
        if (isMultiCurrencyTransfer && activeAmount > 0 && parseFloat(destinationAmountStr) > 0) {
            const rate = parseFloat(destinationAmountStr) / activeAmount;
            setManualExchangeRate(rate.toFixed(4));
        }
    }, [activeAmount, destinationAmountStr, isMultiCurrencyTransfer]);

    // Logic for Currency: If trip selected, assume transaction is in Trip Currency (for Expense)
    const activeCurrency = selectedTrip ? selectedTrip.currency : (selectedAccountObj?.currency || 'BRL');

    const isCreditCard = selectedAccountObj?.type === AccountType.CREDIT_CARD;
    const isExpense = formMode === TransactionType.EXPENSE;
    const isIncome = formMode === TransactionType.INCOME;
    const isTransfer = formMode === TransactionType.TRANSFER;

    // Load Data
    useEffect(() => {
        if (initialData) {
            const t = initialData;
            setAmountStr(t.amount.toString());
            setDescription(t.description);
            setDate(t.date); // Already in YYYY-MM-DD format
            setCategory(t.category);
            setAccountId(t.accountId);
            setDestinationAccountId(t.destinationAccountId || '');
            setTripId(t.tripId || '');
            setPayerId(t.payerId || 'me');
            setIsShared(!!t.isShared || (!!t.payerId && t.payerId !== 'me'));
            setSplits(t.sharedWith || []);
            setEnableNotification(!!t.enableNotification);

            if (t.destinationAmount) {
                setDestinationAmountStr(t.destinationAmount.toString());
            }

            if (t.enableNotification && t.notificationDate) {
                setNotificationDate(t.notificationDate);
                const dDate = new Date(t.date); dDate.setHours(12, 0, 0, 0);
                const nDate = new Date(t.notificationDate); nDate.setHours(12, 0, 0, 0);
                const diffTime = dDate.getTime() - nDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                setReminderOption([0, 1, 2, 7].includes(diffDays) ? diffDays : 'custom');
            } else {
                setNotificationDate(t.date); // Use transaction date directly
                setReminderOption(0);
            }

            setIsRecurring(!!t.isRecurring);
            setFrequency(t.frequency || Frequency.MONTHLY);
            setRecurrenceDay(t.recurrenceDay || new Date(t.date).getDate());

            const isAccCC = accounts.find(a => a.id === t.accountId)?.type === AccountType.CREDIT_CARD;
            setIsInstallment(!!t.isInstallment && (isAccCC || !!t.isInstallment));
            setCurrentInstallment(t.currentInstallment || 1);
            setTotalInstallments(t.totalInstallments || 2);
            setIsRefund(!!t.isRefund);
        }
    }, [initialData, accounts]);

    const handleConfirmSplit = () => {
        if (splits.length === 0 && payerId === 'me') setIsShared(false);
        else setIsShared(true);
        setIsSplitModalOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: { [key: string]: string } = {};

        if (!activeAmount || activeAmount <= 0) newErrors.amount = 'Valor inválido';
        if (!description.trim()) newErrors.description = 'Descrição obrigatória';
        if (!date) newErrors.date = 'Data obrigatória';
        if (!accountId && payerId === 'me' && !isShared) newErrors.account = 'Conta obrigatória';

        if (isTransfer) {
            if (!destinationAccountId) newErrors.destination = 'Conta destino obrigatória';
            // ✅ VALIDAÇÃO CRÍTICA: Bloquear transferências circulares
            if (destinationAccountId === accountId) {
                newErrors.destination = 'Não é possível transferir para a mesma conta';
            }

            if (isMultiCurrencyTransfer) {
                const destAmt = parseFloat(destinationAmountStr);
                if (!destAmt || destAmt <= 0) {
                    newErrors.destinationAmount = 'Informe o valor final na moeda de destino';
                }
                // ✅ VALIDAÇÃO CRÍTICA: Exchange rate obrigatório para multi-moeda
                const rate = parseFloat(manualExchangeRate);
                if (!rate || rate <= 0) {
                    newErrors.exchangeRate = 'Taxa de câmbio obrigatória para transferências entre moedas';
                }
            }
        }

        // ✅ Verificar se há erros antes de prosseguir
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Scroll para o primeiro erro
            const firstErrorKey = Object.keys(newErrors)[0];
            console.error('❌ Erro de validação:', firstErrorKey, newErrors[firstErrorKey]);
            return;
        }

        const finalSplits = splits
            .filter(s => s.percentage > 0)
            .map(s => ({
                ...s,
                assignedAmount: (activeAmount * s.percentage) / 100
            }));

        // ✅ VALIDAÇÃO CRÍTICA: Splits não podem somar mais que o total
        if (finalSplits.length > 0) {
            const splitsTotal = finalSplits.reduce((sum, s) => sum + s.assignedAmount, 0);
            if (splitsTotal > activeAmount) {
                newErrors.splits = `Divisão inválida: soma dos valores (${splitsTotal.toFixed(2)}) é maior que o total (${activeAmount.toFixed(2)})`;
            }
        }

        const isExternalPayer = payerId && payerId !== 'me';
        const shouldBeShared = formMode === TransactionType.EXPENSE && (isShared || finalSplits.length > 0 || isExternalPayer);

        let updateFuture = false;
        if (initialData && (initialData.seriesId || initialData.isRecurring)) {
            if (confirm(`Esta transação faz parte de uma série/recorrência.\n\nDeseja aplicar as alterações para TODAS as transações futuras desta série?`)) {
                updateFuture = true;
            }
        }

        const data = {
            amount: activeAmount,
            description: description.trim(),
            date,
            type: formMode!,
            category: formMode === TransactionType.TRANSFER ? Category.TRANSFER : category,
            accountId: (payerId && payerId !== 'me') ? 'EXTERNAL' : (accountId || undefined),
            destinationAccountId: isTransfer ? destinationAccountId : undefined,
            destinationAmount: (isTransfer && isMultiCurrencyTransfer) ? parseFloat(destinationAmountStr) : undefined,
            tripId: tripId || undefined,
            isShared: shouldBeShared,
            sharedWith: finalSplits,
            payerId: payerId === 'me' ? undefined : payerId,
            isRecurring,
            recurrenceDay: isRecurring ? recurrenceDay : undefined,
            lastGenerated: isRecurring ? date : undefined,
            frequency: isRecurring ? frequency : Frequency.ONE_TIME,
            isInstallment: isCreditCard ? isInstallment : false,
            currentInstallment: isInstallment ? currentInstallment : undefined,
            totalInstallments: isInstallment ? totalInstallments : undefined,
            enableNotification,
            notificationDate: enableNotification ? notificationDate : undefined,
            isRefund,
            currency: activeCurrency
        };

        onSave(data, !!initialData, updateFuture);
    };

    return {
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
        isShared, setIsShared,
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
        isRefund, setIsRefund,
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
    };
};