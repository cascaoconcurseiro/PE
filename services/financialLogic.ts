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

    // Cenário 1: Eu paguei (payerId vazio ou 'me')
    if (!t.payerId || t.payerId === 'me') {
        // Custo Efetivo = O que saiu da conta - O que vou receber de volta
        return Math.max(0, t.amount - splitsTotal);
    }

    // Cenário 2: Outro pagou
    else {
        // Custo Efetivo = O que eu devo (Minha parte)
        // Assumindo que o valor da transação original é o TOTAL da compra:
        return Math.max(0, t.amount - splitsTotal);
    }
};

/**
 * 1. CONSISTÊNCIA DE DADOS (DATA INTEGRITY)
 * Verifica se existem transações órfãs (sem conta válida) e limpa dados inconsistentes.
 */
export const checkDataConsistency = (accounts: Account[], transactions: Transaction[]): string[] => {
    const issues: string[] = [];
    const accountIds = new Set(accounts.map(a => a.id));

    transactions.forEach(t => {
        // Regra 1: Toda transação deve ter uma conta de origem válida
        if (!accountIds.has(t.accountId)) {
            issues.push(`Transação órfã encontrada: ${t.description} (ID da conta inválido)`);
        }

        // Regra 2: Transferências devem ter conta de destino válida e diferente da origem
        if (t.type === TransactionType.TRANSFER) {
            if (!t.destinationAccountId || !accountIds.has(t.destinationAccountId)) {
                issues.push(`Transferência inconsistente: ${t.description} (Conta destino inválida)`);
            }
            if (t.accountId === t.destinationAccountId) {
                issues.push(`Transferência circular detectada: ${t.description} (Origem igual ao Destino)`);
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

    const currentBalance = liquidityAccounts.reduce((acc, a) => acc + convertToBRL(a.balance, a.currency), 0);

    // Definir intervalo de tempo (Hoje até Fim do Mês)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let pendingIncome = 0;
    let pendingExpenses = 0;

    transactions.forEach(t => {
        // Filtrar apenas transações deste mês
        if (!isSameMonth(t.date, currentDate)) return;

        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0); // Normalizar para meia-noite para comparação justa

        // Considerar apenas transações ESTRITAMENTE FUTURAS (Amanhã em diante)
        // Transações de HOJE já foram deduzidas do saldo atual pelo sistema
        if (tDate.getTime() > today.getTime()) {
            // Ignorar transferências internas
            if (t.type === TransactionType.TRANSFER) return;

            // Usa o valor total para fluxo de caixa bancário (o dinheiro sai todo, o reembolso vem depois)
            // AQUI MANTEMOS O VALOR TOTAL POIS É FLUXO DE CAIXA
            const amountBRL = convertToBRL(t.amount, 'BRL');

            if (t.type === TransactionType.INCOME) {
                pendingIncome += amountBRL;
            } else if (t.type === TransactionType.EXPENSE) {
                pendingExpenses += amountBRL;
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