import { Account, Transaction, TransactionType } from '../types';

/**
 * CORE FINANCIAL ENGINE
 * Reconstructs the state of all accounts based on the history of transactions.
 * This ensures Double-Entry Bookkeeping consistency.
 * 
 * @param cutOffDate If provided, transactions after this date will be ignored.
 */
export const calculateBalances = (accounts: Account[], transactions: Transaction[], cutOffDate?: Date): Account[] => {
    // 1. Create a map of accounts with their INITIAL balance
    const accountMap = new Map<string, Account>();

    accounts.forEach(acc => {
        accountMap.set(acc.id, {
            ...acc,
            balance: acc.initialBalance !== undefined ? acc.initialBalance : (acc.balance || 0)
        });
    });

    // 2. Iterate through every single transaction to apply changes
    transactions.forEach(tx => {
        const amount = tx.amount;

        // Skip invalid transactions
        if (!amount || amount <= 0) return;

        // TIME TRAVEL LOGIC:
        if (cutOffDate) {
            const txDate = new Date(tx.date);
            const cutOff = new Date(cutOffDate);
            cutOff.setHours(23, 59, 59, 999);

            if (txDate.getTime() > cutOff.getTime()) {
                return; // Skip this future transaction
            }
        }

        // Logic for Source Account
        const sourceAcc = accountMap.get(tx.accountId);
        if (sourceAcc) {
            // Determine the actual amount affecting the account
            // If exchangeRate exists, it means tx.amount is in foreign currency
            // and we need to convert back to account currency.
            // Rate definition: AccountAmount / TxAmount => AccountAmount = TxAmount * Rate
            const effectiveAmount = (tx.exchangeRate && tx.exchangeRate > 0)
                ? tx.amount * tx.exchangeRate
                : amount;

            if (tx.type === TransactionType.EXPENSE) {
                // CORREÇÃO CRÍTICA: Se 'payerId' existe e não é 'me' (ou seja, outro pagou),
                // o dinheiro NÃO sai da minha conta bancária. É uma dívida, não um fluxo de caixa.
                // O fluxo de caixa só acontece quando eu crio a transação de "Pagamento" (Acerto).
                const someoneElsePaid = tx.payerId && tx.payerId !== 'me';

                if (!someoneElsePaid) {
                    // Expense subtracts, unless it's a refund (then adds)
                    sourceAcc.balance += tx.isRefund ? effectiveAmount : -effectiveAmount;
                }
            } else if (tx.type === TransactionType.INCOME) {
                // Income adds, unless it's a refund (then subtracts)
                sourceAcc.balance += tx.isRefund ? -effectiveAmount : effectiveAmount;
            } else if (tx.type === TransactionType.TRANSFER) {
                // Transfer Out always subtracts from Source
                sourceAcc.balance -= effectiveAmount;
            }
        }

        // Logic for Destination Account (Transfer)
        if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
            const destAcc = accountMap.get(tx.destinationAccountId);
            if (destAcc) {
                // Transfer In always adds to Destination
                const finalAmount = tx.destinationAmount !== undefined ? tx.destinationAmount : amount;
                destAcc.balance += finalAmount;
            }
        }
    });

    // 3. Return the array of accounts with updated balances
    return Array.from(accountMap.values());
};

/**
 * Calculates the debts for a specific trip based on transactions.
 * Returns a list of strings describing the settlement (e.g., "João deve R$ 50,00 para Maria").
 */
export const calculateTripDebts = (transactions: Transaction[], participants: { id: string, name: string }[]): string[] => {
    // 1. Initialize balances (Positive = Receives, Negative = Owes)
    const balances: { [id: string]: number } = {};
    const participantIds = participants.map(p => p.id);

    balances['user'] = 0;
    participants.forEach(p => balances[p.id] = 0);

    // 2. Process Transactions
    transactions.forEach(tx => {
        if (tx.type !== TransactionType.EXPENSE) return; // Only expenses count for debts

        // Check if the MAIN debt (Me -> Other) is settled
        if (tx.payerId && tx.isSettled) return;

        const amount = tx.amount;
        const payerId = tx.payerId || 'user'; // 'user' is the main user

        // Debit the Consumers
        if (tx.isShared && tx.sharedWith && tx.sharedWith.length > 0) {
            let totalSplitAmount = 0;

            // Explicit Split
            tx.sharedWith.forEach(split => {
                // If I paid, and this specific split is settled, skip it (they paid me back)
                if (payerId === 'user' && split.isSettled) return;

                if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
                balances[split.memberId] -= split.assignedAmount;
                totalSplitAmount += split.assignedAmount;
            });

            // Credit the Payer
            if (payerId === 'user') {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] += totalSplitAmount;
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] += amount;

                tx.sharedWith.forEach(split => {
                    if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
                    balances[split.memberId] -= split.assignedAmount;
                });

                const totalSplit = tx.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
                const remainder = amount - totalSplit;
                if (remainder > 0.01) {
                    balances['user'] -= remainder;
                }
            }

        } else {
            // Implicit Split logic (kept for legacy support)
            if (!tx.isShared) return;

            const allInvolved = ['user', ...participantIds];
            const splitAmount = amount / allInvolved.length;

            if (payerId === 'user') {
                let myCredit = 0;
                allInvolved.forEach(pid => {
                    if (pid === 'user') return;
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] -= splitAmount;
                    myCredit += splitAmount;
                });
                if (balances['user'] === undefined) balances['user'] = 0;
                balances['user'] += myCredit;
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] += amount;

                allInvolved.forEach(pid => {
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] -= splitAmount;
                });
            }
        }
    });

    // 3. Settlement Algorithm
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([id, balance]) => {
        if (balance < -0.01) debtors.push({ id, amount: balance }); // Negative balance
        if (balance > 0.01) creditors.push({ id, amount: balance }); // Positive balance
    });

    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlementLines: string[] = [];
    const getName = (id: string) => id === 'user' ? 'Você' : participants.find(p => p.id === id)?.name || 'Desconhecido';

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

        settlementLines.push(`${getName(debtor.id)} deve pagar ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)} para ${getName(creditor.id)}`);

        debtor.amount += amount;
        creditor.amount -= amount;

        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    if (settlementLines.length === 0) {
        return ["Tudo quitado! Nenhuma pendência em aberto."];
    }

    return settlementLines;
};