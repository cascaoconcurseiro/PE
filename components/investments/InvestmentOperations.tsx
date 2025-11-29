import React from 'react';
import { Button } from '../ui/Button';
import { ArrowRightLeft, Plus, Minus, DollarSign, FileUp } from 'lucide-react';

interface InvestmentOperationsProps {
    onNewAsset: () => void;
    onSell: () => void;
    onDividend: () => void;
    onIR: () => void;
}

export const InvestmentOperations: React.FC<InvestmentOperationsProps> = ({
    onNewAsset,
    onSell,
    onDividend,
    onIR
}) => {
    return (
        <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Central de Operações
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                    onClick={onNewAsset}
                    variant="secondary"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 hover:shadow-md transition-all group"
                >
                    <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 text-xs">Novo Aporte</span>
                </Button>

                <Button
                    onClick={onSell}
                    variant="secondary"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-red-500 hover:ring-1 hover:ring-red-500 hover:shadow-md transition-all group"
                >
                    <div className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                        <Minus className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-700 dark:group-hover:text-red-400 text-xs">Registrar Venda</span>
                </Button>

                <Button
                    onClick={onDividend}
                    variant="secondary"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 hover:shadow-md transition-all group"
                >
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <DollarSign className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 text-xs">Proventos</span>
                </Button>

                <Button
                    onClick={onIR}
                    variant="secondary"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:ring-1 hover:ring-slate-400 hover:shadow-md transition-all group"
                >
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                        <FileUp className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-xs">Relatório IR</span>
                </Button>
            </div>
        </div>
    );
};
