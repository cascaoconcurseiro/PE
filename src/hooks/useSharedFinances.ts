import { useMemo } from 'react';
import { Transaction, FamilyMember, TransactionType, InvoiceItem } from '../types';
import { isSameMonth, parseDate } from '../utils';

interface UseSharedFinancesProps {
    transactions: Transaction[];
    members: FamilyMember[];
    currentDate: Date;
    activeTab: 'REGULAR' | 'TRAVEL' | 'HISTORY';
}

export const useSharedFinances = ({ transactions, members, currentDate, activeTab }: UseSharedFinancesProps) => {

    const invoices = useMemo(() => {
        const invoiceMap: Record<string, InvoiceItem[]> = {};
        members.forEach(m => invoiceMap[m.id] = []);

        transactions.forEach(t => {
            const isSharedExpense = t.type === TransactionType.EXPENSE && (t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me'));
            if (!isSharedExpense) return;

            const txCurrency = t.currency || 'BRL';

            // 1. CREDIT LOGIC: User Paid, Others Owe
            if (!t.payerId || t.payerId === 'me') {
                t.sharedWith?.forEach(split => {
                    if (!invoiceMap[split.memberId]) invoiceMap[split.memberId] = [];
                    invoiceMap[split.memberId].push({
                        id: `${t.id}-credit-${split.memberId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: split.assignedAmount,
                        type: 'CREDIT',
                        isPaid: !!split.isSettled,
                        tripId: t.tripId,
                        memberId: split.memberId,
                        currency: txCurrency,
                        installmentNumber: t.currentInstallment,
                        totalInstallments: t.totalInstallments
                    });
                });
            }
            // 2. DEBIT LOGIC: Other Paid, User Owes
            else {
                const payerId = t.payerId;
                if (!invoiceMap[payerId]) invoiceMap[payerId] = [];
                const totalSplits = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                const myShare = t.amount - totalSplits;

                if (myShare < 0) {
                    console.error(`❌ ERRO: Divisão maior que o total da transação!`, t);
                }

                if (myShare > 0.01) {
                    invoiceMap[payerId].push({
                        id: `${t.id}-debit-${payerId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: myShare,
                        type: 'DEBIT',
                        isPaid: !!t.isSettled,
                        tripId: t.tripId,
                        memberId: payerId,
                        currency: txCurrency,
                        installmentNumber: t.currentInstallment,
                        totalInstallments: t.totalInstallments
                    });
                }
            }
        });
        return invoiceMap;
    }, [transactions, members]);

    const getFilteredInvoice = (memberId: string) => {
        const allItems = invoices[memberId] || [];
        if (activeTab === 'TRAVEL') {
            return allItems.filter(i => !!i.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else if (activeTab === 'HISTORY') {
            // Show all SETTLED items, sorted by date descending
            return allItems.filter(i => i.isPaid).sort((a, b) => b.date.localeCompare(a.date));
        } else {
            // Only show items from the current month (same as credit card logic)
            // Each installment appears only in its respective month
            return allItems.filter(i => {
                if (i.tripId) return false;
                const itemDate = parseDate(i.date);
                return isSameMonth(itemDate, currentDate);
            }).sort((a, b) => b.date.localeCompare(a.date));
        }
    };

    const getTotals = (items: InvoiceItem[]) => {
        // Group by Currency
        const totalsByCurrency: Record<string, { credits: number, debits: number, net: number }> = {};

        items.forEach(i => {
            const curr = i.currency || 'BRL';
            if (!totalsByCurrency[curr]) totalsByCurrency[curr] = { credits: 0, debits: 0, net: 0 };

            if (!i.isPaid) {
                if (i.type === 'CREDIT') totalsByCurrency[curr].credits += i.amount;
                else totalsByCurrency[curr].debits += i.amount;
            }
        });

        Object.keys(totalsByCurrency).forEach(curr => {
            totalsByCurrency[curr].net = totalsByCurrency[curr].credits - totalsByCurrency[curr].debits;
        });

        return totalsByCurrency;
    };

    return { invoices, getFilteredInvoice, getTotals };
};
