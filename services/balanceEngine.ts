import { Account, Transaction, TransactionType } from '../types';
import { round2dec } from '../utils';

/**
 * CORE FINANCIAL ENGINE
 * Reconstructs the state of all accounts based on the history of transactions.
 * This ensures Double-Entry Bookkeeping consistency with floating point safety.
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
        const amount = tx.amount; // Amount is ALWAYS in the currency of the Source Account (accountId)

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

        // Logic for Source Account (The account spending/sending money)
        const sourceAcc = accountMap.get(tx.accountId);
        if (sourceAcc) {
            if (tx.type === TransactionType.EXPENSE) {
                // Check if someone else paid (Debt logic)
                const someoneElsePaid = tx.payerId && tx.payerId !== 'me';

                if (!someoneElsePaid) {
                    // Expense subtracts from source
                    const change = tx.isRefund ? amount : -amount;
                    sourceAcc.balance = round2dec(sourceAcc.balance + change);
                }
            } else if (tx.type === TransactionType.INCOME) {
                // Income adds to source
                const change = tx.isRefund ? -amount : amount;
                sourceAcc.balance = round2dec(sourceAcc.balance + change);

            } else if (tx.type === TransactionType.TRANSFER) {
                // Transfer Out always subtracts 'amount' from Source
                // 'amount' is guaranteed to be in Source Currency
                sourceAcc.balance = round2dec(sourceAcc.balance - amount);
            }
        }

        // Logic for Destination Account (Transfer Only)
        if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
            const destAcc = accountMap.get(tx.destinationAccountId);
            if (destAcc) {
                // Determine the amount arriving at destination
                // If explicit destinationAmount exists (multi-currency), use it.
                // Otherwise, assume 1:1 (same currency).
                let amountIncoming = amount;

                // VALIDATION: Multi-currency transfers MUST have destinationAmount
                if (sourceAcc.currency !== destAcc.currency) {
                    if (!tx.destinationAmount || tx.destinationAmount <= 0) {
                        console.error(`❌ ERRO CRÍTICO: Transferência multi-moeda (${sourceAcc.currency} → ${destAcc.currency}) sem destinationAmount válido!`);
                        console.error(`   Transaction ID: ${tx.id}`);
                        console.error(`   Description: ${tx.description}`);
                        console.error(`   Amount: ${tx.amount} ${sourceAcc.currency}`);
                        console.error(`   ⚠️ Usando taxa 1:1 como FALLBACK - SALDO PODE ESTAR INCORRETO!`);
                        // Use 1:1 as fallback but log critical warning
                        amountIncoming = amount;
                    } else {
                        amountIncoming = tx.destinationAmount;
                    }
                } else if (tx.destinationAmount && tx.destinationAmount > 0) {
                    // Same currency but has destinationAmount (unusual but valid)
                    amountIncoming = tx.destinationAmount;
                }

                // Transfer In always adds to Destination
                destAcc.balance = round2dec(destAcc.balance + amountIncoming);
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
                balances[split.memberId] = round2dec(balances[split.memberId] - split.assignedAmount);
                totalSplitAmount = round2dec(totalSplitAmount + split.assignedAmount);
            });

            // Credit the Payer
            if (payerId === 'user') {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = round2dec(balances[payerId] + totalSplitAmount);
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = round2dec(balances[payerId] + amount);

                tx.sharedWith.forEach(split => {
                    if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
                    balances[split.memberId] = round2dec(balances[split.memberId] - split.assignedAmount);
                });

                const totalSplit = tx.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
                const remainder = amount - totalSplit;
                if (remainder > 0.01) {
                    balances['user'] = round2dec(balances['user'] - remainder);
                }
            }

        } else {
            // Implicit Split logic (kept for legacy support)
            if (!tx.isShared) return;

            const allInvolved = ['user', ...participantIds];
            const splitAmount = round2dec(amount / allInvolved.length);

            if (payerId === 'user') {
                let myCredit = 0;
                allInvolved.forEach(pid => {
                    if (pid === 'user') return;
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] = round2dec(balances[pid] - splitAmount);
                    myCredit = round2dec(myCredit + splitAmount);
                });
                if (balances['user'] === undefined) balances['user'] = 0;
                balances['user'] = round2dec(balances['user'] + myCredit);
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = round2dec(balances[payerId] + amount);

                allInvolved.forEach(pid => {
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] = round2dec(balances[pid] - splitAmount);
                });
            }
        }
    });

    // 3. Settlement Algorithm
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([id, balance]) => {
        const val = round2dec(balance);
        if (val < -0.01) debtors.push({ id, amount: val }); // Negative balance
        if (val > 0.01) creditors.push({ id, amount: val }); // Positive balance
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
        // We need to settle the smaller of the two absolute amounts
        const amount = round2dec(Math.min(Math.abs(debtor.amount), creditor.amount));

        if (amount > 0) {
            settlementLines.push(`${getName(debtor.id)} deve pagar ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)} para ${getName(creditor.id)}`);

            debtor.amount = round2dec(debtor.amount + amount);
            creditor.amount = round2dec(creditor.amount - amount);
        }

        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    if (settlementLines.length === 0) {
        return ["Tudo quitado! Nenhuma pendência em aberto."];
    }

    return settlementLines;
};