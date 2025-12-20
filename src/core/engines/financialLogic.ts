import { Account, Transaction, TransactionType, AccountType } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from './currencyService';
import { FinancialPrecision } from './financialPrecision';

/**
 * Calcula o valor efetivo da transação para o usuário (Economia Real).
 * - Se eu paguei e dividi: Retorna (Total - Parte dos Outros).
 * - Se outro pagou e eu dividi: Retorna (Minha Parte).
 * - Se não é compartilhada: Retorna o valor total.
 */
export const calculateEffectiveTransactionValue = (t: Transaction): number => {
    // Safety Fallback for invalid amounts
    const safeAmount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;

    // Se não for despesa ou não for compartilhada, o valor é o original
    const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');

    if (t.type !== TransactionType.EXPENSE || !isShared) {
        return safeAmount;
    }

    const splitsTotal = FinancialPrecision.sum(t.sharedWith?.map(s => s.assignedAmount || 0) || []);

    // ✅ VALIDAÇÃO CRÍTICA: Splits não podem ser maiores que o total
    if (splitsTotal > safeAmount) {
        // Retornar total como fallback para evitar valores negativos
        return safeAmount;
    }

    // Cenário 1: Eu paguei (payerId vazio ou 'me')
    if (!t.payerId || t.payerId === 'me') {
        // Custo Efetivo = O que saiu da conta - O que vou receber de volta
        return FinancialPrecision.subtract(safeAmount, splitsTotal);
    }

    // Cenário 2: Outro pagou
    else {
        // Custo Efetivo = O que eu devo (Minha parte)
        // Se o total é 100 e os splits somam 60 (outras pessoas), minha parte é 40
        const myShare = FinancialPrecision.subtract(safeAmount, splitsTotal);
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
    const currentBalance = liquidityAccounts.reduce((acc, a) => FinancialPrecision.sum([acc, convertToBRL(a.balance, a.currency)]), 0);

    // Definir intervalo de tempo (Hoje até Fim do Mês)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let pendingIncome = 0;
    let pendingExpenses = 0;

    // Helper to convert transaction amount to BRL using stored rate or fallback
    const toBRL = (amount: number, t: Transaction) => {
        // Safety First
        if (amount === undefined || amount === null || isNaN(amount)) return 0;

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

        // STRICT MONTH FILTER (User Request: "Só aparecer o projeto do mês")
        const isViewMonth = tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
        if (!isViewMonth) return;

        // SHARED LOGIC
        // We check for Shared Unsettled items within THIS MONTH.
        let processedAsShared = false;

        const isSharedContext = t.isShared || (t.payerId && t.payerId !== 'me');

        if (isSharedContext) {
            // 1. Receivables (I paid, others owe me)
            if (t.type === TransactionType.EXPENSE && (!t.payerId || t.payerId === 'me')) {
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

            // 2. Payables (Others paid, I owe them)
            if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me') {
                if (t.currency && t.currency !== 'BRL') {
                    // Skip foreign
                } else {
                    if (!t.isSettled) {
                        pendingExpenses += toBRL(t.amount, t);
                    }
                }
                processedAsShared = true;
            }
        }

        // Cash Flow Impact Logic
        // IF I am the Payer (or Personal Expense), it affects my Cash Flow.
        // IF I am NOT the Payer (Debt), it does NOT affect my Cash Flow (Liquidity) YET (until I pay it).
        // The "processedAsShared" block above handled the "A Pagar" (Liability) visualization.
        // But for "Projected Balance", we usually exclude non-cash liabilities unless they are due?

        // Filter out non-cash debts from "Pending Expenses" calculation for PROJECTION?
        // Pending Expenses = Sum of Liquid Withdrawals to come.
        // A Shared Debt (I owe Friend) is NOT a bank withdrawal yet. 
        // However, User usually wants to see it in "A Pagar".

        // If processedAsShared (I owe someone), we added to pendingExpenses. 
        // Does this reduce Projected Balance? Yes (Balance - Expenses).
        // This is correct: My projected wealth at end of month is lower because I owe money.

        if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me') {
            return; // Purely debt/credit logic, no personal bank flow.
        }

        // STANDARD LOGIC (Cash Flow)
        // Must be FUTURE (> Today) to be "Pending"
        if (tDate <= today) return;

        if (t.type === TransactionType.TRANSFER) {
            const sourceAccId = t.accountId;
            const isSourceLiquid = sourceAccId ? liquidityAccountIds.has(sourceAccId) : false;
            const destAccId = t.destinationAccountId;
            const isDestLiquid = destAccId ? liquidityAccountIds.has(destAccId) : false;

            if (isSourceLiquid && !isDestLiquid) {
                // Logic Update 2025-12-17: Transfer to Credit Card IS an Expense (Bill Payment)
                // in the context of Cash Flow for the Checking Account.
                pendingExpenses += toBRL(t.amount, t);
            }
            else if (!isSourceLiquid && isDestLiquid) {
                // Receiving from non-liquid (e.g. Loan, Investment Withdrawal) is Income
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
            // Logic Update: What if Source is Liquid AND Dest is Credit Card?
            // Already covered by first 'if' (SourceLiquid && !DestLiquid).
            // Credit Card accounts are NOT in 'liquidityAccountIds'.
            // So Transfer Checking -> Credit Card = PendingExpense. CORRECT.

            return;
        }

        // Standard Income/Expense
        // Proteção contra NaN
        const safeAmount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;

        if (t.type === TransactionType.INCOME) {
            const accId = t.accountId;
            if (accId && liquidityAccountIds.has(accId)) {
                pendingIncome += toBRL(safeAmount, t);
            }
        } else if (t.type === TransactionType.EXPENSE) {
            const accId = t.accountId;
            if (accId && liquidityAccountIds.has(accId)) {
                pendingExpenses += toBRL(safeAmount, t);
            }
        }
    });

    // Calculate final projected balance
    const projectedBalance = FinancialPrecision.sum([currentBalance, pendingIncome, -pendingExpenses]);

    return {
        currentBalance: FinancialPrecision.round(currentBalance),
        projectedBalance: FinancialPrecision.round(projectedBalance),
        pendingIncome: FinancialPrecision.round(pendingIncome),
        pendingExpenses: FinancialPrecision.round(pendingExpenses)
    };
};

