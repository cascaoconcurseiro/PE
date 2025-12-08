import { Card } from '../ui/Card';
import { BarChart3 } from 'lucide-react';
import { DivergingBarChart } from '../ui/SimpleCharts';
import { formatCurrency } from '../../utils';

interface CashFlowChartProps {
    data: any[];
    hasData: boolean;
    year?: number;
    periodLabel?: string;
    showValues: boolean;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, hasData, year, periodLabel, showValues }) => {
    // Transform data for DivergingBarChart
    // Dashboard now passes Despesas as negative numbers, Receitas as positive
    const chartData = data.map(item => ({
        name: item.month,
        valueUp: item.Receitas,
        valueDown: item.Despesas // Already negative from business logic
    }));

    return (
        <Card className="border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Fluxo de Caixa</h3>
                    {periodLabel && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {periodLabel}
                        </p>
                    )}
                </div>
            </div>
            <div className="h-60 md:h-72 w-full px-2">
                {hasData ? (
                    <DivergingBarChart data={chartData} height={250} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Sem dados para este período</p>
                    </div>
                )}
            </div>

            {/* Annual Summary Footer */}
            {hasData && (
                <>
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-4 text-xs sm:text-sm">
                        <div className="text-emerald-600 dark:text-emerald-400">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Entradas</span>
                            <span className="font-bold">{formatCurrency(data.reduce((acc, curr) => acc + (curr.Receitas || 0), 0))}</span>
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Saídas</span>
                            <span className="font-bold">{formatCurrency(data.reduce((acc, curr) => acc + (Math.abs(curr.Despesas) || 0), 0))}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Saldo Ano</span>
                            <span className="font-bold">
                                {formatCurrency(
                                    data.reduce((acc, curr) => acc + (curr.Receitas || 0) + (curr.Despesas || 0), 0) // Despesas are negative
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Detailed Data Table */}
                    <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full text-xs text-center whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 w-32 border-r border-slate-100 dark:border-slate-800">Mês</th>
                                    {data.map((item, idx) => (
                                        <th key={idx} className="px-3 py-2 min-w-[80px]">{item.month}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {/* Monthly Result Row */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300 text-left sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">
                                        Resumo Mensal
                                    </td>
                                    {data.map((item, idx) => {
                                        const result = (item.Receitas || 0) + (item.Despesas || 0);
                                        return (
                                            <td key={idx} className={`px-3 py-2 font-bold ${result >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(result)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* Accumulated Row */}
                                <tr className="bg-slate-50/30 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300 text-left sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">
                                        Acumulado
                                    </td>
                                    {data.map((item, idx) => {
                                        // Calculate accumulated up to this index
                                        let acc = 0;
                                        for (let i = 0; i <= idx; i++) {
                                            acc += (data[i].Receitas || 0) + (data[i].Despesas || 0);
                                        }
                                        return (
                                            <td key={idx} className={`px-3 py-2 font-bold ${acc >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(acc)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Card >
    );
};