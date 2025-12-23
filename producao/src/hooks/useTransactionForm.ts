import { useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, TransactionSplit, Frequency, AccountType } from '../types';
import { SafeFinancialCalculator } from '../utils/SafeFinancialCalculator';

interface UseTransactionFormProps {
    initialData?: Transaction | null;
    formMode: TransactionType;
    accounts: Account[];
    transactions?: Transaction[];
    trips: Trip[];
    onSave: (data: import('../types').Transaction, isEdit: boolean, updateFuture: boolean) => void;
}

export const useTransactionForm = ({
    initialData,
    formMode,
    accounts,
    transactions,
    trips = [],
    onSave
}: UseTransactionFormProps) => {
    const getDefaultAccount = () => {
        if (initialData) return initialData.accountId || '';
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
    const activeCurrency = (formMode === TransactionType.EXPENSE && selectedTrip) ? selectedTrip.currency : (selectedAccountObj?.currency || 'BRL');

    const isCreditCard = selectedAccountObj?.type === AccountType.CREDIT_CARD;
    const isExpense = formMode === TransactionType.EXPENSE;
    const isIncome = formMode === TransactionType.INCOME;
    const isTransfer = formMode === TransactionType.TRANSFER;

    // Force Expense mode if Credit Card, or switch Account if Income/Transfer
    useEffect(() => {
        if (selectedAccountObj?.type === AccountType.CREDIT_CARD) {
            if (formMode === TransactionType.INCOME || formMode === TransactionType.TRANSFER) {
                // If we are in restricted mode but have CC, switch account
                const safeAccount = accounts.find(a => a.type !== AccountType.CREDIT_CARD);
                if (safeAccount) {
                    setAccountId(safeAccount.id);
                } else {
                    setAccountId('');
                }
            }
        }
    }, [formMode, selectedAccountObj]);

    // Reset Category when Form Mode changes
    useEffect(() => {
        // If we are editing and returning to the original type, restore the original category
        if (initialData && initialData.type === formMode) {
            setCategory(initialData.category);
            return;
        }

        // Otherwise set defaults based on mode
        if (formMode === TransactionType.INCOME) {
            setCategory(Category.INCOME);
        } else if (formMode === TransactionType.EXPENSE) {
            setCategory(Category.FOOD);
        } else if (formMode === TransactionType.TRANSFER) {
            setCategory(Category.TRANSFER);
        }
    }, [formMode, initialData]);

    // Load Data
    useEffect(() => {
        if (initialData) {
            const t = initialData;
            setAmountStr(t.amount.toString());
            setDescription(t.description);
            setDate(t.date); // Already in YYYY-MM-DD format
            setCategory(t.category);
            setAccountId(t.accountId || '');
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

    const [duplicateWarning, setDuplicateWarning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset warning when form changes
    useEffect(() => {
        setDuplicateWarning(false);
    }, [amountStr, description, date, accountId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const newErrors: { [key: string]: string } = {};

        // ... (standard validations)
        if (!activeAmount || activeAmount <= 0) newErrors.amount = 'Valor inválido';
        if (!description.trim()) newErrors.description = 'Descrição obrigatória';
        if (!date) newErrors.date = 'Data obrigatória';
        if (!accountId && payerId === 'me' && !isShared) newErrors.account = 'Conta obrigatória';

        // STRICT TRANSFER VALIDATION
        if (isTransfer) {
            if (!destinationAccountId) newErrors.destination = 'Conta destino obrigatória';
            if (destinationAccountId === accountId) {
                newErrors.destination = 'Não é possível transferir para a mesma conta';
            }
            // Ensure destination exists in available accounts (prevent stale IDs)
            const destExists = accounts.find(a => a.id === destinationAccountId);
            if (!destExists) newErrors.destination = 'Conta destino inválida ou inexistente';

            if (isMultiCurrencyTransfer) {
                const destAmt = parseFloat(destinationAmountStr);
                if (!destAmt || destAmt <= 0) {
                    newErrors.destinationAmount = 'Informe o valor final na moeda de destino';
                }
                const rate = parseFloat(manualExchangeRate);
                if (!rate || rate <= 0) {
                    newErrors.exchangeRate = 'Taxa de câmbio obrigatória para transferências entre moedas';
                }
            }
        }

        // STRICT SPLIT VALIDATION
        if (splits.length > 0) {
            const totalSplitAmount = SafeFinancialCalculator.safeSum(
                splits.map(s => SafeFinancialCalculator.toSafeNumber(s.assignedAmount, 0))
            );
            // Allow 0.05 margin for float errors
            if (totalSplitAmount > activeAmount + 0.05) {
                newErrors.amount = `Erro: A soma das divisões (R$ ${totalSplitAmount.toFixed(2)}) excede o valor da transação!`;
            }
            
            // CORREÇÃO: Validar se sobra algo para o pagador quando necessário
            const remainder = activeAmount - totalSplitAmount;
            if (remainder < 0.01 && payerId === 'me' && !isShared) {
                newErrors.amount = `Erro: Nenhum valor restou para o pagador! Ajuste as divisões.`;
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            const firstErrorKey = Object.keys(newErrors)[0];
            const element = document.getElementById(`input-${firstErrorKey}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.focus();
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Explicitly warn user as requested
            alert(`Não foi possível salvar a transação:\n\n${newErrors[firstErrorKey]}`);
            return;
        }

        // DUPLICATE CHECK (Only for new transactions)
        if (!initialData && transactions && !duplicateWarning) {
            const potentialDuplicates = transactions.filter(t =>
                !t.deleted &&
                t.amount === activeAmount &&
                t.date === date &&
                t.description.toLowerCase().trim() === description.toLowerCase().trim() &&
                t.accountId === accountId &&
                t.type === formMode
            );

            if (potentialDuplicates.length > 0) {
                setDuplicateWarning(true);
                // Scroll to top to see warning (if we handle UI there, or just alert)
                // Since hooks don't control UI directly, we rely on the parent or return error?
                // Actually, let's inject a "error" into the description field or a general error
                // Better: The Component should see 'duplicateWarning' state.
                // For now, let's use the 'errors' object to block submission and show message
                setErrors({ description: 'Atenção: Transação similar já existe! Clique em confirmar novamente para salvar mesmo assim.' });
                return;
            }
        }

        setIsSubmitting(true);

        try {
            const finalSplits = splits
                .filter(s => s.percentage > 0)
                .map(s => ({
                    ...s,
                    assignedAmount: (activeAmount * s.percentage) / 100
                }));

            const isExternalPayer = payerId !== '' && payerId !== 'me';
            const shouldBeShared = formMode === TransactionType.EXPENSE && (isShared || finalSplits.length > 0 || isExternalPayer);

            let updateFuture = false;
            if (initialData && (initialData.seriesId || initialData.isRecurring)) {
                if (confirm(`Esta transação faz parte de uma série/recorrência.\n\nDeseja aplicar as alterações para TODAS as transações futuras desta série?`)) {
                    updateFuture = true;
                }
            }

            const data: Transaction = {
                id: initialData?.id || crypto.randomUUID(), // Use existing ID for edit, or generate new
                amount: activeAmount,
                description: description.trim(),
                date,
                type: formMode!,
                category: formMode === TransactionType.TRANSFER ? Category.TRANSFER : category,
                accountId: (payerId && payerId !== 'me') ? undefined : (accountId || undefined),
                destinationAccountId: isTransfer ? destinationAccountId : undefined,
                destinationAmount: (isTransfer && isMultiCurrencyTransfer) ? parseFloat(destinationAmountStr) : undefined,
                tripId: (formMode === TransactionType.EXPENSE && tripId) ? tripId : undefined,
                isShared: shouldBeShared,
                sharedWith: finalSplits,
                payerId: payerId === 'me' ? undefined : payerId,
                isRecurring,
                recurrenceDay: isRecurring ? recurrenceDay : undefined,
                lastGenerated: isRecurring ? date : undefined,
                frequency: isRecurring ? frequency : Frequency.ONE_TIME,
                isInstallment: (isCreditCard || isExternalPayer) ? isInstallment : undefined,
                currentInstallment: isInstallment ? currentInstallment : undefined,
                totalInstallments: isInstallment ? totalInstallments : undefined,
                enableNotification,
                notificationDate: enableNotification ? notificationDate : undefined,
                isRefund,
                currency: activeCurrency,
                exchangeRate: (manualExchangeRate && parseFloat(manualExchangeRate) > 0) ? parseFloat(manualExchangeRate) : undefined,
                // CORREÇÃO: Domain consistente baseado no contexto
                domain: tripId ? 'TRAVEL' : (shouldBeShared ? 'SHARED' : 'PERSONAL')
            };

            await onSave(data, !!initialData, updateFuture);
        } catch (error) {
            const logger = (await import('../services/logger')).logger;
            logger.error('Error saving transaction', error);
            setIsSubmitting(false);
        }
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
        handleSubmit,
        setManualExchangeRate, // Export setter
        duplicateWarning, // ✅ Export for UI Blinking Alert
        isSubmitting // ✅ Export isSubmitting
    };
};