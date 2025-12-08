import { Account, Transaction, TransactionType, Category } from '../types';
import { shouldShowTransaction } from '../utils/transactionFilters';


export const getInvoiceData = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    // Default fallback
    if (!account.closingDay || !account.limit) {
        return {
            invoiceTotal: 0,
            transactions: [],
            status: 'OPEN',
            daysToClose: 0,
            closingDate: new Date(),
            dueDate: new Date()
        };
    }

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const closingDay = account.closingDay;

    // DEFINIÇÃO DE FATURA:
    // A fatura de "Maio" é aquela que FECHA em Maio.
    // Ex: Fecha dia 5. Fatura de Maio fecha 05/05. Período: 06/04 a 05/05.
    // Ex: Fecha dia 25. Fatura de Maio fecha 25/05. Período: 26/04 a 25/05.

    // Calcular Data de Fechamento desta fatura de referência
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

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = closingDate.toISOString().split('T')[0];

    const activeTransactions = transactions.filter(shouldShowTransaction);

    // FILTRAGEM ROBUSTA
    const txs = activeTransactions.filter(t => {
        if (t.accountId !== account.id) return false;

        // 1. Verificar Intervalo de Datas (Padrão)
        // Se a transação estiver entre Start e End, ela entra.
        if (t.date >= startStr && t.date <= endStr) return true;

        // 2. Verificar Parcelas e Importações (Filtro por Mês de Referência)
        // Se for parcela ou saldo inicial, forçamos a entrada se bater com o Mês/Ano da Fatura (Closing Date)
        // Isso resolve problemas de faturas importadas com data exata do fechamento ou parcelas em dias limítrofes.
        const isSpecial = t.isInstallment || t.category === Category.OPENING_BALANCE;
        if (isSpecial) {
            const [tY, tM] = t.date.split('-').map(Number);
            // Comparar com o mês/ano do fechamento desta fatura
            if (tY === closingDate.getFullYear() && (tM - 1) === closingDate.getMonth()) {
                return true;
            }
        }

        return false;
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

    // Status simples: Se a data de fechamento já passou, está FECHADA. Se não, ABERTA.
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
    // 1. Determine the cutoff date (End of the selected month)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    // Day 0 of next month is the last day of this month
    const endOfPeriod = new Date(year, month + 1, 0);
    const endStr = endOfPeriod.toISOString().split('T')[0];

    // 2. Filter transactions: specific account, not deleted, date <= endOfPeriod
    const activeTransactions = transactions.filter(shouldShowTransaction);

    // Transactions where this account is the source
    const accountTxs = activeTransactions.filter(t => t.accountId === account.id && t.date <= endStr);

    // Transactions where this account is the destination (Transfers)
    const incomingTxs = activeTransactions.filter(t => t.destinationAccountId === account.id && t.date <= endStr);

    // 3. Sum up Source Transactions (Expenses reduce, Incomes increase)
    const balanceChange = accountTxs.reduce((acc, t) => {
        if (t.type === TransactionType.EXPENSE) return acc - t.amount;
        if (t.type === TransactionType.INCOME) return acc + t.amount;
        // Refunds on expenses: Increase balance (reverse expense)
        if (t.isRefund) return acc + t.amount;

        // Transfer Out: Reduces balance
        if (t.type === TransactionType.TRANSFER) return acc - t.amount;

        return acc;
    }, 0);

    // 4. Sum up Incoming Transactions (Transfers In increase balance)
    const incomingTotal = incomingTxs.reduce((acc, t) => {
        return acc + (t.destinationAmount || t.amount);
    }, 0);

    // 5. Add Initial Balance
    // Initial Balance is the starting point.
    // If we assume initialBalance is "at start of time", this works.
    return (account.initialBalance || 0) + balanceChange + incomingTotal;
};

export const getBankExtract = (accountId: string, transactions: Transaction[], referenceDate?: Date) => {
    // Filter out deleted transactions and unpaid debts
    let txs = transactions
        .filter(t => shouldShowTransaction(t) && t.accountId === accountId);

    if (referenceDate) {
        // Filter by month/year of referenceDate
        const targetMonth = referenceDate.getMonth();
        const targetYear = referenceDate.getFullYear();

        txs = txs.filter(t => {
            const tDate = new Date(t.date);
            // Use local date parts to match user expectation (avoid timezone shifts)
            // Ideally we should use ISO strings or a utility like isSameMonth
            // But here raw date parts usually work since inputs are YYYY-MM-DD
            // Let's use string checks for safety against timezone shifts
            const [y, m] = t.date.split('-').map(Number);
            return y === targetYear && (m - 1) === targetMonth; // m is 1-indexed in split
        });
    }

    return txs.sort((a, b) => b.date.localeCompare(a.date));
};