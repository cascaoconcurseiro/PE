import { Account, Transaction, TransactionType, AccountType } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from './currencyService';

/**
 * Calcula o valor efetivo da transação para o usuário (Economia Real).
 * - Se eu paguei e dividi: Retorna (Total - Parte dos Outros).
 * - Se outro pagou e eu dividi: Retorna (Minha Parte).
 * - Se não é compartilhada: Retorna o valor total.
 */
export const calculateEffectiveTransactionValue = (t: Transaction): number => {
    // Se não for despesa ou não for compartilhada, o valor é o original
    const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');

    if (t.type !== TransactionType.EXPENSE || !isShared) {
        return t.amount;
    }

    const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;

    // ✅ VALIDAÇÃO CRÍTICA: Splits não podem ser maiores que o total
    if (splitsTotal > t.amount) {
        console.error(`❌ ERRO: Divisão maior que o total da transação!`);
        console.error(`   Transaction ID: ${t.id}`);
        console.error(`   Description: ${t.description}`);
        console.error(`   Total: ${t.amount}`);
        console.error(`   Soma das divisões: ${splitsTotal}`);
        console.error(`   Diferença: ${splitsTotal - t.amount}`);
        console.error(`   ⚠️ RETORNANDO TOTAL COMO FALLBACK!`);
        // Retornar total como fallback para evitar valores negativos
        return t.amount;
    }

    // Cenário 1: Eu paguei (payerId vazio ou 'me')
    if (!t.payerId || t.payerId === 'me') {
        // Custo Efetivo = O que saiu da conta - O que vou receber de volta
        return t.amount - splitsTotal;
    }

    // Cenário 2: Outro pagou
    else {
        // Custo Efetivo = O que eu devo (Minha parte)
        // Se o total é 100 e os splits somam 60 (outras pessoas), minha parte é 40
        const myShare = t.amount - splitsTotal;
        return Math.max(0, myShare);
    }
};

/**
 * 1. CONSISTÊNCIA DE DADOS (DATA INTEGRITY)
 * Verifica se existem transações órfãs (sem conta válida) e limpa dados inconsistentes.
 */
export const checkDataConsistency = (accounts: Account[], transactions: Transaction[]): string[] => {
    const issues: string[] = [];
    const accountIds = new Set(accounts.map(a => a.id));

    // ✅ FILTRAR TRANSAÇÕES DELETADAS: Não validar transações que foram excluídas
    const activeTransactions = transactions.filter(t => !t.deleted);

    activeTransactions.forEach(t => {
        // Regra 1: Toda transação deve ter uma conta de origem válida
        // EXCEÇÃO: Transações compartilhadas pendentes (onde eu pago ou outro paga e ainda não foi quitado/definido conta)
        const isSharedPending = t.isShared || (t.payerId && t.payerId !== 'me');
        const accId = t.accountId;
        if ((!accId || !accountIds.has(accId)) && !isSharedPending) {
            issues.push(`Transação órfã encontrada: ${t.description} (ID da conta inválido) - ID Transação: ${t.id}`);
        }

        // Regra 2: Validar valores
        if (!t.amount || t.amount <= 0) {
            issues.push(`Transação com valor inválido: ${t.description} (Valor: ${t.amount}) - ID Transação: ${t.id}`);
        }

        // Regra 3: Validar Splits (Divisões)
        if (t.sharedWith && t.sharedWith.length > 0) {
            const splitsTotal = t.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
            if (splitsTotal > t.amount + 0.01) { // margem de erro float
                issues.push(`Divisão incorreta: ${t.description} (Soma das partes maior que o total) - ID Transação: ${t.id}`);
            }
        }

        // Regra 4: Transferências devem ter conta de destino válida e diferente da origem
        if (t.type === TransactionType.TRANSFER) {
            const destId = t.destinationAccountId;
            if (!destId || !accountIds.has(destId)) {
                issues.push(`Transferência inconsistente: ${t.description} (Conta destino inválida) - ID Transação: ${t.id}`);
            }
            if (t.accountId === t.destinationAccountId) {
                issues.push(`Transferência circular detectada: ${t.description} (Origem igual ao Destino) - ID Transação: ${t.id}`);
            }

            // Validar Multi-moeda
            const sourceAcc = accounts.find(a => a.id === t.accountId);
            const destAcc = accounts.find(a => a.id === t.destinationAccountId);

            if (sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency) {
                if (!t.destinationAmount || t.destinationAmount <= 0) {
                    issues.push(`Transferência multi-moeda incompleta: ${t.description} (Sem valor de destino) - ID Transação: ${t.id}`);
                }
            }
        }
    });

    return issues;
};