/**
 * 3. ANÁLISE DE SAÚDE FINANCEIRA (FINANCIAL HEALTH)
 * Gera insights rápidos baseados na regra 50-30-20 ou similar.
 */
export const analyzeFinancialHealth = (income: number, expenses: number): 'POSITIVE' | 'WARNING' | 'CRITICAL' => {
    // Validar se os valores são números válidos
    const safeIncome = (income !== undefined && income !== null && !isNaN(income)) ? income : 0;
    const safeExpenses = (expenses !== undefined && expenses !== null && !isNaN(expenses)) ? expenses : 0;

    if (safeIncome === 0) return safeExpenses > 0 ? 'CRITICAL' : 'POSITIVE';

    const savingRate = (safeIncome - safeExpenses) / safeIncome;

    if (savingRate < 0) return 'CRITICAL'; // Gastando mais do que ganha
    if (savingRate < 0.1) return 'WARNING'; // Poupando menos de 10%
    return 'POSITIVE'; // Saudável
};

/**
 * 4. DADOS DE FLUXO DE CAIXA (CASH FLOW)
 * Calcula a evolução do saldo e receitas/despesas para o gráfico anual.
 * Recebe transações JÁ FILTRADAS pelo hook (dashboardTransactions).
 */
export const calculateCashFlowData = (
    transactions: Transaction[],
    accounts: Account[],
    selectedYear: number
): { date: Date, month: string, year: number, monthIndex: number, Receitas: number, Despesas: number, Acumulado: number | null }[] => {

    // 1. Get Initial Accumulated Balance (Net Worth Anchor)
    // We start with Current Balance and work backwards/forwards
    const liquidityAccounts = accounts.filter(a =>
        a.type === AccountType.CHECKING ||
        a.type === AccountType.SAVINGS ||
        a.type === AccountType.CASH ||
        a.type === AccountType.CREDIT_CARD
    );

    let accumulated = liquidityAccounts.reduce((sum, a) => {
        const safeBalance = (a.balance !== undefined && a.balance !== null && !isNaN(a.balance)) ? a.balance : 0;
        const val = convertToBRL(safeBalance, a.currency || 'BRL');
        if (a.type === AccountType.CREDIT_CARD) {
            return sum - Math.abs(val);
        }
        return sum + val;
    }, 0);

    // 2. Adjust Balance to reach Jan 1st of Selected Year
    const startOfYear = new Date(selectedYear, 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Sort to be safe? Hook logic iterated "dashboardTransactions".
    // We need to reverse-engineer from Now to Start of Year.
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    transactions.forEach(t => {
        // NOTE: Logic copied from hook requires careful understanding.
        // Hook iterates ALL dashboardTransactions for the time travel, NOT just selected year.
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);

        // Effective Amount Logic
        let amount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
        if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
            amount = calculateEffectiveTransactionValue(t);
        }

        const account = accounts.find(a => a.id === t.accountId);
        if (account && account.currency && account.currency !== 'BRL') return; // Double check BRL Strictness

        const amountBRL = convertToBRL(amount, account?.currency || 'BRL');

        // Logic Re-use from Hook
        if (startOfYear > now) {
            // Future Year: Add everything from Now -> Start of Year
            if (tDate >= now && tDate < startOfYear) {
                if (t.type === TransactionType.INCOME) accumulated += amountBRL;
                if (t.type === TransactionType.EXPENSE) accumulated -= amountBRL;
            }
        } else {
            // Past/Current Year: Subtract everything from Start of Year -> Now
            if (tDate >= startOfYear && tDate <= now) {
                if (t.type === TransactionType.INCOME) accumulated -= amountBRL;
                if (t.type === TransactionType.EXPENSE) accumulated += amountBRL;
            }
        }
    });

    // NOW 'accumulated' is Balance at Jan 1st.

    // Initialize 12 months structure
    const data = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(selectedYear, i, 1);
        return {
            date: date,
            month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
            year: selectedYear,
            monthIndex: i,
            Receitas: 0,
            Despesas: 0,
            Acumulado: 0 as number | null
        };
    });

    // Aggregate This Year's Data
    transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() !== selectedYear) return;

        const monthIndex = tDate.getMonth();
        const account = accounts.find(a => a.id === t.accountId);

        let amount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
        if (t.type === TransactionType.EXPENSE) {
            if (t.isShared && t.payerId && t.payerId !== 'me') {
                amount = calculateEffectiveTransactionValue(t);
            }
        }

        const amountBRL = convertToBRL(amount, account?.currency || 'BRL');

        if (t.type === TransactionType.INCOME) {
            if (t.isRefund) {
                data[monthIndex].Despesas -= amountBRL;
            } else {
                data[monthIndex].Receitas += amountBRL;
            }
        } else if (t.type === TransactionType.EXPENSE) {
            if (t.isRefund) {
                data[monthIndex].Despesas -= amountBRL;
            } else {
                data[monthIndex].Despesas += amountBRL;
            }
        }
    });

    // Compute Accumulated Curve
    data.forEach(d => {
        const result = d.Receitas - d.Despesas;
        accumulated += result;
        d.Acumulado = accumulated;
    });

    // Mask historical empty months
    const minDate = transactions.length > 0
        ? new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
        : new Date();

    minDate.setDate(1);
    minDate.setHours(0, 0, 0, 0);

    return data.map(d => {
        if (d.date < minDate && d.year <= minDate.getFullYear()) {
            return { ...d, Receitas: 0, Despesas: 0, Acumulado: null };
        }
        return d;
    });
};

/**
 * 5. SPARKLINES (Mini Charts)
 * Calcula os últimos 7 dias.
 */
export const calculateSparklineData = (transactions: Transaction[], type: TransactionType, days = 7): number[] => {
    const data: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayTotal = transactions
            .filter(t => t.date.startsWith(dateStr) && t.type === type)
            .reduce((sum, t) => {
                const val = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                return sum + val;
            }, 0);
        data.push(dayTotal);
    }
    return data;
};


// Moved calculateTotalReceivables and calculateTotalPayables to balanceEngine.ts for better centralization.