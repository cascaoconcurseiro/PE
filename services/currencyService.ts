
// Mock Exchange Rates (In a real app, fetch from an API like OpenExchangeRates)
// Base: BRL (1 BRL = X Currency) -> Reciprocal logic used below
// We use: How much 1 Unit of Foreign Currency is worth in BRL
export const EXCHANGE_RATES: Record<string, number> = {
    'BRL': 1,
    'USD': 5.05, // 1 USD = 5.05 BRL
    'EUR': 5.45,
    'GBP': 6.35,
    'JPY': 0.034
};

export const AVAILABLE_CURRENCIES = [
    { code: 'BRL', name: 'Real Brasileiro (R$)' },
    { code: 'USD', name: 'Dólar Americano ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'Libra Esterlina (£)' },
    { code: 'JPY', name: 'Iene Japonês (¥)' }
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
