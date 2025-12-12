export const EXCHANGE_RATES: Record<string, number> = {
    'BRL': 1,
    'USD': 6.05,
    'EUR': 6.35,
    'GBP': 7.55,
    'JPY': 0.040,
    'ARS': 0.006,
    'CLP': 0.006,
    'UYU': 0.14,
    'PYG': 0.0008,
    'COP': 0.0014,
    'MXN': 0.30,
    'CAD': 4.25,
    'AUD': 3.90,
    'CHF': 6.70,
    'CNY': 0.83,
    'PEN': 1.60
};

export const AVAILABLE_CURRENCIES = [
    { code: 'BRL', name: 'Real Brasileiro (R$)' },
    { code: 'USD', name: 'Dólar Americano ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'Libra Esterlina (£)' },
    { code: 'JPY', name: 'Iene Japonês (¥)' },
    { code: 'ARS', name: 'Peso Argentino ($)' },
    { code: 'CLP', name: 'Peso Chileno ($)' },
    { code: 'UYU', name: 'Peso Uruguaio ($)' },
    { code: 'PYG', name: 'Guarani Paraguaio (₲)' },
    { code: 'COP', name: 'Peso Colombiano ($)' },
    { code: 'MXN', name: 'Peso Mexicano ($)' },
    { code: 'CAD', name: 'Dólar Canadense ($)' },
    { code: 'AUD', name: 'Dólar Australiano ($)' },
    { code: 'CHF', name: 'Franco Suíço (Fr)' },
    { code: 'CNY', name: 'Yuan Chinês (¥)' },
    { code: 'PEN', name: 'Sol Peruano (S/)' }
];

/**
 * Converts any amount to BRL for aggregation purposes
 */
export const convertToBRL = (amount: number, currencyCode: string): number => {
    const rate = EXCHANGE_RATES[currencyCode] || 1;
    return amount * rate;
};

/**
 * Gets the exchange rate used for conversion
 */
export const getExchangeRate = (currencyCode: string): number => {
    return EXCHANGE_RATES[currencyCode] || 1;
};