import { Transaction, Frequency } from '../../types';

export interface RecurrenceResult {
    newTransactions: Omit<Transaction, 'id'>[];
    updatedTransactions: Transaction[];
}

export const processRecurringTransactions = (
    transactions: Transaction[]
): RecurrenceResult => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: RecurrenceResult = {
        newTransactions: [],
        updatedTransactions: []
    };

    transactions.forEach(t => {
        if (!t.isRecurring || !t.frequency || !t.recurrenceDay) return;

        // Determine the next due date based on the last generated date or the original date
        let lastDate = t.lastGenerated ? new Date(t.lastGenerated) : new Date(t.date);

        // Calculate next date based on frequency
        const advanceDate = (date: Date) => {
            const newDate = new Date(date);
            switch (t.frequency) {
                case Frequency.DAILY:
                    newDate.setDate(newDate.getDate() + 1);
                    break;
                case Frequency.WEEKLY:
                    newDate.setDate(newDate.getDate() + 7);
                    break;
                case Frequency.MONTHLY:
                    // FIX: Set to day 1 first to prevent month skipping
                    newDate.setDate(1);
                    newDate.setMonth(newDate.getMonth() + 1);
                    const desiredDay = t.recurrenceDay!;
                    const daysInNextMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
                    newDate.setDate(Math.min(desiredDay, daysInNextMonth));
                    break;
                case Frequency.YEARLY:
                    newDate.setFullYear(newDate.getFullYear() + 1);
                    break;
            }
            return newDate;
        };

        let nextDate = advanceDate(lastDate);

        if (nextDate <= today) {
            let currentDateToGenerate = nextDate;
            let safetyCounter = 0;
            let lastGeneratedDate = t.lastGenerated;
            let hasUpdates = false;

            while (currentDateToGenerate <= today && safetyCounter < 12) {
                // FIX: Formatar data localmente
                const dateYear = currentDateToGenerate.getFullYear();
                const dateMonth = String(currentDateToGenerate.getMonth() + 1).padStart(2, '0');
                const dateDay = String(currentDateToGenerate.getDate()).padStart(2, '0');
                const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;

                // Check for duplicates
                const alreadyExists = transactions.some(tx =>
                    tx.date === dateStr &&
                    tx.accountId === t.accountId &&
                    tx.amount === t.amount &&
                    tx.type === t.type &&
                    (tx.description === `${t.description} (Recorrente)` || tx.description === t.description)
                );

                // Also check if we just added it in THIS batch
                const inBatch = result.newTransactions.some(tx =>
                    tx.date === dateStr &&
                    tx.accountId === t.accountId &&
                    tx.amount === t.amount &&
                    tx.type === t.type &&
                    tx.description === `${t.description} (Recorrente)`
                );

                if (!alreadyExists && !inBatch) {
                    // CORREÇÃO: Validação menos restritiva para transações compartilhadas
                    // Transações compartilhadas podem ter accountId=null se payerId != 'me'
                    if (!t.accountId && (!t.isShared || !t.payerId || t.payerId === 'me')) {
                        console.warn('Skipping recurring transaction: missing accountId for non-shared transaction', t.id);
                        return; // Skip invalid
                    }

                    const newTx: Omit<Transaction, 'id'> = {
                        ...t,
                        date: dateStr,
                        isRecurring: false,
                        isInstallment: false,
                        lastGenerated: undefined,
                        description: `${t.description} (Recorrente)`,
                        // CORREÇÃO: Manter domain consistente
                        domain: t.tripId ? 'TRAVEL' : (t.isShared ? 'SHARED' : 'PERSONAL')
                    };

                    result.newTransactions.push(newTx);
                    lastGeneratedDate = newTx.date as string;
                    hasUpdates = true;
                }

                currentDateToGenerate = advanceDate(currentDateToGenerate);
                safetyCounter++;
            }

            // Update Parent if needed
            if (hasUpdates && lastGeneratedDate && lastGeneratedDate !== t.lastGenerated) {
                result.updatedTransactions.push({ ...t, lastGenerated: lastGeneratedDate });
            }
        }
    });

    return result;
};
