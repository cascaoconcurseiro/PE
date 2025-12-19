/**
 * Testes unitários para validationService
 * 
 * Testa validações de transações, contas e orçamentos
 */

import { describe, it, expect } from 'vitest';
import { 
    validateTransaction, 
    validateAccount, 
    validateBudgetLimit,
    validateCreditLimit 
} from '../services/validationService';
import { Account, Transaction, TransactionType, AccountType } from '../types';

// Helpers
const createAccount = (overrides: Partial<Account> = {}): Account => ({
    id: 'acc-1',
    name: 'Conta Teste',
    type: AccountType.CHECKING,
    balance: 1000,
    initialBalance: 0,
    currency: 'BRL',
    ...overrides
});

const createTransaction = (overrides: Partial<Transaction> = {}): Partial<Transaction> => ({
    date: new Date().toISOString().split('T')[0],
    amount: 100,
    type: TransactionType.EXPENSE,
    category: 'Outros',
    description: 'Transação Teste',
    accountId: 'acc-1',
    ...overrides
});

describe('validateTransaction', () => {
    describe('campos obrigatórios', () => {
        it('deve rejeitar transação sem valor', () => {
            const tx = createTransaction({ amount: 0 });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Valor deve ser maior que zero');
        });

        it('deve rejeitar transação com valor negativo', () => {
            const tx = createTransaction({ amount: -100 });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
        });

        it('deve rejeitar transação sem descrição', () => {
            const tx = createTransaction({ description: '' });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Descrição é obrigatória');
        });

        it('deve rejeitar transação sem data', () => {
            const tx = createTransaction({ date: undefined });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Data é obrigatória');
        });

        it('deve rejeitar transação sem conta (quando não é compartilhada)', () => {
            const tx = createTransaction({ accountId: undefined, payerId: undefined });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Conta é obrigatória');
        });

        it('deve aceitar transação sem conta quando tem payerId', () => {
            const tx = createTransaction({ accountId: undefined, payerId: 'other-user' });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(true);
        });
    });

    describe('validações de data', () => {
        it('deve alertar para data muito no futuro', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 2);
            const tx = createTransaction({ date: futureDate.toISOString().split('T')[0] });
            const result = validateTransaction(tx);
            expect(result.warnings).toContain('Data está muito no futuro (mais de 1 ano)');
        });

        it('deve alertar para data muito no passado', () => {
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 2);
            const tx = createTransaction({ date: pastDate.toISOString().split('T')[0] });
            const result = validateTransaction(tx);
            expect(result.warnings).toContain('Data está muito no passado (mais de 1 ano)');
        });
    });

    describe('validações de valor', () => {
        it('deve alertar para valor muito alto', () => {
            const tx = createTransaction({ amount: 2000000 });
            const result = validateTransaction(tx);
            expect(result.warnings).toContain('Valor muito alto. Confirme se está correto.');
        });
    });

    describe('validações de parcelamento', () => {
        it('deve rejeitar parcelamento com menos de 2 parcelas', () => {
            const tx = createTransaction({ isInstallment: true, totalInstallments: 1 });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Parcelamento deve ter pelo menos 2 parcelas');
        });

        it('deve alertar para muitas parcelas', () => {
            const tx = createTransaction({ isInstallment: true, totalInstallments: 60 });
            const result = validateTransaction(tx);
            expect(result.warnings).toContain('Número de parcelas muito alto (mais de 48)');
        });

        it('deve alertar parcelamento fora de cartão de crédito', () => {
            const account = createAccount({ type: AccountType.CHECKING });
            const tx = createTransaction({ isInstallment: true, totalInstallments: 12 });
            const result = validateTransaction(tx, account);
            expect(result.warnings).toContain('Parcelamento geralmente é usado apenas em cartões de crédito');
        });
    });

    describe('validações de despesa compartilhada', () => {
        it('deve rejeitar splits que não somam 100%', () => {
            const tx = createTransaction({
                isShared: true,
                sharedWith: [
                    { memberId: 'm1', percentage: 30, assignedAmount: 30, isSettled: false },
                    { memberId: 'm2', percentage: 30, assignedAmount: 30, isSettled: false }
                ]
            });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('100%'))).toBe(true);
        });

        it('deve rejeitar splits que excedem o valor total', () => {
            const tx = createTransaction({
                amount: 100,
                isShared: true,
                sharedWith: [
                    { memberId: 'm1', percentage: 50, assignedAmount: 60, isSettled: false },
                    { memberId: 'm2', percentage: 50, assignedAmount: 60, isSettled: false }
                ]
            });
            const result = validateTransaction(tx);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('maior que o total'))).toBe(true);
        });
    });

    describe('detecção de duplicatas', () => {
        it('deve alertar possível duplicata', () => {
            const existingTxs = [
                createTransaction({ id: 'tx-1' }) as Transaction
            ];
            const newTx = createTransaction();
            const result = validateTransaction(newTx, undefined, existingTxs);
            expect(result.warnings).toContain('Possível transação duplicada detectada');
        });
    });
});

