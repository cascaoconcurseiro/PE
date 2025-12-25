import { Account, Transaction, TransactionType, AccountType } from '../../types';
import { isSameMonth } from '../../utils';
import { convertToBRL } from '../../services/currencyService';
import { FinancialPrecision } from '../../services/financialPrecision';
import { SafeFinancialCalculator } from '../../utils/SafeFinancialCalculator';
import { FinancialErrorDetector } from '../../utils/FinancialErrorDetector';

/**
 * Calcula o valor efetivo da transação para o usuário (Economia Real).
 * - Se eu paguei e dividi: Retorna (Total - Parte dos Outros).
 * - Se outro pagou e eu dividi: Retorna (Minha Parte).
 * - Se não é compartilhada: Retorna o valor total.
 */
export const calculateEffectiveTransactionValue = (t: Transaction): number => {
    return FinancialErrorDetector.safeCalculate(
        () => {
            // Safety Fallback for invalid amounts
            const safeAmount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);

            // Se não for despesa ou não for compartilhada, o valor é o original
            const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');

            if (t.type !== TransactionType.EXPENSE || !isShared) {
                return safeAmount;
            }

            const splitsTotal = SafeFinancialCalculator.safeSum(
                t.sharedWith?.map(s => SafeFinancialCalculator.toSafeNumber(s.assignedAmount, 0)) || []
            );

            // ✅ VALIDAÇÃO CRÍTICA: Splits não podem ser maiores que o total
            if (splitsTotal > safeAmount + 0.01) {
                // Log detalhado do erro
                console.error('🚨 DATA CORRUPTION: Splits exceed transaction amount', {
                    transactionId: t.id,
                    description: t.description,
                    transactionAmount: safeAmount,
                    splitsTotal: splitsTotal,
                    difference: splitsTotal - safeAmount,
                    splits: t.sharedWith?.map(s => ({
                        memberId: s.memberId,
                        amount: s.assignedAmount
                    }))
                });

                // Retornar total como fallback para evitar valores negativos
                FinancialErrorDetector.logError(
                    'DATA_CORRUPTION',
                    'calculateEffectiveTransactionValue',
                    'splits_validation',
                    [t],
                    `Splits total (${splitsTotal.toFixed(2)}) maior que valor da transação (${safeAmount.toFixed(2)})`,
                    'HIGH'
                );
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
        },
        'calculateEffectiveTransactionValue',
        'effective_transaction_calculation',
        [t],
        0
    ).result;
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

    return FinancialErrorDetector.safeCalculate(
        () => {
            // Sanitizar dados de entrada
            const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
            const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);
            const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();

            // Saldo Atual Consolidado (Apenas Contas Bancárias e Carteira, ignora Cartão de Crédito e Investimentos para fluxo de caixa)
            const liquidityAccounts = safeAccounts.filter(a =>
                a.type === AccountType.CHECKING ||
                a.type === AccountType.SAVINGS ||
                a.type === AccountType.CASH
            );

            const liquidityAccountIds = new Set(liquidityAccounts.map(a => a.id));

            const currentBalance = SafeFinancialCalculator.safeOperation(
                () => liquidityAccounts.reduce((acc, a) => {
                    const safeBalance = SafeFinancialCalculator.toSafeNumber(a.balance, 0);
                    const convertedBalance = SafeFinancialCalculator.safeCurrencyConversion(safeBalance, a.currency);
                    return FinancialPrecision.sum([acc, convertedBalance]);
                }, 0),
                0,
                'current_balance_calculation'
            );

            // Definir intervalo de tempo baseado na data que o usuário está visualizando
            const now = new Date();
            const isViewingCurrentMonth = safeCurrentDate.getMonth() === now.getMonth() &&
                safeCurrentDate.getFullYear() === now.getFullYear();

            // Para mês atual: usar data real de hoje
            // Para mês futuro: usar data real de hoje (não início do mês) para distinguir entre transações já ocorridas e futuras
            // Para mês passado: usar data atual daquele mês (se existir) ou início do mês
            let today: Date;

            if (isViewingCurrentMonth) {
                today = now;
            } else if (safeCurrentDate > now) {
                // Mês futuro: usar data real atual para distinguir transações já ocorridas das futuras
                today = now;
            } else {
                // Mês passado: usar data atual daquele mês
                today = new Date(safeCurrentDate.getFullYear(), safeCurrentDate.getMonth(), now.getDate());
            }

            today.setHours(0, 0, 0, 0);

            const endOfMonth = new Date(safeCurrentDate.getFullYear(), safeCurrentDate.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);

            let pendingIncome = 0;
            let pendingExpenses = 0;

            // Helper to convert transaction amount to BRL using stored rate or fallback
            const toBRL = (amount: number, t: Transaction) => {
                // Safety First
                const safeAmount = SafeFinancialCalculator.toSafeNumber(amount, 0);

                if (t.exchangeRate && SafeFinancialCalculator.toSafeNumber(t.exchangeRate, 0) > 0) {
                    return SafeFinancialCalculator.safeOperation(
                        () => safeAmount * SafeFinancialCalculator.toSafeNumber(t.exchangeRate!, 1),
                        safeAmount,
                        'exchange_rate_conversion'
                    );
                }
                return SafeFinancialCalculator.safeCurrencyConversion(safeAmount, t.currency || 'BRL');
            };

            // Define the Time Window for Projection:
            // Start: Current day within the viewed month
            // End: End of the Viewed Month
            // Goal: Accumulate all changes from current day until the end of the viewed month

            const viewMonthEnd = new Date(safeCurrentDate.getFullYear(), safeCurrentDate.getMonth() + 1, 0);
            viewMonthEnd.setHours(23, 59, 59, 999);

            // ✅ FIX: Incluir faturas pendentes de cartão no cálculo de projeção
            // Faturas importadas (isPendingInvoice) devem aparecer como despesa pendente
            safeTransactions.forEach(t => {
                if (t.deleted) return;
                
                // Processar faturas pendentes separadamente
                if (t.isPendingInvoice && !t.isSettled) {
                    const tDate = new Date(t.date);
                    tDate.setHours(0, 0, 0, 0);
                    
                    const isViewMonth = tDate.getMonth() === safeCurrentDate.getMonth() && 
                                       tDate.getFullYear() === safeCurrentDate.getFullYear();
                    
                    if (isViewMonth && tDate > today) {
                        // Fatura vence neste mês e ainda não venceu
                        pendingExpenses += toBRL(SafeFinancialCalculator.toSafeNumber(t.amount, 0), t);
                    }
                    return; // Não processar novamente abaixo
                }
            });

            safeTransactions.forEach(t => {
                if (t.deleted) return;

                const tDate = new Date(t.date);
                tDate.setHours(0, 0, 0, 0);

                // STRICT MONTH FILTER (User Request: "Só aparecer o projeto do mês")
                const isViewMonth = tDate.getMonth() === safeCurrentDate.getMonth() && tDate.getFullYear() === safeCurrentDate.getFullYear();
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
                            const pendingSplitsTotal = SafeFinancialCalculator.safeOperation(
                                () => {
                                    return (t.sharedWith || []).reduce((sum, s) => {
                                        if (!s.isSettled) {
                                            const safeAmount = SafeFinancialCalculator.toSafeNumber(s.assignedAmount, 0);
                                            return sum + safeAmount;
                                        }
                                        return sum;
                                    }, 0);
                                },
                                0,
                                'pending_splits_calculation'
                            );

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
                                pendingExpenses += toBRL(SafeFinancialCalculator.toSafeNumber(t.amount, 0), t);
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
                        pendingExpenses += toBRL(SafeFinancialCalculator.toSafeNumber(t.amount, 0), t);
                    }
                    else if (!isSourceLiquid && isDestLiquid) {
                        // Receiving from non-liquid (e.g. Loan, Investment Withdrawal) is Income
                        if (t.destinationAmount && SafeFinancialCalculator.toSafeNumber(t.destinationAmount, 0) > 0) {
                            const destAcc = safeAccounts.find(a => a.id === t.destinationAccountId);
                            if (destAcc && destAcc.currency !== 'BRL') {
                                pendingIncome += SafeFinancialCalculator.safeCurrencyConversion(
                                    SafeFinancialCalculator.toSafeNumber(t.destinationAmount, 0),
                                    destAcc.currency
                                );
                            } else {
                                pendingIncome += SafeFinancialCalculator.toSafeNumber(t.destinationAmount, 0);
                            }
                        } else {
                            pendingIncome += toBRL(SafeFinancialCalculator.toSafeNumber(t.amount, 0), t);
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
                const safeAmount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);

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
            const projectedBalance = SafeFinancialCalculator.safeOperation(
                () => FinancialPrecision.sum([currentBalance, pendingIncome, -pendingExpenses]),
                currentBalance,
                'projected_balance_final_calculation'
            );

            return {
                currentBalance: FinancialPrecision.round(currentBalance),
                projectedBalance: FinancialPrecision.round(projectedBalance),
                pendingIncome: FinancialPrecision.round(pendingIncome),
                pendingExpenses: FinancialPrecision.round(pendingExpenses)
            };
        },
        'calculateProjectedBalance',
        'projected_balance_calculation',
        [accounts, transactions, currentDate],
        {
            currentBalance: 0,
            projectedBalance: 0,
            pendingIncome: 0,
            pendingExpenses: 0
        }
    ).result;
};

/**
 * 3. ANÁLISE DE SAÚDE FINANCEIRA (FINANCIAL HEALTH)
 * Gera insights rápidos baseados na regra 50-30-20 ou similar.
 */
export const analyzeFinancialHealth = (income: number, expenses: number): 'POSITIVE' | 'WARNING' | 'CRITICAL' => {
    return FinancialErrorDetector.safeCalculate(
        () => {
            // Validar se os valores são números válidos
            const safeIncome = SafeFinancialCalculator.toSafeNumber(income, 0);
            const safeExpenses = SafeFinancialCalculator.toSafeNumber(expenses, 0);

            if (safeIncome === 0) return safeExpenses > 0 ? 'CRITICAL' : 'POSITIVE';

            const savingRate = SafeFinancialCalculator.safeOperation(
                () => (safeIncome - safeExpenses) / safeIncome,
                0,
                'saving_rate_calculation'
            );

            if (savingRate < 0) return 'CRITICAL'; // Gastando mais do que ganha
            if (savingRate < 0.1) return 'WARNING'; // Poupando menos de 10%
            return 'POSITIVE'; // Saudável
        },
        'analyzeFinancialHealth',
        'financial_health_analysis',
        [income, expenses],
        'CRITICAL'
    ).result;
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

    return FinancialErrorDetector.safeCalculate(
        () => {
            // Sanitizar dados de entrada
            const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);
            const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
            const safeSelectedYear = SafeFinancialCalculator.toSafeNumber(selectedYear, new Date().getFullYear());

            // 1. Get Initial Accumulated Balance (Net Worth Anchor)
            // We start with Current Balance and work backwards/forwards
            const liquidityAccounts = safeAccounts.filter(a =>
                a.type === AccountType.CHECKING ||
                a.type === AccountType.SAVINGS ||
                a.type === AccountType.CASH ||
                a.type === AccountType.CREDIT_CARD
            );

            let accumulated = SafeFinancialCalculator.safeOperation(
                () => liquidityAccounts.reduce((sum, a) => {
                    const safeBalance = SafeFinancialCalculator.toSafeNumber(a.balance, 0);
                    const val = SafeFinancialCalculator.safeCurrencyConversion(safeBalance, a.currency || 'BRL');
                    if (a.type === AccountType.CREDIT_CARD) {
                        return sum - Math.abs(val);
                    }
                    return sum + val;
                }, 0),
                0,
                'initial_accumulated_balance'
            );

            // 2. Adjust Balance to reach Jan 1st of Selected Year
            const startOfYear = new Date(safeSelectedYear, 0, 1);
            startOfYear.setHours(0, 0, 0, 0);

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            // Sort to be safe? Hook logic iterated "dashboardTransactions".
            // We need to reverse-engineer from Now to Start of Year.
            const sortedTxs = [...safeTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            safeTransactions.forEach(t => {
                // NOTE: Logic copied from hook requires careful understanding.
                // Hook iterates ALL dashboardTransactions for the time travel, NOT just selected year.
                const tDate = new Date(t.date);
                tDate.setHours(0, 0, 0, 0);

                // Skip unpaid debts for cash flow calculations
                if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me' && !t.isSettled) {
                    return; // Skip unpaid debts - they don't affect cash flow until settled
                }

                // Effective Amount Logic
                let amount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
                const isSharedContext = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');

                if (t.type === TransactionType.EXPENSE && isSharedContext) {
                    amount = calculateEffectiveTransactionValue(t);
                }

                const account = safeAccounts.find(a => a.id === t.accountId);
                if (account && account.currency && account.currency !== 'BRL') return; // Double check BRL Strictness

                const amountBRL = SafeFinancialCalculator.safeCurrencyConversion(amount, account?.currency || 'BRL');

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
                const date = new Date(safeSelectedYear, i, 1);
                return {
                    date: date,
                    month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
                    year: safeSelectedYear,
                    monthIndex: i,
                    Receitas: 0,
                    Despesas: 0,
                    Acumulado: 0 as number | null
                };
            });

            // Aggregate This Year's Data
            safeTransactions.forEach(t => {
                const tDate = new Date(t.date);
                if (tDate.getFullYear() !== safeSelectedYear) return;

                // Skip unpaid debts for cash flow calculations
                if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me' && !t.isSettled) {
                    return; // Skip unpaid debts - they don't affect cash flow until settled
                }

                const monthIndex = tDate.getMonth();
                const account = safeAccounts.find(a => a.id === t.accountId);

                let amount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
                if (t.type === TransactionType.EXPENSE) {
                    const isSharedContext = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || (t.payerId && t.payerId !== 'me');
                    if (isSharedContext) {
                        // FIX 2025-12-23: Shared Expense Splitting for Visualization
                        // User Scenario: "I paid 190. 95 is mine, 95 is reimbursement."
                        // Old Logic: Expense = 95. Net = -95.
                        // New Logic: Expense = 190. Income = 95 (Reimbursement). Net = -95.
                        // This allows the user to see the "Receita" (Reimbursement) they expect.

                        if (!t.payerId || t.payerId === 'me') {
                            // I paid. Expense is the FULL amount. Reimbursement is Income.
                            amount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);

                            // Calculate Reimbursement (What I get back)
                            const splitsTotal = t.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0;
                            const reimbursementBRL = SafeFinancialCalculator.safeCurrencyConversion(splitsTotal, account?.currency || 'BRL');

                            // ADD Reimbursement to Income immediately here
                            data[monthIndex].Receitas += reimbursementBRL;
                        } else {
                            // I owe. My Expense is just my share.
                            amount = calculateEffectiveTransactionValue(t);
                        }
                    }
                }

                const amountBRL = SafeFinancialCalculator.safeCurrencyConversion(amount, account?.currency || 'BRL');

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
                const result = SafeFinancialCalculator.safeOperation(
                    () => d.Receitas - d.Despesas,
                    0,
                    'monthly_net_flow'
                );
                accumulated += result;
                d.Acumulado = accumulated;
            });

            // Mask historical empty months
            const minDate = safeTransactions.length > 0
                ? new Date(Math.min(...safeTransactions.map(t => new Date(t.date).getTime())))
                : new Date();

            minDate.setDate(1);
            minDate.setHours(0, 0, 0, 0);

            return data.map(d => {
                if (d.date < minDate && d.year <= minDate.getFullYear()) {
                    return { ...d, Receitas: 0, Despesas: 0, Acumulado: null };
                }
                return d;
            });
        },
        'calculateCashFlowData',
        'cash_flow_calculation',
        [transactions, accounts, selectedYear],
        []
    ).result;
};

/**
 * 5. SPARKLINES (Mini Charts)
 * Calcula os últimos 7 dias.
 */
export const calculateSparklineData = (transactions: Transaction[], type: TransactionType, days = 7): number[] => {
    return FinancialErrorDetector.safeCalculate(
        () => {
            const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);
            const safeDays = SafeFinancialCalculator.toSafeNumber(days, 7);

            const data: number[] = [];
            for (let i = safeDays - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];

                const dayTotal = SafeFinancialCalculator.safeOperation(
                    () => safeTransactions
                        .filter(t => t.date.startsWith(dateStr) && t.type === type)
                        .reduce((sum, t) => {
                            const val = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
                            return sum + val;
                        }, 0),
                    0,
                    'sparkline_day_total'
                );

                data.push(dayTotal);
            }
            return data;
        },
        'calculateSparklineData',
        'sparkline_calculation',
        [transactions, type, days],
        []
    ).result;
};


// Moved calculateTotalReceivables and calculateTotalPayables to balanceEngine.ts for better centralization.