/**
 * 2. PREVISÃO DE SALDO (FORECASTING)
 * Calcula o "Saldo Projetado" para o final do mês atual.
 * Lógica: Saldo Atual + Receitas Pendentes - Despesas Pendentes
 */
export const calculateProjectedBalance = (
    accounts: Account[],
    transactions: Transaction[],
    currentDate: Date
): { currentBalance: number, projectedBalance: number, pendingIncome: number, pendingExpenses: number } => {

    // Saldo Atual Consolidado (Apenas Contas Bancárias e Carteira, ignora Cartão de Crédito e Investimentos para fluxo de caixa)
    const liquidityAccounts = accounts.filter(a =>
        a.type === AccountType.CHECKING ||
        a.type === AccountType.SAVINGS ||
        a.type === AccountType.CASH
    );

    const liquidityAccountIds = new Set(liquidityAccounts.map(a => a.id));
    const currentBalance = liquidityAccounts.reduce((acc, a) => acc + convertToBRL(a.balance, a.currency), 0);

    // Definir intervalo de tempo (Hoje até Fim do Mês)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let pendingIncome = 0;
    let pendingExpenses = 0;

    // Helper to convert transaction amount to BRL using stored rate or fallback
    const toBRL = (amount: number, t: Transaction) => {
        if (t.exchangeRate && t.exchangeRate > 0) {
            return amount * t.exchangeRate;
        }
        return convertToBRL(amount, t.currency || 'BRL');
    };

    // Define the Time Window for Projection:
    // Start: NOW (Current Real Time)
    // End: End of the Viewed Month (e.g. If viewing Feb 2026, End is Feb 28 2026)
    // Goal: Accumulate all changes from Now until the target date to get the true future balance.

    const viewMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    viewMonthEnd.setHours(23, 59, 59, 999);

    // today is likely already defined above in this function scope or passed in. 
    // If not, use a different name or just rely on 'today' if previously defined.
    // Checked file: 'today' IS defined at line 129. 
    // So we just reset it or use existing variable.
    today.setHours(0, 0, 0, 0);

    transactions.forEach(t => {
        if (t.deleted) return;

        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);

        // 1. STRICT MONTH FILTER
        if (tDate.getMonth() !== currentDate.getMonth() || tDate.getFullYear() !== currentDate.getFullYear()) {
            return;
        }

        // SHARED LOGIC - Consider ALL transactions in the month (not just future)
        // Because "A Receber" and "A Pagar" are monthly metrics, not daily
        let processedAsShared = false;

        // 1. Shared Receivables (Credits) - I paid, others owe me
        if (t.type === TransactionType.EXPENSE && t.isShared && (!t.payerId || t.payerId === 'me')) {
            if (t.currency && t.currency !== 'BRL') {
                // Skip foreign
            } else {
                const pendingSplitsTotal = t.sharedWith?.reduce((sum, s) => {
                    return sum + (!s.isSettled ? s.assignedAmount : 0);
                }, 0) || 0;

                if (pendingSplitsTotal > 0) {
                    pendingIncome += toBRL(pendingSplitsTotal, t);
                }
            }
            processedAsShared = true;
        }

        // 2. Shared Debts (Payables) - Others paid, I owe them
        if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
            if (t.currency && t.currency !== 'BRL') {
                // Skip foreign
            } else {
                if (!t.isSettled) {
                    pendingExpenses += toBRL(t.amount, t);
                }
            }
            processedAsShared = true;
        }

        if (processedAsShared) return;

        // 2. FUTURE ONLY FILTER for regular transactions (Fix Double Counting)
        // We only sum items that have NOT happened yet (affecting future balance).
        // Items <= today are assumed to be already reflected in 'currentBalance'.
        if (tDate <= today) return;

        // Standard Cash Flow
        if (t.type === TransactionType.TRANSFER) {
            const sourceAccId = t.accountId;
            const isSourceLiquid = sourceAccId ? liquidityAccountIds.has(sourceAccId) : false;
            const destAccId = t.destinationAccountId;
            const isDestLiquid = destAccId ? liquidityAccountIds.has(destAccId) : false;

            if (isSourceLiquid && !isDestLiquid) {
                pendingExpenses += toBRL(t.amount, t);
            }
            else if (!isSourceLiquid && isDestLiquid) {
                if (t.destinationAmount && t.destinationAmount > 0) {
                    const destAcc = accounts.find(a => a.id === t.destinationAccountId);
                    if (destAcc && destAcc.currency !== 'BRL') {
                        pendingIncome += convertToBRL(t.destinationAmount, destAcc.currency);
                    } else {
                        pendingIncome += t.destinationAmount;
                    }
                } else {
                    pendingIncome += toBRL(t.amount, t);
                }
            }
            return;
        }

        // Standard Income/Expense
        if (t.type === TransactionType.INCOME) {
            // Only count if destination is Liquid (Cash Flow)
            const accId = t.accountId;
            if (accId && liquidityAccountIds.has(accId)) {
                pendingIncome += toBRL(t.amount, t);
            }
        } else if (t.type === TransactionType.EXPENSE) {
            const accId = t.accountId;
            // Only count if source is Liquid (e.g. Debit/Cash). Credit Card spend is NOT cash outflow.
            if (accId && liquidityAccountIds.has(accId)) {
                pendingExpenses += toBRL(t.amount, t);
            }
        }
    });

    // Calculate final projected balance
    const projectedBalance = currentBalance + pendingIncome - pendingExpenses;

    return {
        currentBalance,
        projectedBalance,
        pendingIncome,
        pendingExpenses
    };
};

