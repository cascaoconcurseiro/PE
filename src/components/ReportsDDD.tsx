import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Loader2, TrendingUp, TrendingDown, Landmark, PieChart } from 'lucide-react';

export function ReportsDDD() {
    const [balanceSheet, setBalanceSheet] = useState<Array<Record<string, unknown>>>([]);
    const [incomeStatement, setIncomeStatement] = useState<Array<Record<string, unknown>>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const bs = await supabaseService.getBalanceSheet();
            const dre = await supabaseService.getIncomeStatement();
            setBalanceSheet(bs || []);
            setIncomeStatement(dre || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Totals
    const assetsTotal = balanceSheet.filter(i => i.account_type === 'ASSET').reduce((acc, curr) => acc + (Number(curr.display_balance) || 0), 0);
    const liabilitiesTotal = balanceSheet.filter(i => i.account_type === 'LIABILITY').reduce((acc, curr) => acc + (Number(curr.display_balance) || 0), 0);
    const equityTotal = balanceSheet.filter(i => i.account_type === 'EQUITY').reduce((acc, curr) => acc + (Number(curr.display_balance) || 0), 0);

    const netWorth = assetsTotal - liabilitiesTotal; // Should match Equity ideally in pure double entry, but Equity is usually "residual" in migrations

    // Group DRE by Month
    const months = Array.from(new Set(incomeStatement.map(i => String(i.month_year)))).sort().reverse();

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <PieChart className="w-8 h-8 text-emerald-500" />
                        Relatórios Contábeis
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Dados extraídos do Core DDD (Partidas Dobradas)
                    </p>
                </div>
            </div>

            {/* Balanço Patrimonial */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-blue-500" />
                    Balanço Patrimonial
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* ATIVOS */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Ativos</h3>
                            <span className="text-xl font-bold text-slate-900 dark:text-white">
                                {assetsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {balanceSheet.filter(i => i.account_type === 'ASSET').map(acc => (
                                <div key={String(acc.account_name)} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-300">{String(acc.account_name)}</span>
                                    <span className="font-medium text-slate-900 dark:text-white">
                                        {Number(acc.display_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PASSIVOS */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 h-fit">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Passivos</h3>
                            <span className="text-xl font-bold text-slate-900 dark:text-white">
                                {liabilitiesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {balanceSheet.filter(i => i.account_type === 'LIABILITY').map(acc => (
                                <div key={String(acc.account_name)} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-300">{String(acc.account_name)}</span>
                                    <span className="font-medium text-slate-900 dark:text-white">
                                        {Number(acc.display_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PATRIMÔNIO LÍQUIDO (RESULTADO) */}
                    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg h-fit">
                        <h3 className="text-lg font-medium text-slate-300 mb-2">Patrimônio Líquido</h3>
                        <div className="text-3xl font-bold text-emerald-400 mb-6">
                            {netWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="space-y-2 border-t border-slate-700 pt-4">
                            {balanceSheet.filter(i => i.account_type === 'EQUITY').map(acc => (
                                <div key={String(acc.account_name)} className="flex justify-between text-sm">
                                    <span className="text-slate-400">{String(acc.account_name)}</span>
                                    <span className="font-medium">
                                        {Number(acc.display_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* DRE (Income Statement) */}
            <section className="space-y-4 pt-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                    DRE - Resultado do Exercício
                </h2>

                <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                        {months.map(month => {
                            const rev = incomeStatement.filter(i => String(i.month_year) === month && i.account_type === 'REVENUE').reduce((a, b) => a + Number(b.period_amount), 0);
                            const exp = incomeStatement.filter(i => String(i.month_year) === month && i.account_type === 'EXPENSE').reduce((a, b) => a + Number(b.period_amount), 0);
                            const profit = rev - exp;
                            const isProfit = profit >= 0;

                            return (
                                <div key={month} className="min-w-[280px] bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                                    <h4 className="font-bold text-lg text-slate-700 dark:text-slate-200 border-b dark:border-slate-700 pb-2">
                                        {month}
                                    </h4>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Receitas</span>
                                        <span className="text-emerald-600 font-medium font-mono">
                                            +{rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Despesas</span>
                                        <span className="text-red-500 font-medium font-mono">
                                            -{exp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className={`mt-2 pt-2 border-t dark:border-slate-700 flex justify-between items-center font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                                        <span>Resultado</span>
                                        <span className="text-lg">
                                            {profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}
