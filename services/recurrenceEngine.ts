import { Transaction, Frequency, TransactionType } from '../types';

export const processRecurringTransactions = (
    transactions: Transaction[],
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void,
    onUpdateTransaction: (t: Transaction) => void
) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    transactions.forEach(t => {
        if (!t.isRecurring || !t.frequency || !t.recurrenceDay) return;

        // Determine the next due date based on the last generated date or the original date
        let lastDate = t.lastGenerated ? new Date(t.lastGenerated) : new Date(t.date);
        // If it's the first time (no lastGenerated), we shouldn't generate immediately if the date is in the future.
        // But if date is in past, we might need to catch up?
        // Usually, the 'date' of the recurring setup is the "Start Date".

        let nextDate = new Date(lastDate);

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

        // If we have never generated, the first one is the start date itself? 
        // Or is the start date the first occurrence?
        // Let's assume the 'date' field IS the first occurrence.
        // If lastGenerated is null, and date <= today, we might have already "missed" it if we didn't record it?
        // Actually, usually the user creates the transaction "Rent" on Jan 1st and marks "Recurring".
        // That Jan 1st tx exists. The NEXT one should be Feb 1st.
        // So if lastGenerated is null, we assume the 'date' was the first one, so we start advancing from there.

        nextDate = advanceDate(lastDate);

        if (nextDate <= today) {
            let currentDateToGenerate = nextDate;
            let safetyCounter = 0;
            let lastGeneratedDate = t.lastGenerated;

            while (currentDateToGenerate <= today && safetyCounter < 12) {
                const dateStr = currentDateToGenerate.toISOString().split('T')[0];

                // FIX: Verificar se já existe uma transação com mesma data, descrição e valor
                // para evitar duplicação se o app for aberto múltiplas vezes no mesmo dia
                const alreadyExists = transactions.some(tx =>
                    tx.date === dateStr &&
                    tx.accountId === t.accountId &&
                    tx.amount === t.amount &&
                    tx.type === t.type &&
                    (tx.description === `${t.description} (Recorrente)` || tx.description === t.description) &&
                    !tx.deleted
                );

                if (!alreadyExists) {
                    // Validação: Conta obrigatória para transações recorrentes
                    if (!t.accountId || t.accountId.trim() === '' || t.accountId === 'EXTERNAL') {
                        console.error(`❌ ERRO: Transação recorrente sem conta válida!`);
                        console.error(`   Transaction ID: ${t.id}`);
                        console.error(`   Description: ${t.description}`);
                        console.error(`   AccountId: ${t.accountId}`);
                        // Não criar transação inválida
                        return;
                    }

                    const newTx: Omit<Transaction, 'id'> = {
                        ...t,
                        date: dateStr,
                        isRecurring: false,
                        isInstallment: false,
                        lastGenerated: undefined,
                        description: `${t.description} (Recorrente)`
                    };

                    onAddTransaction(newTx);
                    lastGeneratedDate = newTx.date;
                }

                currentDateToGenerate = advanceDate(currentDateToGenerate);
                safetyCounter++;
            }

            // Update Parent
            if (lastGeneratedDate) {
                onUpdateTransaction({ ...t, lastGenerated: lastGeneratedDate });
            }
        }
    });
};
