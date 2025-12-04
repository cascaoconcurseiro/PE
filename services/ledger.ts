import { Transaction, TransactionType, Account, Category } from '../types';
import { shouldShowTransaction } from '../utils/transactionFilters';


export interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    debit: string;  // Account Name or Category Name
    credit: string; // Account Name or Category Name
    amount: number;
}

export interface TrialBalanceItem {
    accountName: string;
    debit: number;
    credit: number;
    balance: number; // debit - credit
}

/**
 * Generates a Double-Entry Ledger from the list of transactions.
 * This transforms the single-entry transaction model into a double-entry view.
 */
export const generateLedger = (transactions: Transaction[], accounts: Account[]): LedgerEntry[] => {
    const accountMap = new Map(accounts.map(a => [a.id, a.name]));
    const accountIds = new Set(accounts.map(a => a.id));
    const getAccountName = (id: string) => accountMap.get(id) || 'Conta Desconhecida';

    const ledger: LedgerEntry[] = [];

    // Filter out deleted transactions and unpaid debts
    const activeTransactions = transactions.filter(shouldShowTransaction);

    activeTransactions.forEach(tx => {
        if (!tx.amount || tx.amount <= 0) return;

        // ✅ VALIDAÇÃO CRÍTICA: Ignorar transações órfãs (conta deletada)
        if (!accountIds.has(tx.accountId)) {
            console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (conta: ${tx.accountId})`);
            return;
        }

        // ✅ VALIDAÇÃO CRÍTICA: Para transferências, verificar se destino existe
        if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
            if (!accountIds.has(tx.destinationAccountId)) {
                console.warn(`⚠️ Transação órfã ignorada no ledger: ${tx.description} (destino: ${tx.destinationAccountId})`);
                return;
            }
        }

        const date = tx.date;
        const description = tx.description;
        const amount = tx.amount;

        if (tx.type === TransactionType.EXPENSE) {
            // Expense: Debit Category, Credit Account
            // If it's a refund, it's reversed: Debit Account, Credit Category
            if (tx.isRefund) {
                ledger.push({
                    id: tx.id,
                    date,
                    description: `Reembolso: ${description}`,
                    debit: getAccountName(tx.accountId),
                    credit: tx.category,
                    amount
                });
            } else {
                ledger.push({
                    id: tx.id,
                    date,
                    description,
                    debit: tx.category,
                    credit: getAccountName(tx.accountId),
                    amount
                });
            }
        } else if (tx.type === TransactionType.INCOME) {
            // Income: Debit Account, Credit Category (Source)
            if (tx.isRefund) {
                // Refund of Income? Rare, but: Debit Category, Credit Account
                ledger.push({
                    id: tx.id,
                    date,
                    description: `Estorno: ${description}`,
                    debit: tx.category,
                    credit: getAccountName(tx.accountId),
                    amount
                });
            } else {
                ledger.push({
                    id: tx.id,
                    date,
                    description,
                    debit: getAccountName(tx.accountId),
                    credit: tx.category,
                    amount
                });
            }
        } else if (tx.type === TransactionType.TRANSFER) {
            // Transfer: Debit Destination, Credit Source
            const sourceName = getAccountName(tx.accountId);
            const destName = tx.destinationAccountId ? getAccountName(tx.destinationAccountId) : 'Externo';

            ledger.push({
                id: tx.id,
                date,
                description,
                debit: destName,
                credit: sourceName,
                amount
            });
        }
    });

    return ledger.sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Calculates the Trial Balance (Balancete de Verificação).
 * Shows the total Debits and Credits for each account/category.
 */
export const getTrialBalance = (ledger: LedgerEntry[]): TrialBalanceItem[] => {
    const balances = new Map<string, { debit: number, credit: number }>();

    const ensureAccount = (name: string) => {
        if (!balances.has(name)) {
            balances.set(name, { debit: 0, credit: 0 });
        }
    };

    ledger.forEach(entry => {
        ensureAccount(entry.debit);
        ensureAccount(entry.credit);

        balances.get(entry.debit)!.debit += entry.amount;
        balances.get(entry.credit)!.credit += entry.amount;
    });

    return Array.from(balances.entries()).map(([name, val]) => ({
        accountName: name,
        debit: val.debit,
        credit: val.credit,
        balance: val.debit - val.credit
    })).sort((a, b) => a.accountName.localeCompare(b.accountName));
};
