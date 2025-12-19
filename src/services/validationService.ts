import { Transaction, Account, AccountType } from '../types';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate transaction before saving
 */
export const validateTransaction = (
    transaction: Partial<Transaction>,
    account?: Account,
    allTransactions?: Transaction[]
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!transaction.amount || transaction.amount <= 0) {
        errors.push('Valor deve ser maior que zero');
    }

    if (!transaction.description?.trim()) {
        errors.push('Descrição é obrigatória');
    }

    if (!transaction.date) {
        errors.push('Data é obrigatória');
    }

    if (!transaction.accountId && !transaction.payerId) {
        errors.push('Conta é obrigatória');
    }

    // Date validations
    if (transaction.date) {
        const txDate = new Date(transaction.date);
        
        // ✅ VALIDAÇÃO CRÍTICA: Verificar se a data é válida
        if (isNaN(txDate.getTime())) {
            errors.push('Data inválida');
        } else {
            // Validar se a data faz sentido (ex: 2024-02-30 seria inválida)
            const [year, month, day] = transaction.date.split('-').map(Number);
            const reconstructedDate = new Date(year, month - 1, day);
            if (
                reconstructedDate.getFullYear() !== year ||
                reconstructedDate.getMonth() !== month - 1 ||
                reconstructedDate.getDate() !== day
            ) {
                errors.push('Data inválida (dia não existe no mês)');
            }
            
            const today = new Date();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            const oneYearAhead = new Date();
            oneYearAhead.setFullYear(today.getFullYear() + 1);

            if (txDate > oneYearAhead) {
                warnings.push('Data está muito no futuro (mais de 1 ano)');
            }

            if (txDate < oneYearAgo) {
                warnings.push('Data está muito no passado (mais de 1 ano)');
            }
        }
    }

    // Amount validations
    if (transaction.amount && transaction.amount > 1000000) {
        warnings.push('Valor muito alto. Confirme se está correto.');
    }

    // Credit card validations
    if (account?.type === AccountType.CREDIT_CARD) {
        if (account.limit && Math.abs(account.balance) + (transaction.amount || 0) > account.limit) {
            warnings.push(`Esta transação ultrapassará o limite do cartão (${account.limit})`);
        }
    }

    // Installment validations
    if (transaction.isInstallment) {
        if (!transaction.totalInstallments || transaction.totalInstallments < 2) {
            errors.push('Parcelamento deve ter pelo menos 2 parcelas');
        }

        if (transaction.totalInstallments && transaction.totalInstallments > 48) {
            warnings.push('Número de parcelas muito alto (mais de 48)');
        }

        if (account?.type !== AccountType.CREDIT_CARD) {
            warnings.push('Parcelamento geralmente é usado apenas em cartões de crédito');
        }
    }

    // Duplicate detection
    if (allTransactions && transaction.description && transaction.amount && transaction.date) {
        const potentialDuplicates = allTransactions.filter(t =>
            t.description === transaction.description &&
            t.amount === transaction.amount &&
            t.date === transaction.date &&
            t.accountId === transaction.accountId
        );

        if (potentialDuplicates.length > 0) {
            warnings.push('Possível transação duplicada detectada');
        }
    }

    // Shared expense validations
    if (transaction.isShared && transaction.sharedWith) {
        const totalPercentage = transaction.sharedWith.reduce((sum, s) => sum + s.percentage, 0);
        const totalAssigned = transaction.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
        
        // Validate percentages sum to 100%
        if (Math.abs(totalPercentage - 100) > 0.01) {
            errors.push('A soma das porcentagens deve ser 100%');
        }
        
        // ✅ VALIDAÇÃO CRÍTICA: Splits não podem exceder o valor total
        if (transaction.amount && totalAssigned > transaction.amount) {
            errors.push(`Divisão inválida: soma dos valores (${totalAssigned.toFixed(2)}) é maior que o total (${transaction.amount.toFixed(2)})`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Validate account before saving
 */
export const validateAccount = (account: Partial<Account>): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!account.name?.trim()) {
        errors.push('Nome da conta é obrigatório');
    }

    if (!account.type) {
        errors.push('Tipo de conta é obrigatório');
    }

    if (account.type === AccountType.CREDIT_CARD) {
        if (!account.limit || account.limit <= 0) {
            errors.push('Limite do cartão deve ser maior que zero');
        }

        if (!account.closingDay || account.closingDay < 1 || account.closingDay > 31) {
            errors.push('Dia de fechamento inválido (1-31)');
        }

        if (!account.dueDay || account.dueDay < 1 || account.dueDay > 31) {
            errors.push('Dia de vencimento inválido (1-31)');
        }
    }

    if (account.balance && Math.abs(account.balance) > 10000000) {
        warnings.push('Saldo muito alto. Confirme se está correto.');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Validate budget limits
 */
export const validateBudgetLimit = (
    spent: number,
    limit: number
): { status: 'safe' | 'warning' | 'danger'; percentage: number; message: string } => {
    const percentage = (spent / limit) * 100;

    if (percentage >= 100) {
        return {
            status: 'danger',
            percentage,
            message: 'Orçamento estourado!'
        };
    }

    if (percentage >= 80) {
        return {
            status: 'warning',
            percentage,
            message: 'Atenção: Próximo do limite'
        };
    }

    return {
        status: 'safe',
        percentage,
        message: 'Dentro do orçamento'
    };
};

/**
 * Validate credit card limit
 */
export const validateCreditLimit = (
    account: Account,
    additionalAmount: number = 0
): { status: 'safe' | 'warning' | 'danger'; available: number; message: string } => {
    if (!account.limit) {
        return { status: 'safe', available: 0, message: 'Sem limite definido' };
    }

    const used = Math.abs(account.balance) + additionalAmount;
    const available = account.limit - used;
    const percentage = (used / account.limit) * 100;

    if (percentage >= 100) {
        return {
            status: 'danger',
            available,
            message: 'Limite excedido!'
        };
    }

    if (percentage >= 80) {
        return {
            status: 'warning',
            available,
            message: 'Próximo do limite'
        };
    }

    return {
        status: 'safe',
        available,
        message: 'Limite disponível'
    };
};
