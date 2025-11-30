import { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, TransactionSplit, Frequency, AccountType, CustomCategory } from '../types';

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
    trips,
    onSave
}: UseTransactionFormProps) => {
    // Initial Logic: Only change default account if not editing
    const getDefaultAccount = () => {
        if (initialData) return initialData.accountId;
        // For income/transfer source, prioritize non-credit cards
        if (formMode === TransactionType.INCOME || formMode === TransactionType.TRANSFER) {
            const liquid = accounts.find(a => a.type !== AccountType.CREDIT_CARD);
            return liquid ? liquid.id : '';
        }
        // For expense, anything goes, prefer credit card or checking
        const prefer = accounts.find(a => a.type === AccountType.CREDIT_CARD || a.type === AccountType.CHECKING);
        return prefer ? prefer.id : accounts[0]?.id || '';
    };

    // State initialization
    const [amountStr, setAmountStr] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<string>(Category.FOOD);
    const [accountId, setAccountId] = useState('');
    const [destinationAccountId, setDestinationAccountId] = useState('');
    const [destinationAmountStr, setDestinationAmountStr] = useState('');
    const [tripId, setTripId] = useState('');
    const [isTripSelectorOpen, setIsTripSelectorOpen] = useState(false);

    // Logic: Shared/Split
    const [isShared, setIsShared] = useState(false);
    const [splits, setSplits] = useState<TransactionSplit[]>([]);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [payerId, setPayerId] = useState<string>('me');

    // Logic: Recurring/Installments/Reminders
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
    const [recurrenceDay, setRecurrenceDay] = useState<number>(new Date().getDate());
    const [isInstallment, setIsInstallment] = useState(false);
    const [currentInstallment, setCurrentInstallment] = useState(1);
    const [totalInstallments, setTotalInstallments] = useState(2);
    const [enableNotification, setEnableNotification] = useState(false);
    const [notificationDate, setNotificationDate] = useState(new Date().toISOString().split('T')[0]);
    const [reminderOption, setReminderOption] = useState<number | 'custom'>(0);
    const [isRefund, setIsRefund] = useState(false);

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Initialize Account ID correctly
    useEffect(() => {
        if (!accountId) {
            setAccountId(getDefaultAccount());
        }
    }, [accounts, formMode, initialData]);

    // Derived values
    const activeAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    const selectedAccountObj = accounts.find(a => a.id === accountId);
    const destAccountObj = accounts.find(a => a.id === destinationAccountId);
    const selectedTrip = trips.find(t => t.id === tripId);
    // When a trip is selected, use the trip's currency directly
    const activeCurrency = selectedTrip ? (selectedTrip.currency || 'BRL') : (selectedAccountObj?.currency || 'BRL');

    const isCreditCard = selectedAccountObj?.type === AccountType.CREDIT_CARD;
    const isExpense = formMode === TransactionType.EXPENSE;
    const isIncome = formMode === TransactionType.INCOME;
    const isTransfer = formMode === TransactionType.TRANSFER;

    // Effects
    useEffect(() => {
        if (initialData) {
            // Load data for editing
            const t = initialData;
            setAmountStr(t.amount.toString());
            setDescription(t.description);
            setDate(new Date(t.date).toISOString().split('T')[0]);
            setCategory(t.category);
            setAccountId(t.accountId);
            setDestinationAccountId(t.destinationAccountId || '');
            setDestinationAmountStr(t.destinationAmount ? t.destinationAmount.toString() : '');
            setTripId(t.tripId || '');
            setPayerId(t.payerId || 'me');
            setIsShared(!!t.isShared || (!!t.payerId && t.payerId !== 'me'));
            setSplits(t.sharedWith || []);
            setEnableNotification(!!t.enableNotification);

            if (t.enableNotification && t.notificationDate) {
                setNotificationDate(t.notificationDate);
                const dDate = new Date(t.date); dDate.setHours(12, 0, 0, 0);
                const nDate = new Date(t.notificationDate); nDate.setHours(12, 0, 0, 0);
                const diffTime = dDate.getTime() - nDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                setReminderOption([0, 1, 2, 7].includes(diffDays) ? diffDays : 'custom');
            } else {
                setNotificationDate(new Date(t.date).toISOString().split('T')[0]);
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
        } else {
            // If switching modes, verify if account is valid for that mode
            if (formMode === TransactionType.INCOME || formMode === TransactionType.TRANSFER) {
                if (selectedAccountObj?.type === AccountType.CREDIT_CARD) {
                    setAccountId(getDefaultAccount());
                }
            }
        }
    }, [initialData, accounts, formMode]);

    useEffect(() => {
        if (!isCreditCard && isInstallment) {
            setIsInstallment(false);
        }
    }, [isCreditCard]);

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
        if (!isRecurring) setRecurrenceDay(new Date(date).getDate());
    }, [date, isRecurring]);

    const handleConfirmSplit = () => {
        if (splits.length === 0 && payerId === 'me') {
            setIsShared(false);
        } else {
            setIsShared(true);
        }
        setIsSplitModalOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const errors: { [key: string]: string } = {};
        if (!activeAmount || activeAmount <= 0) errors.amount = 'Valor inválido';
        if (!description.trim()) errors.description = 'Descrição obrigatória';
        if (!date) errors.date = 'Data obrigatória';
        if (!accountId && payerId === 'me') errors.account = 'Conta obrigatória';
        if (isTransfer) {
            if (!destinationAccountId) errors.destination = 'Conta destino obrigatória';
            if (destinationAccountId === accountId) errors.destination = 'Origem e destino iguais';
        }

        if (Object.keys(errors).length > 0) {
            setErrors(errors);
            return;
        }

        let finalDestinationAmount = activeAmount;
        if (isTransfer && destinationAccountId) {
            const destAcc = accounts.find(a => a.id === destinationAccountId);
            const account = accounts.find(a => a.id === accountId);
            if (account && destAcc && account.currency !== destAcc.currency && destinationAmountStr) {
                finalDestinationAmount = parseFloat(destinationAmountStr.replace(',', '.'));
            }
        }

        let updateFuture = false;
        if (initialData && (initialData.seriesId || initialData.isRecurring)) {
            if (confirm(`Esta transação faz parte de uma série/recorrência.\n\nDeseja aplicar as alterações para TODAS as transações futuras desta série?`)) {
                updateFuture = true;
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

        const data = {
            amount: activeAmount,
            description: description.trim(),
            date,
            type: formMode!,
            category: formMode === TransactionType.TRANSFER ? Category.TRANSFER : category,
            accountId: (payerId && payerId !== 'me') ? 'EXTERNAL' : (accountId || (accounts[0] ? accounts[0].id : '')),
            destinationAccountId: isTransfer ? destinationAccountId : undefined,
            destinationAmount: isTransfer && destinationAccountId ? finalDestinationAmount : undefined,
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
            isRefund
        };

        onSave(data, !!initialData, updateFuture);
    };

    return {
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

        // Derived
        activeAmount,
        activeCurrency,
        isCreditCard,
        isExpense,
        isIncome,
        isTransfer,

        // Handlers
        handleConfirmSplit,
        handleSubmit
    };
};