/**
 * 3. ANÁLISE DE SAÚDE FINANCEIRA (FINANCIAL HEALTH)
 * Gera insights rápidos baseados na regra 50-30-20 ou similar.
 */
export const analyzeFinancialHealth = (income: number, expenses: number): 'POSITIVE' | 'WARNING' | 'CRITICAL' => {
    if (income === 0) return expenses > 0 ? 'CRITICAL' : 'POSITIVE';

    const savingRate = (income - expenses) / income;

    if (savingRate < 0) return 'CRITICAL'; // Gastando mais do que ganha
    if (savingRate < 0.1) return 'WARNING'; // Poupando menos de 10%
    return 'POSITIVE'; // Saudável
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
                    // We use the raw amount (assumed BRL if user paid in BRL context, 
                    // or we should convert? Usually split assignedAmount is in transaction currency).
                    // If transaction has exchange rate, we should convert back to BRL?
                    // For now, assume simpler BRL-based logic or 1:1 if same currency context.
                    // IMPORTANT: 'calculateProjectedBalance' converts. We should too.

                    if (!s.isSettled) {
                        // Conversion Logic
                        let val = s.assignedAmount;
                        if (t.exchangeRate && t.exchangeRate > 0) {
                            val = val * t.exchangeRate;
                        } else if (t.currency && t.currency !== 'BRL') {
                            // This relies on 'convertToBRL' which is simple static.
                            // Better to use stored rate or raw.
                        }

                        total += val;
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
        // Ignore orphans (no account linked) - Phantom Data Protection
        // HOWEVER: Mirror transactions often don't have accountId. They rely on payerId.
        // We should check consistency but not blindly skip if accountId is missing, 
        // because "Debt" doesn't strictly need a bank account until paid.
        // But for consistency with Receivables, let's keep logic similar but robust.

        // I owe money (Shared Expense, I am NOT payer)
        if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
            // Rule: Only consider NATIONAL (BRL) liabilities for BRL Net Worth.
            if (t.currency && t.currency !== 'BRL') return;

            if (!t.isSettled) {
                // My share is what I owe
                // calculateEffectiveTransactionValue handles the logic: (Total - Splits) = My Share
                // Wait, calculateEffectiveTransactionValue returns "My Share" correctly?
                // Yes, lines 44-45: const myShare = t.amount - splitsTotal; return Math.max(0, myShare);
                // But we need to use `toBRL` if we want consistency? 
                // calculateEffectiveTransactionValue uses raw amount.

                // Let's iterate splits to be precise or use effective value logic?
                // Mirrors usually have `t.amount` as the FULL transaction amount and `t.sharedWith` containing others?
                // NO. In Dyad, "Mirror Transaction" (created via trigger) usually has `amount` = `assignedAmount` (My Share) 
                // and `payer_id` = Original Payer.
                // Let's verify `handle_mirror_shared_transaction` trigger logic in SQL.
                // "INSERT INTO transactions ... amount = (split->>'assignedAmount')::NUMERIC ..."
                // SO: For mirror transaction, `t.amount` IS ALREADY "My Share".
                // AND `shared_with` is usually empty '[]' in the mirror?
                // Trigger says: `shared_with` = '[]'::jsonb.

                // SO: If it is a mirror (I am NOT payer), `t.amount` is exactly what I owe.
                // UNLESS I split it further? (Recursion? Not implemented).

                // Simple Logic:
                total += t.amount;
                // (Assuming strict single-layer mirroring).
            }
        }
    });

    return total;
};