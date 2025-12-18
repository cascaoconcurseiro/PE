export const getMonthlyDebt = (transactions: import('../types').Transaction[], month: string) => {
  // month format: 'YYYY-MM'
  return transactions
    .filter((t) => t.date.startsWith(month))
    .reduce((sum, t) => sum + Number(t.amount), 0);
};

export const getHistoricalDebt = (transactions: import('../types').Transaction[], month: string) => {
  // Sum of all transactions before the given month
  return transactions
    .filter((t) => t.date < month)
    .reduce((sum, t) => sum + Number(t.amount), 0);
};

export const getFutureDebt = (transactions: import('../types').Transaction[], month: string) => {
  // Sum of all transactions after the given month
  return transactions
    .filter((t) => t.date > month)
    .reduce((sum, t) => sum + Number(t.amount), 0);
};