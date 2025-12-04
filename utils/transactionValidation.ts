import { Transaction, TransactionType } from '../types';

/**
 * Valida se uma transação tem conta de origem válida
 */
export const hasValidSourceAccount = (tx: Partial<Transaction>): boolean => {
    return !!(tx.accountId && tx.accountId !== 'EXTERNAL' && tx.accountId.trim() !== '');
};

/**
 * Valida se uma transação tem conta de destino válida (para transferências)
 */
export const hasValidDestinationAccount = (tx: Partial<Transaction>): boolean => {
    if (tx.type !== TransactionType.TRANSFER) return true;
    return !!(tx.destinationAccountId && tx.destinationAccountId !== 'EXTERNAL' && tx.destinationAccountId.trim() !== '');
};

/**
 * Valida se uma transação segue o princípio de partidas dobradas
 */
export const isDoubleEntryValid = (tx: Partial<Transaction>): boolean => {
    switch (tx.type) {
        case TransactionType.TRANSFER:
            // Transferência: precisa origem E destino
            return hasValidSourceAccount(tx) && hasValidDestinationAccount(tx);

        case TransactionType.INCOME:
            // Receita: precisa destino (accountId)
            return hasValidSourceAccount(tx);

        case TransactionType.EXPENSE:
            // Despesa: precisa origem (accountId)
            // EXCEÇÃO: Se outra pessoa pagou (payerId !== 'me'), accountId pode ser EXTERNAL
            if (tx.payerId && tx.payerId !== 'me') {
                return true; // Válido, pois outra pessoa pagou
            }
            return hasValidSourceAccount(tx);

        default:
            return false;
    }
};

/**
 * Retorna mensagem de erro se a transação for inválida
 */
export const getTransactionValidationError = (tx: Partial<Transaction>): string | null => {
    if (!tx.type) return 'Tipo de transação obrigatório';
    if (!tx.amount || tx.amount <= 0) return 'Valor deve ser maior que zero';
    if (!tx.description?.trim()) return 'Descrição obrigatória';
    if (!tx.date) return 'Data obrigatória';

    switch (tx.type) {
        case TransactionType.TRANSFER:
            if (!hasValidSourceAccount(tx)) return 'Conta de origem obrigatória';
            if (!hasValidDestinationAccount(tx)) return 'Conta de destino obrigatória';
            if (tx.accountId === tx.destinationAccountId) return 'Origem e destino não podem ser iguais';
            break;

        case TransactionType.INCOME:
            if (!hasValidSourceAccount(tx)) return 'Conta de destino obrigatória';
            break;

        case TransactionType.EXPENSE:
            // EXCEÇÃO: Se outra pessoa pagou, não precisa de conta
            if (tx.payerId && tx.payerId !== 'me') {
                break; // Válido
            }
            if (!hasValidSourceAccount(tx)) return 'Conta de origem obrigatória';
            break;
    }

    return null;
};
