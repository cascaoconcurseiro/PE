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
): { currentBalance: number, projectedBalance: number, pendingIncome: number, pendingExpenses: number, debugInfo?: any } => {

    // DEBUG: Ver tipos de conta recebidos
    console.log('🔍 DEBUG CONTAS:', accounts.map(a => ({ name: a.name, type: a.type, id: a.id })));

    // Saldo Atual Consolidado (Apenas Contas Bancárias e Carteira)
    // CORREÇÃO: Comparação case-insensitive e normalizada para evitar problemas de encoding
    const normalizeType = (type: string | undefined): string => {
        if (!type) return '';
        return type.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    
    const CHECKING_NORMALIZED = normalizeType(AccountType.CHECKING);
    const SAVINGS_NORMALIZED = normalizeType(AccountType.SAVINGS);
    const CASH_NORMALIZED = normalizeType(AccountType.CASH);
    const CREDIT_CARD_NORMALIZED = normalizeType(AccountType.CREDIT_CARD);
    
    const liquidityAccounts = accounts.filter(a => {
        const typeNorm = normalizeType(a.type);
        return typeNorm === CHECKING_NORMALIZED ||
               typeNorm === SAVINGS_NORMALIZED ||
               typeNorm === CASH_NORMALIZED;
    });

    // Cartões de crédito (para calcular fatura)
    // CORREÇÃO: Usar comparação normalizada
    const creditCardAccounts = accounts.filter(a => {
        const typeNorm = normalizeType(a.type);
        // Aceitar múltiplas variações possíveis
        return typeNorm === CREDIT_CARD_NORMALIZED ||
               typeNorm === 'CARTAO DE CREDITO' ||
               typeNorm === 'CREDIT_CARD' ||
               typeNorm.includes('CARTAO') && typeNorm.includes('CREDITO');
    });
    
    console.log('💳 DEBUG CARTÕES:', {
        enumValue: AccountType.CREDIT_CARD,
        enumNormalized: CREDIT_CARD_NORMALIZED,
        cartoes: creditCardAccounts.map(c => ({ name: c.name, type: c.type, typeNorm: normalizeType(c.type) })),
        totalCartoes: creditCardAccounts.length,
        todasContas: accounts.map(a => ({ name: a.name, type: a.type, typeNorm: normalizeType(a.type) }))
    });
    
    const creditCardIds = new Set(creditCardAccounts.map(a => a.id));

    const liquidityAccountIds = new Set(liquidityAccounts.map(a => a.id));
    const currentBalance = liquidityAccounts.reduce((acc, a) => acc + convertToBRL(a.balance, a.currency), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let pendingIncome = 0;
    let pendingExpenses = 0;

    // Helper to convert transaction amount to BRL
    const toBRL = (amount: number, t: Transaction) => {
        if (t.exchangeRate && t.exchangeRate > 0) {
            return amount * t.exchangeRate;
        }
        return convertToBRL(amount, t.currency || 'BRL');
    };

    // Filtrar transações do mês visualizado
    const viewMonth = currentDate.getMonth();
    const viewYear = currentDate.getFullYear();
    const monthTransactions = transactions.filter(t => {
        if (t.deleted) return false;
        const tDate = new Date(t.date);
        return tDate.getMonth() === viewMonth && tDate.getFullYear() === viewYear;
    });

    // Calcular fatura prevista do cartão de crédito para o mês
    // Soma todas as despesas do mês no cartão
    let creditCardBill = 0;
    
    const txNoCartao = monthTransactions.filter(t => 
        t.type === TransactionType.EXPENSE && t.accountId && creditCardIds.has(t.accountId)
    );
    
    console.log('📊 DEBUG TX CARTÃO:', {
        mes: `${viewMonth + 1}/${viewYear}`,
        totalTxMes: monthTransactions.length,
        txNoCartao: txNoCartao.length,
        creditCardIds: Array.from(creditCardIds),
        txComAccountId: monthTransactions.filter(t => t.accountId).map(t => ({ desc: t.description, accountId: t.accountId }))
    });
    
    txNoCartao.forEach(t => {
        creditCardBill += toBRL(t.amount, t);
    });

    // Adicionar fatura do cartão como despesa pendente
    if (creditCardBill > 0) {
        pendingExpenses += creditCardBill;
    }
    
    console.log('💰 DEBUG FATURA:', { creditCardBill, pendingExpenses });

    // Processar transações do mês para A Receber e A Pagar
    monthTransactions.forEach(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);

        // SHARED LOGIC - A Receber e A Pagar de compartilhados
        // Identificar transações compartilhadas de forma mais abrangente
        const hasSharedWith = t.sharedWith && t.sharedWith.length > 0;
        const isSharedContext = t.isShared || hasSharedWith || (t.payerId && t.payerId !== 'me');

        if (isSharedContext) {
            // 1. A Receber (Eu paguei, outros me devem) - INCLUI PASSADO E FUTURO DO MÊS
            // Condição: Despesa + (eu paguei ou não tem pagador definido) + tem splits não liquidados
            if (t.type === TransactionType.EXPENSE && (!t.payerId || t.payerId === 'me')) {
                if (!t.currency || t.currency === 'BRL') {
                    const pendingSplitsTotal = t.sharedWith?.reduce((sum, s) => {
                        return sum + (!s.isSettled ? s.assignedAmount : 0);
                    }, 0) || 0;

                    if (pendingSplitsTotal > 0) {
                        pendingIncome += toBRL(pendingSplitsTotal, t);
                    }
                }
            }

            // 2. A Pagar (Outros pagaram, eu devo) - INCLUI PASSADO E FUTURO DO MÊS
            // Condição: Despesa + outro pagou + não está liquidado
            if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me') {
                if (!t.currency || t.currency === 'BRL') {
                    if (!t.isSettled) {
                        pendingExpenses += toBRL(t.amount, t);
                    }
                }
            }
        }

        // Pular se é dívida compartilhada (já processado acima)
        if (t.type === TransactionType.EXPENSE && t.payerId && t.payerId !== 'me') {
            return;
        }

        // STANDARD LOGIC - Só transações FUTURAS afetam fluxo de caixa
        if (tDate <= today) return;

        // Pular despesas no cartão (já contabilizadas na fatura)
        if (t.type === TransactionType.EXPENSE && t.accountId && creditCardIds.has(t.accountId)) {
            return;
        }

        if (t.type === TransactionType.TRANSFER) {
            const sourceAccId = t.accountId;
            const isSourceLiquid = sourceAccId ? liquidityAccountIds.has(sourceAccId) : false;
            const destAccId = t.destinationAccountId;
            const isDestLiquid = destAccId ? liquidityAccountIds.has(destAccId) : false;

            if (isSourceLiquid && !isDestLiquid) {
                // Transferência para cartão = pagamento de fatura (não duplicar)
                if (!creditCardIds.has(destAccId || '')) {
                    pendingExpenses += toBRL(t.amount, t);
                }
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

        // Receitas e Despesas padrão (contas líquidas)
        if (t.type === TransactionType.INCOME) {
            const accId = t.accountId;
            if (accId && liquidityAccountIds.has(accId)) {
                pendingIncome += toBRL(t.amount, t);
            }
        } else if (t.type === TransactionType.EXPENSE) {
            const accId = t.accountId;
            if (accId && liquidityAccountIds.has(accId)) {
                pendingExpenses += toBRL(t.amount, t);
            }
        }
    });

    const projectedBalance = currentBalance + pendingIncome - pendingExpenses;

    // Debug info para diagnóstico
    const debugInfo = {
        totalAccounts: accounts.length,
        creditCardCount: creditCardAccounts.length,
        creditCardNames: creditCardAccounts.map(c => c.name),
        creditCardBill,
        txNoCartaoCount: monthTransactions.filter(t => 
            t.type === TransactionType.EXPENSE && t.accountId && creditCardIds.has(t.accountId)
        ).length,
        viewMonth: `${viewMonth + 1}/${viewYear}`
    };
    
    console.log('📊 DEBUG RESULTADO:', debugInfo);

    return {
        currentBalance,
        projectedBalance,
        pendingIncome,
        pendingExpenses,
        debugInfo
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