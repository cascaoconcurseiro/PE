import React from 'react';
import { Card } from '../ui/Card';
import { Target, Trophy } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { Goal } from '../../types';

interface GoalsSummaryProps {
    goals: Goal[];
}

export const GoalsSummary: React.FC<GoalsSummaryProps> = ({ goals }) => {
    const totalCurrent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
    const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
    const globalProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Saved Card */}
            <Card className="md:col-span-2 bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Target className="w-32 h-32 text-white" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Acumulado</p>
                            <h3 className="text-4xl font-black tracking-tight">{formatCurrency(totalCurrent)}</h3>
                            <p className="text-emerald-100/80 text-sm mt-1">de {formatCurrency(totalTarget)} planejados</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                            <Target className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-emerald-100">
                            <span>Progresso Global</span>
                            <span>{globalProgress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                            <div
                                className="h-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.5)] rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(globalProgress, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Achievements Card */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none shadow-lg relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                    <Trophy className="w-24 h-24 text-white" />
                </div>
                <div className="relative z-10 text-center p-2">
                    <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center mb-3 ring-1 ring-amber-500/50">
                        <Trophy className="w-8 h-8 text-amber-400" />
                    </div>
                    <h4 className="text-3xl font-black text-white mb-1">{completedGoals}</h4>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Metas Concluídas</p>
                    <div className="mt-4 pt-4 border-t border-white/10 w-full">
                        <p className="text-xs text-slate-300">
                            {goals.length - completedGoals} em andamento
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
