import { parseDate } from '../utils';
import { Account, Transaction, TransactionType } from '../types';
import { FinancialPrecision } from './financialPrecision';

// Helper for precision - usando FinancialPrecision
const round2dec = FinancialPrecision.round;

export const calculateBalances = (initialAccounts: Account[], transactions: Transaction[], cutOffDate?: string | Date): Account[] => {
    // 1. Clone accounts to avoid mutating state directly
    const accountMap = new Map<string, Account>();
    initialAccounts.forEach(acc => {
        accountMap.set(acc.id, { ...acc, balance: acc.initialBalance || 0 });
    });

    // 2. Sort transactions chronologically
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Process transactions
    sortedTxs.forEach(tx => {
        if (tx.deleted) return;

        // TIME TRAVEL LOGIC:
        if (cutOffDate) {
            // Use safe-parsing (Noon) to avoid timezone shifts pushing dates to previous day
            const txDate = parseDate(tx.date);
            const cutOff = new Date(cutOffDate);
            cutOff.setHours(23, 59, 59, 999);

            if (txDate.getTime() > cutOff.getTime()) {
                return; // Skip this future transaction
            }
        }

        const amount = tx.amount;
        // Check if someone else paid (shared logic)
        // If payerId is set and NOT 'me', then it doesn't affect my balance directly 
        // (unless I am paying them back, which is a separate settlement tx)
        const someoneElsePaid = tx.payerId && tx.payerId !== 'me';

        // Logic for Source Account (The account spending/sending money)
        const sourceAcc = accountMap.get(tx.accountId || '');

        // ✅ VALIDAÇÃO: Conta de origem não encontrada (provavelmente deletada)
        // Não abortamos a transação para garantir que o LADO DO DESTINO (se existir) seja processado.
        if (!someoneElsePaid && !sourceAcc && tx.accountId) {
            // Suppress warning for "Pending" items which might lack accountId
        }

        if (sourceAcc) {
            if (tx.type === TransactionType.EXPENSE) {
                if (!someoneElsePaid) {
                    // Expense subtracts from source
                    const change = tx.isRefund ? amount : -amount;
                    sourceAcc.balance = FinancialPrecision.sum([sourceAcc.balance, change]);
                }
            } else if (tx.type === TransactionType.INCOME) {
                // Income adds to source
                const change = tx.isRefund ? -amount : amount;
                sourceAcc.balance = FinancialPrecision.sum([sourceAcc.balance, change]);

            } else if (tx.type === TransactionType.TRANSFER) {
                // Transfer Out always subtracts 'amount' from Source
                // 'amount' is guaranteed to be in Source Currency
                sourceAcc.balance = FinancialPrecision.subtract(sourceAcc.balance, amount);
            }
        }

        // Logic for Destination Account (Transfer Only)
        if (tx.type === TransactionType.TRANSFER) {
            // ✅ VALIDAÇÃO CRÍTICA 4: Transferência DEVE ter destino
            if (!tx.destinationAccountId || tx.destinationAccountId.trim() === '') {
                // Error logged via logger if needed
                return;
            }

            const destAcc = accountMap.get(tx.destinationAccountId || '');

            if (!destAcc) {
                // Warning: Destination account not found - handled by reverting source
                if (sourceAcc) {
                    // Reverte a subtração feita acima
                    sourceAcc.balance = FinancialPrecision.sum([sourceAcc.balance, amount]);
                }
            } else {
                // Determine the amount arriving at destination
                // If explicit destinationAmount exists (multi-currency), use it.
                // Otherwise, assume 1:1 (same currency).
                let amountIncoming = amount;

                // ✅ VALIDAÇÃO CRÍTICA 6: Multi-currency transfers SAFETY NET
                if (sourceAcc && sourceAcc.currency !== destAcc.currency) {
                    if (!tx.destinationAmount || tx.destinationAmount <= 0) {
                        // Multi-currency transfer without destinationAmount - using 1:1 fallback
                        amountIncoming = round2dec(amount); // Fallback: 1:1 to preserve Asset existence (Double Entry)
                    } else {
                        amountIncoming = round2dec(tx.destinationAmount);
                    }
                } else if (tx.destinationAmount && tx.destinationAmount > 0) {
                    // Same currency but has destinationAmount (unusual but valid)
                    amountIncoming = round2dec(tx.destinationAmount);
                }

                // Transfer In always adds to Destination
                // STRICT ROUNDING: Apply round2dec on the operation result
                destAcc.balance = FinancialPrecision.sum([destAcc.balance, amountIncoming]);
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
        if (tx.deleted) return; // ✅ IGNORE DELETED
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
                balances[split.memberId] = FinancialPrecision.subtract(balances[split.memberId], split.assignedAmount);
                totalSplitAmount = FinancialPrecision.sum([totalSplitAmount, split.assignedAmount]);
            });

            // Credit the Payer
            if (payerId === 'user') {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = FinancialPrecision.sum([balances[payerId], totalSplitAmount]);
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = FinancialPrecision.sum([balances[payerId], amount]);

                tx.sharedWith.forEach(split => {
                    if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
                    balances[split.memberId] = FinancialPrecision.subtract(balances[split.memberId], split.assignedAmount);
                });

                const totalSplit = FinancialPrecision.sum(tx.sharedWith.map(s => s.assignedAmount));
                const remainder = FinancialPrecision.subtract(amount, totalSplit);
                if (remainder > 0.01) {
                    balances['user'] = FinancialPrecision.subtract(balances['user'], remainder);
                }
            }

        } else {
            // Implicit Split logic (kept for legacy support)
            if (!tx.isShared) return;

            const allInvolved = ['user', ...participantIds];
            const splitAmount = FinancialPrecision.round(FinancialPrecision.divide(amount, allInvolved.length));

            if (payerId === 'user') {
                let myCredit = 0;
                allInvolved.forEach(pid => {
                    if (pid === 'user') return;
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] = FinancialPrecision.subtract(balances[pid], splitAmount);
                    myCredit = FinancialPrecision.sum([myCredit, splitAmount]);
                });
                if (balances['user'] === undefined) balances['user'] = 0;
                balances['user'] = FinancialPrecision.sum([balances['user'], myCredit]);
            } else {
                if (balances[payerId] === undefined) balances[payerId] = 0;
                balances[payerId] = FinancialPrecision.sum([balances[payerId], amount]);

                allInvolved.forEach(pid => {
                    if (balances[pid] === undefined) balances[pid] = 0;
                    balances[pid] = FinancialPrecision.subtract(balances[pid], splitAmount);
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

            debtor.amount = FinancialPrecision.sum([debtor.amount, amount]);
            creditor.amount = FinancialPrecision.subtract(creditor.amount, amount);
        }

        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    if (settlementLines.length === 0) {
        return ["Tudo quitado! Nenhuma pendência em aberto."];
    }

    return settlementLines;
};

/**
 * Calculates the total amount owed TO the user (Accounts Receivable).
 * Scans all transactions (history) where user paid but splits are not settled.
 * This is an ASSET and should be part of Net Worth.
 */
export const calculateTotalReceivables = (transactions: Transaction[]): number => {
    let total = 0;

    transactions.forEach(t => {
        if (t.deleted) return;
        // Ignore orphans (no account linked) - Phantom Data Protection
        if (!t.accountId) return;

        // I paid for shared expense
        if (t.type === TransactionType.EXPENSE && t.isShared && (!t.payerId || t.payerId === 'me')) {
            if (t.sharedWith && t.sharedWith.length > 0) {
                t.sharedWith.forEach(s => {
                    if (!s.isSettled) {
                        // Conversion Logic
                        let val = s.assignedAmount;
                        if (t.exchangeRate && t.exchangeRate > 0) {
                            val = FinancialPrecision.multiply(val, t.exchangeRate);
                        } else if (t.currency && t.currency !== 'BRL') {
                            // Should ideally use stored rate, fallback handled by caller or simple math
                        }
                        total = FinancialPrecision.sum([total, val]);
                    }
                });
            }
        }
    });

    return total;
};

/**
 * Calculates the total amount the user OWES to others (Accounts Payable).
 * Scans all transactions (history) where user shares the cost but someone else paid.
 * This is a LIABILITY and should be subtracted from Net Worth.
 */
export const calculateTotalPayables = (transactions: Transaction[]): number => {
    let total = 0;

    transactions.forEach(t => {
        if (t.deleted) return;

        // I owe money (Shared Expense, I am NOT payer)
        if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
            // Rule: Only consider NATIONAL (BRL) liabilities for BRL Net Worth if context allows
            if (t.currency && t.currency !== 'BRL') return;

            if (!t.isSettled) {
                // For mirror transaction, `t.amount` IS ALREADY "My Share".
                total = FinancialPrecision.sum([total, t.amount]);
            }
        }
    });

    return total;
};