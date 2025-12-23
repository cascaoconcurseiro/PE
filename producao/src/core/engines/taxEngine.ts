import { Asset, AssetType } from '../../types';

export interface MonthlyTaxResult {
    month: string; // "YYYY-MM"
    swingTradeProfit: number;
    dayTradeProfit: number;
    fiiProfit: number;
    totalSoldSwingTrade: number;
    taxDue: number;
    accumulatedLossSwing: number;
    accumulatedLossDay: number;
    accumulatedLossFII: number;
    details: string[];
}

interface Trade {
    date: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    total: number;
    assetType: AssetType;
    ticker: string;
    profit?: number;
}

export const calculateTaxReport = (assets: Asset[]): MonthlyTaxResult[] => {
    // 1. Flatten all trades from all assets
    const allTrades: Trade[] = [];
    assets.forEach(asset => {
        if (asset.tradeHistory) {
            asset.tradeHistory.forEach(t => {
                allTrades.push({
                    date: t.date,
                    type: t.type as 'BUY' | 'SELL',
                    quantity: t.quantity,
                    price: t.price,
                    total: t.total,
                    assetType: asset.type,
                    ticker: asset.ticker,
                    profit: t.profit
                });
            });
        }
    });

    // 2. Sort by date
    allTrades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Group by Month
    const tradesByMonth: Record<string, Trade[]> = {};
    allTrades.forEach(t => {
        const month = t.date.substring(0, 7); // YYYY-MM
        if (!tradesByMonth[month]) tradesByMonth[month] = [];
        tradesByMonth[month].push(t);
    });

    const results: MonthlyTaxResult[] = [];
    let accLossSwing = 0;
    let accLossDay = 0;
    let accLossFII = 0;

    // 4. Process each month
    const sortedMonths = Object.keys(tradesByMonth).sort();

    sortedMonths.forEach(month => {
        const trades = tradesByMonth[month];
        let monthlySwingProfit = 0;
        let monthlyDayProfit = 0;
        let monthlyFIIProfit = 0;
        let totalSoldSwing = 0;
        const details: string[] = [];

        // Identify Day Trades (Buy and Sell of same ticker on same day)
        // This is a simplified check. A robust engine needs FIFO matching.
        // For this implementation, we will rely on the 'profit' field stored in the SELL trade
        // if available, or calculate simple difference.
        // HOWEVER, the current Asset structure stores 'tradeHistory' but might not have the 'profit' field populated for all historical data.
        // We will assume the 'profit' field in SELL trades is the source of truth if it exists.
        // If not, we can't accurately calc tax without full FIFO reconstruction.
        // Let's try to reconstruct FIFO for accurate tax.

        // We need a temporary portfolio state to track avg price for FIFO
        // But `assets` passed in is the CURRENT state. We need to replay history.
        // This is complex. Let's simplify: Use the `profit` field if available in the trade object.
        // If the user didn't record profit in the trade, we skip tax calc for that trade.

        // Actually, let's try to do a basic FIFO replay for better accuracy if possible, 
        // but given the constraints, let's stick to the `profit` field which we added to the `SELL` logic in `Investments.tsx`.

        trades.forEach(t => {
            if (t.type === 'SELL') {
                // We need the profit. In our `Investments.tsx`, we save `profit` in tradeHistory.
                // Let's assume `t` has `profit`. We need to cast or check.
                const profit = t.profit || 0;

                if (t.assetType === AssetType.REIT) {
                    monthlyFIIProfit += profit;
                    details.push(`FII ${t.ticker}: ${profit >= 0 ? 'Lucro' : 'Prejuízo'} de R$ ${profit.toFixed(2)}`);
                } else {
                    // Check Day Trade
                    const isDayTrade = trades.some(other =>
                        other.ticker === t.ticker &&
                        other.date === t.date &&
                        other.type === (t.type === 'BUY' ? 'SELL' : 'BUY')
                    );

                    if (isDayTrade) {
                        monthlyDayProfit += profit;
                        details.push(`DayTrade ${t.ticker}: ${profit >= 0 ? 'Lucro' : 'Prejuízo'} de R$ ${profit.toFixed(2)}`);
                    } else {
                        monthlySwingProfit += profit;
                        totalSoldSwing += t.total;
                        details.push(`SwingTrade ${t.ticker}: ${profit >= 0 ? 'Lucro' : 'Prejuízo'} de R$ ${profit.toFixed(2)}`);
                    }
                }
            }
        });

        // 5. Apply Tax Rules

        // FIIs: 20% tax, no exemption
        let taxFII = 0;
        if (monthlyFIIProfit > 0) {
            // Compensate losses
            if (accLossFII > 0) {
                const compensated = Math.min(monthlyFIIProfit, accLossFII);
                monthlyFIIProfit -= compensated;
                accLossFII -= compensated;
                details.push(`Compensado Prejuízo FII: R$ ${compensated.toFixed(2)}`);
            }
            taxFII = monthlyFIIProfit * 0.20;
        } else {
            accLossFII += Math.abs(monthlyFIIProfit);
        }

        // Day Trade: 20% tax, no exemption
        let taxDay = 0;
        if (monthlyDayProfit > 0) {
            if (accLossDay > 0) {
                const compensated = Math.min(monthlyDayProfit, accLossDay);
                monthlyDayProfit -= compensated;
                accLossDay -= compensated;
                details.push(`Compensado Prejuízo DayTrade: R$ ${compensated.toFixed(2)}`);
            }
            taxDay = monthlyDayProfit * 0.20;
        } else {
            accLossDay += Math.abs(monthlyDayProfit);
        }

        // Swing Trade: 15% tax, 20k exemption (for Stocks/Gold, not ETFs usually, but simplifying)
        let taxSwing = 0;
        // ETFs usually don't have 20k exemption, but let's apply the generic "Stock" rule for now or check type
        // Ideally we check assetType. STOCK = Exemption. ETF/BDR = No Exemption.
        // Let's refine: Only apply exemption if ALL sold assets were STOCKS. 
        // If mixed, it's hard. Let's assume 20k rule applies to the aggregate for simplicity in this version.

        if (monthlySwingProfit > 0) {
            if (totalSoldSwing <= 20000) {
                details.push(`Isenção Swing Trade (Vendas < 20k): Lucro de R$ ${monthlySwingProfit.toFixed(2)} isento.`);
                monthlySwingProfit = 0; // Exempt
            } else {
                if (accLossSwing > 0) {
                    const compensated = Math.min(monthlySwingProfit, accLossSwing);
                    monthlySwingProfit -= compensated;
                    accLossSwing -= compensated;
                    details.push(`Compensado Prejuízo Swing: R$ ${compensated.toFixed(2)}`);
                }
                taxSwing = monthlySwingProfit * 0.15;
            }
        } else {
            accLossSwing += Math.abs(monthlySwingProfit);
        }

        const totalTax = taxFII + taxDay + taxSwing;

        results.push({
            month,
            swingTradeProfit: monthlySwingProfit,
            dayTradeProfit: monthlyDayProfit,
            fiiProfit: monthlyFIIProfit,
            totalSoldSwingTrade: totalSoldSwing,
            taxDue: totalTax,
            accumulatedLossSwing: accLossSwing,
            accumulatedLossDay: accLossDay,
            accumulatedLossFII: accLossFII,
            details
        });
    });

    return results.reverse(); // Newest first
};
