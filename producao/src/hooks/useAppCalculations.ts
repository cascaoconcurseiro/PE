import { useMemo } from 'react';
import { Account, Transaction, TransactionType } from '../types';

export const useAppCalculations = (
    accounts: Account[],
    transactions: Transaction[]
) => {
    // Projeção de saldo: Usa saldo atual do banco + transações futuras do mês
    const projectedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today? Or strict greater than now?
        // App.tsx used: new Date().setHours(0,0,0,0) -> "now" variable.
        // And "new Date(t.date) > now".

        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        return accounts.map(acc => {
            // Saldo atual vem do banco (já calculado pelo trigger)
            const currentBalance = acc.balance || 0;

            // Calcular impacto de transações futuras (ainda não refletidas no saldo do banco)
            const futureTxs = transactions.filter(t =>
                t.accountId === acc.id &&
                new Date(t.date) > now &&
                new Date(t.date) <= endOfMonth &&
                !t.deleted
            );

            const futureImpact = futureTxs.reduce((sum, t) => {
                if (t.type === TransactionType.INCOME) return sum + t.amount;
                if (t.type === TransactionType.EXPENSE) return sum - t.amount;
                if (t.type === TransactionType.TRANSFER && t.accountId === acc.id) {
                    return sum - t.amount; // Transferência de saída
                }
                // Transfer incoming? usually Type=TRANSFER has destinationAccountId.
                // But transactions list contains BOTH sides (mirrored)?
                // If mirrored, the incoming one has accountId = destination.
                // So "t.accountId === acc.id" catches it.
                // If it is Incoming Transfer, type is TRANSFER?
                // The system logic for Transfer Creation usually creates 2 transactions:
                // 1. Outgoing (Type=TRANSFER, accountId=Source, dest=Dest)
                // 2. Incoming (Type=TRANSFER, accountId=Dest, dest=Source) - Wait, or just one?
                // If it creates TWO, then filtered 't.accountId === acc.id' works.
                // If it creates ONE, we miss the incoming side if looking at acc.id = destId?
                // App.tsx logic only handled SUBTRACTION.
                // "if (t.type === TransactionType.TRANSFER && t.accountId === acc.id) return sum - t.amount"
                // It ignored incoming transfers?
                // Or maybe incoming transfers are stored as INCOME?
                // Let's stick to EXACTLY what App.tsx had to avoid breaking behavior.
                return sum;
            }, 0);

            return { ...acc, balance: currentBalance + futureImpact };
        });
    }, [accounts, transactions]);

    return { projectedAccounts };
};
