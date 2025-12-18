/**
 * Utilitários para manipulação de tipos de conta
 * Centraliza a lógica de comparação para evitar inconsistências
 */

import { AccountType } from '../types';

/**
 * Normaliza um tipo de conta para comparação
 * Remove acentos, converte para maiúsculas
 */
export const normalizeAccountType = (type: string | undefined): string => {
    if (!type) return '';
    return type.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Valores normalizados dos enums
const NORMALIZED_TYPES = {
    CHECKING: normalizeAccountType(AccountType.CHECKING),
    SAVINGS: normalizeAccountType(AccountType.SAVINGS),
    CREDIT_CARD: normalizeAccountType(AccountType.CREDIT_CARD),
    CASH: normalizeAccountType(AccountType.CASH),
    INVESTMENT: normalizeAccountType(AccountType.INVESTMENT),
};

/**
 * Verifica se uma conta é do tipo Cartão de Crédito
 */
export const isCreditCard = (type: string | undefined): boolean => {
    const typeNorm = normalizeAccountType(type);
    return typeNorm === NORMALIZED_TYPES.CREDIT_CARD ||
           typeNorm === 'CARTAO DE CREDITO' ||
           typeNorm === 'CREDIT_CARD' ||
           (typeNorm.includes('CARTAO') && typeNorm.includes('CREDITO'));
};

/**
 * Verifica se uma conta é líquida (checking, savings, cash)
 */
export const isLiquidAccount = (type: string | undefined): boolean => {
    const typeNorm = normalizeAccountType(type);
    return typeNorm === NORMALIZED_TYPES.CHECKING ||
           typeNorm === NORMALIZED_TYPES.SAVINGS ||
           typeNorm === NORMALIZED_TYPES.CASH;
};

/**
 * Verifica se uma conta é de investimento
 */
export const isInvestmentAccount = (type: string | undefined): boolean => {
    const typeNorm = normalizeAccountType(type);
    return typeNorm === NORMALIZED_TYPES.INVESTMENT ||
           typeNorm === 'INVESTMENT' ||
           typeNorm === 'INVESTIMENTOS';
};

/**
 * Retorna o ícone apropriado para o tipo de conta
 */
export const getAccountTypeLabel = (type: string | undefined): string => {
    if (isCreditCard(type)) return 'Cartão de Crédito';
    if (isLiquidAccount(type)) {
        const typeNorm = normalizeAccountType(type);
        if (typeNorm === NORMALIZED_TYPES.CHECKING) return 'Conta Corrente';
        if (typeNorm === NORMALIZED_TYPES.SAVINGS) return 'Poupança';
        if (typeNorm === NORMALIZED_TYPES.CASH) return 'Dinheiro';
    }
    if (isInvestmentAccount(type)) return 'Investimentos';
    return 'Outros';
};
