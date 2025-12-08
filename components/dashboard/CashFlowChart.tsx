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
        </Card>
    );
};