describe('validateAccount', () => {
    it('deve rejeitar conta sem nome', () => {
        const account = createAccount({ name: '' });
        const result = validateAccount(account);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Nome da conta é obrigatório');
    });

    it('deve rejeitar conta sem tipo', () => {
        const account = createAccount({ type: undefined as unknown as AccountType });
        const result = validateAccount(account);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tipo de conta é obrigatório');
    });

    describe('validações de cartão de crédito', () => {
        it('deve rejeitar cartão sem limite', () => {
            const account = createAccount({ 
                type: AccountType.CREDIT_CARD, 
                limit: 0 
            });
            const result = validateAccount(account);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Limite do cartão deve ser maior que zero');
        });

        it('deve rejeitar cartão com dia de fechamento inválido', () => {
            const account = createAccount({ 
                type: AccountType.CREDIT_CARD, 
                limit: 5000,
                closingDay: 35,
                dueDay: 10
            });
            const result = validateAccount(account);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Dia de fechamento inválido (1-31)');
        });

        it('deve rejeitar cartão com dia de vencimento inválido', () => {
            const account = createAccount({ 
                type: AccountType.CREDIT_CARD, 
                limit: 5000,
                closingDay: 25,
                dueDay: 0
            });
            const result = validateAccount(account);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Dia de vencimento inválido (1-31)');
        });
    });

    it('deve alertar para saldo muito alto', () => {
        const account = createAccount({ balance: 50000000 });
        const result = validateAccount(account);
        expect(result.warnings).toContain('Saldo muito alto. Confirme se está correto.');
    });
});

describe('validateBudgetLimit', () => {
    it('deve retornar safe quando dentro do orçamento', () => {
        const result = validateBudgetLimit(500, 1000);
        expect(result.status).toBe('safe');
        expect(result.percentage).toBe(50);
    });

    it('deve retornar warning quando próximo do limite', () => {
        const result = validateBudgetLimit(850, 1000);
        expect(result.status).toBe('warning');
        expect(result.percentage).toBe(85);
    });

    it('deve retornar danger quando estourado', () => {
        const result = validateBudgetLimit(1200, 1000);
        expect(result.status).toBe('danger');
        expect(result.percentage).toBe(120);
    });
});

describe('validateCreditLimit', () => {
    it('deve retornar safe quando tem limite disponível', () => {
        const account = createAccount({ 
            type: AccountType.CREDIT_CARD, 
            limit: 5000,
            balance: -1000 
        });
        const result = validateCreditLimit(account);
        expect(result.status).toBe('safe');
        expect(result.available).toBe(4000);
    });

    it('deve retornar warning quando próximo do limite', () => {
        const account = createAccount({ 
            type: AccountType.CREDIT_CARD, 
            limit: 5000,
            balance: -4200 
        });
        const result = validateCreditLimit(account);
        expect(result.status).toBe('warning');
    });

    it('deve retornar danger quando limite excedido', () => {
        const account = createAccount({ 
            type: AccountType.CREDIT_CARD, 
            limit: 5000,
            balance: -5500 
        });
        const result = validateCreditLimit(account);
        expect(result.status).toBe('danger');
    });

    it('deve considerar valor adicional', () => {
        const account = createAccount({ 
            type: AccountType.CREDIT_CARD, 
            limit: 5000,
            balance: -4000 
        });
        const result = validateCreditLimit(account, 1500);
        expect(result.status).toBe('danger');
    });
});
