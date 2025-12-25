import { Account, Transaction, TransactionType, Category } from '../types';
import { shouldShowTransaction } from '../utils/transactionFilters';

/**
 * Converte uma string de data YYYY-MM-DD para um objeto Date normalizado (meia-noite UTC)
 * Isso evita problemas de timezone na comparação de datas
 */
const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Formata uma Date para string YYYY-MM-DD usando data local (não UTC)
 * Isso evita o problema de timezone onde 2025-12-05 vira 2025-12-04 em UTC-3
 */
const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getInvoiceData = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    // Default fallback - only require closingDay for date calculations
    // Limit is optional (used for utilization percentage, not invoice total)
    if (!account.closingDay) {
        return {
            invoiceTotal: 0,
            transactions: [],
            status: 'OPEN',
            daysToClose: 0,
            closingDate: new Date(),
            dueDate: new Date()
        };
    }

    // STRICT MONTH-BASED LOGIC
    // We ignore the 'day' of the referenceDate.
    // "December Reference" -> Invoice that closes in December.
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const closingDay = account.closingDay;

    // Calcular Data de Fechamento desta fatura de referência (Mês/Ano fixos)
    const closingDate = new Date(year, month, closingDay);

    // Calcular Data de Início (Fechamento do mês anterior + 1 dia)
    const startDate = new Date(year, month - 1, closingDay + 1);

    // Calcular Data de Vencimento
    const dueDate = new Date(closingDate);
    dueDate.setDate(account.dueDay || 10);

    // Ajuste de Vencimento: Se dia vcto < dia fechamento, pula pro próximo mês
    if (account.dueDay && account.dueDay < closingDay) {
        dueDate.setMonth(dueDate.getMonth() + 1);
    }
    // Safety: Se por algum motivo vcto ficou antes do fechamento
    else if (dueDate < closingDate) {
        dueDate.setMonth(dueDate.getMonth() + 1);
    }

    // Usar formatação local para evitar problemas de timezone
    const startStr = formatLocalDate(startDate);
    const endStr = formatLocalDate(closingDate);

    const activeTransactions = transactions.filter(shouldShowTransaction);

    // ✅ FIX: Incluir faturas pendentes (isPendingInvoice) na visualização da fatura
    // Mesmo que não apareçam em transações gerais, devem aparecer na fatura do cartão
    const pendingInvoices = transactions.filter(t => 
        !t.deleted && 
        t.accountId === account.id && 
        (t as any).isPendingInvoice && 
        !t.isSettled
    );

    const allTransactionsForInvoice = [...activeTransactions, ...pendingInvoices];

    // FILTRAGEM ROBUSTA - Apenas por intervalo de datas
    const txs = allTransactionsForInvoice.filter(t => {
        if (t.accountId !== account.id) return false;

        // 1. Verificar Intervalo de Datas (Padrão)
        const inRange = t.date >= startStr && t.date <= endStr;
        return inRange;
    });

    const finalTxs = txs.sort((a, b) => b.date.localeCompare(a.date));

    const total = finalTxs.reduce((acc, t) => {
        if (t.isRefund) return acc - t.amount;
        if (t.type === TransactionType.EXPENSE) return acc + t.amount;
        if (t.type === TransactionType.INCOME) return acc - t.amount;
        return acc;
    }, 0);

    const now = new Date();
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const closingZero = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());

    // Status: FECHADA se data ATUAL > data fechamento.
    const status = closingZero < nowZero ? 'CLOSED' : 'OPEN';
    const daysToClose = Math.ceil((closingZero.getTime() - nowZero.getTime()) / (1000 * 3600 * 24));

    return {
        invoiceTotal: total,
        transactions: finalTxs,
        status,
        daysToClose,
        closingDate,
        dueDate
    };
};

