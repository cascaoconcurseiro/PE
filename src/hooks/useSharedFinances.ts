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

        console.log('🔍 DEBUG useSharedFinances - Processando transações:', {
            totalTransactions: transactions.length,
            sharedTransactions: transactions.filter(t => 
                t.type === TransactionType.EXPENSE && 
                (t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me'))
            ).length,
            members: members.map(m => ({ id: m.id, name: m.name }))
        });

        transactions.forEach(t => {
            const isSharedExpense = t.type === TransactionType.EXPENSE && (t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me'));
            
            if (!isSharedExpense) return;

            console.log('📝 Processando transação compartilhada:', {
                id: t.id,
                description: t.description,
                amount: t.amount,
                date: t.date,
                payerId: t.payerId,
                sharedWith: t.sharedWith
            });

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
                        totalInstallments: t.totalInstallments,
                        creatorUserId: (t.payerId && t.payerId !== 'me') ? t.payerId : t.userId
                    });
                });
            }
            // 2. DEBIT LOGIC: Other Paid, User Owes
            else {
                // Fix: Map Payer UserID to MemberID
                // The payerId on the transaction is the Auth User ID (UUID).
                // We need to group it under the Family Member ID.
                let payerMember = members.find(m => m.linkedUserId === t.payerId);

                // FALLBACK: Fuzzy Match by Name from Description
                // If database link is missing, try to parse "(Compartilhado por NAME)"
                if (!payerMember && t.description) {
                    const match = t.description.match(/\(Compartilhado por (.*?)\)/);
                    if (match && match[1]) {
                        const nameToFind = match[1].trim().toLowerCase();
                        payerMember = members.find(m => m.name.toLowerCase() === nameToFind || m.name.split(' ')[0].toLowerCase() === nameToFind);
                    }
                }

                const targetMemberId = payerMember ? payerMember.id : t.payerId;

                // Safety check: specific member might not exist in local list yet (sync lag)
                // If so, we might need a fallback 'Unknown' bucket or similar, but for now we create the entry on the fly 
                // if it matches a known structure, or just skip/log.
                // If we use targetMemberId and it's not in invoiceMap (initially populated by members), we must init it.
                if (!invoiceMap[targetMemberId]) invoiceMap[targetMemberId] = [];

                // CORREÇÃO: Verificar se EU estou no shared_with como devedor
                // Se sim, usar o meu assignedAmount diretamente
                const myUserId = t.userId; // ID do usuário atual (dono da transação)
                const mySplit = t.sharedWith?.find(s => s.memberId === myUserId);
                
                let myShare: number;
                if (mySplit) {
                    // EU estou explicitamente no shared_with, usar o valor atribuído
                    myShare = mySplit.assignedAmount;
                } else {
                    // Lógica antiga: calcular o resto (para compatibilidade)
                    const totalSplits = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                    myShare = t.amount - totalSplits;
                }

                if (myShare < 0) {
                    // Divisão maior que o total da transação - erro de dados
                    console.warn('Divisão maior que o total da transação:', t.id);
                }

                if (myShare > 0.01) {
                    invoiceMap[targetMemberId].push({
                        id: `${t.id}-debit-${targetMemberId}`,
                        originalTxId: t.id,
                        description: t.description,
                        date: t.date,
                        category: t.category as string,
                        amount: myShare,
                        type: 'DEBIT',
                        isPaid: !!t.isSettled,
                        tripId: t.tripId,
                        memberId: targetMemberId,
                        currency: txCurrency,
                        installmentNumber: t.currentInstallment,
                        totalInstallments: t.totalInstallments,
                        creatorUserId: (t.payerId && t.payerId !== 'me') ? t.payerId : t.userId
                    });
                }
            }
        });
        return invoiceMap;
    }, [transactions, members]);

    const getFilteredInvoice = (memberId: string) => {
        const allItems = invoices[memberId] || [];
        
        // DEBUG: Log para ver o que está sendo filtrado
        console.log('🔍 DEBUG getFilteredInvoice:', {
            memberId,
            activeTab,
            currentDate: currentDate.toISOString(),
            totalItems: allItems.length,
            itemDates: allItems.map(i => i.date).slice(0, 5)
        });
        
        if (activeTab === 'TRAVEL') {
            return allItems.filter(i => !!i.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else if (activeTab === 'HISTORY') {
            // Show all SETTLED items, sorted by date descending
            return allItems.filter(i => i.isPaid).sort((a, b) => b.date.localeCompare(a.date));
        } else {
            // Only show items from the current month (same as credit card logic)
            // Each installment appears only in its respective month
            const filtered = allItems.filter(i => {
                if (i.tripId) return false;
                const itemDate = parseDate(i.date);
                const matches = isSameMonth(itemDate, currentDate);
                
                // DEBUG: Log cada item
                if (!matches && allItems.length < 20) {
                    console.log('❌ Item filtrado:', {
                        description: i.description,
                        itemDate: itemDate.toISOString(),
                        currentDate: currentDate.toISOString(),
                        matches
                    });
                }
                
                return matches;
            }).sort((a, b) => b.date.localeCompare(a.date));
            
            console.log('✅ Itens após filtro:', filtered.length);
            return filtered;
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
