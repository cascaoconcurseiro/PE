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
            // If legacy data doesn't have initialBalance, we assume the current stored balance is the start
            // In a fresh app, initialBalance starts at 0 or user input.
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
            if (tx.type === TransactionType.EXPENSE) {
                // If payerId exists, someone else paid. It's an expense for budget, but doesn't reduce MY balance.
                // It creates a debt (handled elsewhere).
                if (!tx.payerId) {
                    // Expense subtracts, unless it's a refund (then adds)
                    sourceAcc.balance += tx.isRefund ? amount : -amount;
                }
            } else if (tx.type === TransactionType.INCOME) {
                // Income adds, unless it's a refund (then subtracts)
                sourceAcc.balance += tx.isRefund ? -amount : amount;
            } else if (tx.type === TransactionType.TRANSFER) {
                // Transfer Out always subtracts from Source
                sourceAcc.balance -= amount;
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
        // If payerId is set (someone else paid), and isSettled is true, I already paid them back.
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

            // Credit the Payer (Only credit what is outstanding or total if I am the payer)
            // If I am the payer, I credited myself for the parts that are NOT settled above.
            // If someone else is payer, and it's not settled (checked above), they get full credit.
            
            // Re-calculating credit based on active splits
            if (payerId === 'user') {
                 // For User Payer: Credit = Sum of Unsettled Splits
                 // We already debited the splits. Now we balance the equation.
                 // Actually, the logic is: Balance += Amount Paid - Amount Consumed.
                 // But since we are skipping settled things, we only add the *Unsettled* amount to the Payer's receivable column.
                 
                 if (balances[payerId] === undefined) balances[payerId] = 0;
                 balances[payerId] += totalSplitAmount; 
            } else {
                // External Payer: They paid 'amount'.
                // If I (user) am the consumer (implicit remainder), I owe them.
                // The explicit splits (other people) owe them.
                // Since this is Single Player, we mostly care about Me vs Them.
                
                // If I paid them back (isSettled checked at top), we returned.
                // If not, they are owed the full amount (minus what I might have split to others?)
                // Let's stick to the simple model:
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] += amount;

                // Debit explicit splits (Other people owe Payer) - Purely informational in Single Player
                tx.sharedWith.forEach(split => {
                     if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
                     balances[split.memberId] -= split.assignedAmount;
                });

                // Debit User (Remainder)
                const totalSplit = tx.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
                const remainder = amount - totalSplit;
                if (remainder > 0.01) {
                    balances['user'] -= remainder;
                }
            }

        } else {
            // Implicit Split (Split Equally among ALL participants + User)
            // If it's a trip expense and not explicitly shared, we assume it's for the group.
            // CAUTION: Unshared expenses in a trip usually mean "I paid for myself".
            // Only transactions marked `isShared` should trigger debt logic ideally.
            // But legacy/simple logic might assume all trip expenses are shared? 
            // Let's restrict to `isShared` or explicit splits to avoid confusion.
            
            if (!tx.isShared) return; // If not marked shared, assume personal expense

            const allInvolved = ['user', ...participantIds];
            const splitAmount = amount / allInvolved.length;

            if (payerId === 'user') {
                // I Paid. Everyone else owes me.
                let myCredit = 0;
                allInvolved.forEach(pid => {
                    if (pid === 'user') return; // I don't owe myself
                    // Implicit split has no specific isSettled flag per person easily unless we generated splits.
                    // Assuming implicit splits are unsettled for now.
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] -= splitAmount;
                    myCredit += splitAmount;
                });
                if (balances['user'] === undefined) balances['user'] = 0;
                balances['user'] += myCredit;
            } else {
                // Someone else paid. I owe them my share. Others owe them theirs.
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] += amount;

                allInvolved.forEach(pid => {
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] -= splitAmount;
                });
            }
        }
    });

    // 3. Settlement Algorithm (Minimize transactions)
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([id, balance]) => {
        if (balance < -0.01) debtors.push({ id, amount: balance }); // Negative balance
        if (balance > 0.01) creditors.push({ id, amount: balance }); // Positive balance
    });

    // Sort by magnitude to optimize
    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const settlementLines: string[] = [];
    const getName = (id: string) => id === 'user' ? 'Você' : participants.find(p => p.id === id)?.name || 'Desconhecido';

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        // The amount to settle is the minimum of what debtor owes and creditor is owed
        const amount = Math.min(Math.abs(debtor.amount), creditor.amount);

        // Record the settlement
        settlementLines.push(`${getName(debtor.id)} deve pagar ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)} para ${getName(creditor.id)}`);

        // Update remaining amounts
        debtor.amount += amount;
        creditor.amount -= amount;

        // Move indices if settled
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    if (settlementLines.length === 0) {
        return ["Tudo quitado! Nenhuma pendência em aberto."];
    }

    return settlementLines;
};