export const getCommittedBalance = (account: Account, transactions: Transaction[]) => {
    // Filter out deleted transactions and unpaid debts
    const activeTransactions = transactions.filter(shouldShowTransaction);

    const accountTxs = activeTransactions.filter(t => t.accountId === account.id);
    const incomingTxs = activeTransactions.filter(t => t.destinationAccountId === account.id);

    const totalDebt = accountTxs.reduce((acc, t) => {
        if (t.isRefund) return acc + t.amount;
        if (t.type === TransactionType.EXPENSE) return acc - t.amount;
        if (t.type === TransactionType.INCOME) return acc + t.amount;
        if (t.type === TransactionType.TRANSFER) return acc - t.amount;
        return acc;
    }, 0);

    const totalPayments = incomingTxs.reduce((acc, t) => acc + (t.destinationAmount || t.amount), 0);

    return totalDebt + totalPayments + (account.initialBalance || 0);
};

export const calculateHistoricalBalance = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    // REVERSE CALCULATION STRATEGY (Scalability)
    // Instead of summing from 0 (Start of Time) -> Date,
    // We start from Current Balance (DB Authoritative) and subtract transactions > Date.
    // Logic: Balance @ Date = CurrentBalance - Sum(Transactions happened AFTER Date)

    // 1. Get Current Balance (Anchor)
    let computedBalance = account.balance || 0;

    // 2. Determine Cutoff Date (End of selected month)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const endOfPeriod = new Date(year, month + 1, 0);
    // Set to end of day to be inclusive of transactions on that day?
    // Actually, we want to subtract transactions that happened STRICTLY AFTER this date.
    // If a transaction happened on endOfPeriod, it is INCLUDED in the historical balance.
    // So we subtract transactions where date > endOfPeriod.

    // Use string comparison to match existing logic style and avoid timezone issues
    const endStr = formatLocalDate(endOfPeriod);

    // 3. Filter "Future" Transactions (Transactions that happened AFTER the view date)
    // We only process Active transactions.
    const futureTransactions = transactions.filter(t => {
        if (!shouldShowTransaction(t)) return false;
        if (t.accountId !== account.id && t.destinationAccountId !== account.id) return false;

        // Check if transaction is AFTER the period
        return t.date > endStr;
    });

    // 4. Reverse the specific transactions
    futureTransactions.forEach(t => {
        // If it's an INCOME (added to balance), we SUBTRACT it to go back in time.
        // If it's an EXPENSE (removed from balance), we ADD it back.

        // Case A: I am the Source (Expense or Transfer Out)
        if (t.accountId === account.id) {
            if (t.type === TransactionType.INCOME) {
                // It added money. Remove it.
                computedBalance -= t.amount;
            } else if (t.type === TransactionType.EXPENSE) {
                // It removed money. Add it back.
                // Handle refunds: Refund puts money back. So to reverse, we subtract(?)
                // Refund Logic: isRefund=true, Amount is positive, but semantically 'Credit'.
                // Expense limit logic: usually Expense decreases. Refund increases.
                if (t.isRefund) {
                    computedBalance -= t.amount;
                } else {
                    computedBalance += t.amount;
                }
            } else if (t.type === TransactionType.TRANSFER) {
                // Transfer OUT removed money. Add it back.
                computedBalance += t.amount;
            }
        }

        // Case B: I am the Destination (Transfer In)
        if (t.destinationAccountId === account.id) {
            // It was a Transfer IN. It added money. Remove it.
            const val = t.destinationAmount || t.amount;
            computedBalance -= val;
        }
    });

    return computedBalance;
};

export const getBankExtract = (accountId: string, transactions: Transaction[], referenceDate?: Date) => {
    // Filter out deleted transactions and unpaid debts
    // Include transactions where this account is SOURCE or DESTINATION (for transfers)
    let txs = transactions.filter(t => {
        if (!shouldShowTransaction(t)) return false;
        // Include if this account is the source
        if (t.accountId === accountId) return true;
        // Include if this account is the destination of a transfer
        if (t.destinationAccountId === accountId && t.type === TransactionType.TRANSFER) return true;
        return false;
    });

    if (referenceDate) {
        // Filter by month/year of referenceDate
        const targetYear = referenceDate.getFullYear();
        const targetMonth = referenceDate.getMonth();

        // Use string comparison for consistency and timezone safety
        const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-31`;

        txs = txs.filter(t => {
            const dateStr = t.date.split('T')[0];
            return dateStr >= monthStart && dateStr <= monthEnd;
        });
    }

    return txs.sort((a, b) => b.date.localeCompare(a.date));
};