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

    transactions.forEach(t => {
        // Filtrar apenas transações deste mês
        if (!isSameMonth(t.date, currentDate)) return;

        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0); // Normalizar para meia-noite para comparação justa

        // Check for SHARED DEBTS/CREDITS (Unsettled items in this month appear as Pending)
        // Does not strictly need to be "Future" to be "Pending", just "Unsettled".
        // If I paid for someone yesterday, they still owe me -> Pending Income.
        // If someone paid for me yesterday, I still owe them -> Pending Expense.

        let processedAsShared = false;

        // 1. Shared Receivables (Credits) - Money coming back to me
        // Only if I am Payer
        if (t.type === TransactionType.EXPENSE && t.isShared && (!t.payerId || t.payerId === 'me')) {
            // Sum of UNSETTLED splits
            const pendingSplitsTotal = t.sharedWith?.reduce((sum, s) => {
                return sum + (!s.isSettled ? s.assignedAmount : 0);
            }, 0) || 0;

            if (pendingSplitsTotal > 0) {
                pendingIncome += toBRL(pendingSplitsTotal, t);
                // We don't mark 'processedAsShared = true' because the MAIN expense 
                // (my cash outflow) logic below handles the "Expense projection" part.
                // This block ADDS the "Reimbursement projection".
            }
        }

        // 2. Shared Debts (Payables) - Money I owe others
        // Only if I am NOT Payer
        if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
            // If NOT settled, I owe this amount.
            // But wait, if I am NOT payer, does this transaction even represent a cash outflow for me right now?
            // Usually, "Mirror Transactions" are created for me.
            // If I haven't marked it as settled, it's a future payment.
            // Is 'isSettled' on the transaction itself? Yes.

            if (!t.isSettled) {
                // It's a pending expense for me.
                // We count it below in the "Future Expense" block?
                // The "Future Expense" block checks date > today.
                // If this debt is from yesterday, strict future check skips it.
                // We should manually count it here and MARK it as processed so clean logic doesn't double count?
                // Actually, "Mirror" transactions don't have Account ID (usually).
                // Logic below checks `liquidityAccountIds.has(accId)`.
                // Mirror transactions have `account_id` as NULL or specific "Debt" account?
                // If NULL, they are skipped below.
                // So we MUST handle them here.

                // However, "Projected Balance" usually implies Bank Account Projection.
                // Paying a debt involves a Transfer from Bank -> External/Person.
                // If I owe R$ 50, I will eventually pay R$ 50.
                pendingExpenses += toBRL(t.amount, t); // t.amount is 'my share' in mirror tx
            }
            processedAsShared = true; // Skip standard processing (since standard requires existing Account ID)
        }

        const isFuture = tDate.getTime() > today.getTime();

        if (processedAsShared) return;

        // Standard Cash Flow Projection (Strictly Future)
        if (isFuture) {

            // Tratamento refinado de Transferências: Afetam a projeção se cruzarem a fronteira da liquidez
            if (t.type === TransactionType.TRANSFER) {
                const sourceAccId = t.accountId;
                const isSourceLiquid = sourceAccId ? liquidityAccountIds.has(sourceAccId) : false;
                // Se não tem destino (saque/externo), assumimos que não é líquido (saiu do sistema)
                const destAccId = t.destinationAccountId;
                const isDestLiquid = destAccId ? liquidityAccountIds.has(destAccId) : false;

                // Cenário 1: Saiu da liquidez para não-liquidez (ex: Investimento ou Pagamento Fatura)
                // Deve contar como "Despesa" na projeção de fluxo de caixa líquido
                if (isSourceLiquid && !isDestLiquid) {
                    pendingExpenses += toBRL(t.amount, t);
                }
                // Cenário 2: Entrou na liquidez vindo de não-liquidez (ex: Resgate)
                // Deve contar como "Receita" na projeção
                else if (!isSourceLiquid && isDestLiquid) {
                    // Check if we have an explicit destination amount (Multi-currency or Manual correction)
                    if (t.destinationAmount && t.destinationAmount > 0) {
                        // Trust the destination amount implicitly as it represents what HIT the account
                        const destAcc = accounts.find(a => a.id === t.destinationAccountId);

                        if (destAcc && destAcc.currency !== 'BRL') {
                            // If destination is NOT BRL, we must convert that amount to BRL
                            pendingIncome += convertToBRL(t.destinationAmount, destAcc.currency);
                        } else {
                            // Destination is BRL (or assumed BRL basis for projection), so use raw value
                            pendingIncome += t.destinationAmount;
                        }
                    } else {
                        // Fallback: Convert source amount
                        pendingIncome += toBRL(t.amount, t);
                    }
                }
                return;
            }

            if (t.type === TransactionType.INCOME) {
                // Receitas: usar valor total
                pendingIncome += toBRL(t.amount, t);
            } else if (t.type === TransactionType.EXPENSE) {
                // ✅ CORREÇÃO CRÍTICA: Ignorar despesas de Cartão de Crédito na projeção de fluxo de caixa
                // (Pois elas só afetam o caixa no dia do pagamento da fatura, que geralmente é uma Transferência)
                const accId = t.accountId;
                if (accId && liquidityAccountIds.has(accId)) {
                    // ✅ CORREÇÃO CRÍTICA (Fluxo de Caixa): Usar valor integral se fui eu que paguei.
                    // A regra "Effective Value" (minha parte) só vale para Análise de Gastos, não para Projeção de Saldo.
                    // Para o saldo, o dinheiro SAIU da conta. O reembolso é uma entrada futura separada.

                    let expenseValue = t.amount;
                    if (t.isShared && t.payerId && t.payerId !== 'me') {
                        // Se outra pessoa pagou, aí sim uso apenas minha parte (pois só isso sairá da minha conta eventualmente)
                        expenseValue = calculateEffectiveTransactionValue(t);
                    }

                    pendingExpenses += toBRL(expenseValue, t);
                }
            }
        }
    });

    // Calcular Projeção
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