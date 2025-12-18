import { Transaction, Account, Asset, Trip } from '../types';
import { formatCurrency } from '../utils';

export const exportToCSV = (data: (string | number | undefined)[][], headers: string[], filename: string) => {
    const csvContent = [
        headers.join(';'), // CSV Header using semicolon for Excel PT-BR compatibility
        ...data.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const printComponent = () => {
    window.print();
};

// Formatters for specific data types
export const prepareTransactionsForExport = (transactions: Transaction[], accounts: Account[]) => {
    return transactions.map(t => {
        const accountName = accounts.find(a => a.id === t.accountId)?.name || 'N/A';
        const destAccountName = t.destinationAccountId ? accounts.find(a => a.id === t.destinationAccountId)?.name : '';
        
        return [
            new Date(t.date).toLocaleDateString('pt-BR'),
            t.description,
            t.category,
            t.type,
            accountName,
            destAccountName,
            t.amount.toFixed(2).replace('.', ',') // Excel PT-BR format
        ];
    });
};

export const prepareAssetsForExport = (assets: Asset[]) => {
    return assets.map(a => [
        a.ticker,
        a.name,
        a.type,
        a.quantity.toString().replace('.', ','),
        a.averagePrice.toFixed(2).replace('.', ','),
        a.currentPrice.toFixed(2).replace('.', ','),
        (a.quantity * a.currentPrice).toFixed(2).replace('.', ',')
    ]);
};

export const prepareTripExpensesForExport = (transactions: Transaction[]) => {
    return transactions.map(t => [
        new Date(t.date).toLocaleDateString('pt-BR'),
        t.description,
        t.category as string,
        t.payerId ? 'Outro' : 'Eu', // Using correct property payerId
        t.amount.toFixed(2).replace('.', ',')
    ]);
};