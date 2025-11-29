import { Account, Transaction, TransactionType } from '../types';

export const getInvoiceData = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    if (!account.closingDay || !account.limit) return { invoiceTotal: 0, transactions: [], status: 'OPEN', daysToClose: 0, closingDate: new Date(), dueDate: new Date() };
    
    const currentDay = referenceDate.getDate();
    const closingDay = account.closingDay;
    
    let startCycle = new Date(referenceDate);
    let endCycle = new Date(referenceDate);
    
    if (currentDay <= closingDay) {
        startCycle.setMonth(startCycle.getMonth() - 1);
        startCycle.setDate(closingDay + 1);
        endCycle.setDate(closingDay);
    } else {
        startCycle.setDate(closingDay + 1);
        endCycle.setMonth(endCycle.getMonth() + 1);
        endCycle.setDate(closingDay);
    }
    
    startCycle.setHours(0, 0, 0, 0);
    endCycle.setHours(23, 59, 59, 999);
    
    const tempDueDate = new Date(endCycle);
    tempDueDate.setDate(account.dueDay || 10);
    if (tempDueDate < endCycle) tempDueDate.setMonth(tempDueDate.getMonth() + 1);
    
    const finalDueDate = tempDueDate;
    
    const txs = transactions.filter(t => {
        const tDate = new Date(t.date);
        return t.accountId === account.id && tDate >= startCycle && tDate <= endCycle;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const total = txs.reduce((acc, t) => {
        if (t.isRefund) return acc - t.amount;
        if (t.type === TransactionType.EXPENSE) return acc + t.amount;
        if (t.type === TransactionType.INCOME) return acc - t.amount;
        return acc;
    }, 0);
    
    const now = new Date();
    const daysToClose = Math.ceil((endCycle.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const status = endCycle < now ? 'CLOSED' : 'OPEN';
    
    return { invoiceTotal: total, transactions: txs, status, daysToClose, closingDate: endCycle, dueDate: finalDueDate };
};

export const getCommittedBalance = (account: Account, transactions: Transaction[]) => {
    const accountTxs = transactions.filter(t => t.accountId === account.id);
    const incomingTxs = transactions.filter(t => t.destinationAccountId === account.id);
    
    const totalDebt = accountTxs.reduce((acc, t) => {
        if (t.isRefund) return acc + t.amount;
        if (t.type === TransactionType.EXPENSE) return acc - t.amount;
        if (t.type === TransactionType.INCOME) return acc + t.amount;
        if (t.type === TransactionType.TRANSFER) return acc - t.amount;
        return acc;
    }, 0);
    
    const totalPayments = incomingTxs.reduce((acc, t) => acc + (t.destinationAmount || t.amount), 0);
    
    return Math.abs(totalDebt + totalPayments + (account.initialBalance || 0));
};

export const getBankExtract = (accountId: string, transactions: Transaction[]) => {
    return transactions
        .filter(t => t.accountId === accountId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};