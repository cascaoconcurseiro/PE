import React, { useRef } from 'react';
import { Card } from '../ui/Card';
import { Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';
import { MiniSparkline } from './MiniSparkline';

interface SummaryCardsProps {
    netWorth: number;
    monthlyIncome: number;
    monthlyExpense: number;
    currentDate: Date;
    showValues: boolean;
    incomeSparkline?: number[];
    expenseSparkline?: number[];
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
    netWorth,
    monthlyIncome,
    monthlyExpense,
    currentDate,
    showValues,
    incomeSparkline = [],
    expenseSparkline = []
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollCards = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth * 0.85;
            container.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative group">
            {/* Mobile Navigation Arrows */}
            <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-20 pl-1">
                <button onClick={() => scrollCards('left')} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 active:scale-90 transition-transform">
                    <ChevronLeft className="w-5 h-5" />
                </button>
            </div>
            <div className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 z-20 pr-1">
                <button onClick={() => scrollCards('right')} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 active:scale-90 transition-transform">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div
                ref={scrollContainerRef}
                className="
                    flex md:grid md:grid-cols-3 gap-4 
                    overflow-x-auto md:overflow-visible 
                    pb-4 md:pb-0 
                    snap-x snap-mandatory 
                    -mx-4 px-4 md:mx-0 md:px-0 
                    scrollbar-hide scroll-smooth
                "
            >
                {/* NET WORTH CARD */}
                <div className="snap-center shrink-0 w-[88vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="bg-gradient-to-br from-slate-800 to-slate-950 text-white border-none shadow-xl shadow-slate-900/10 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Wallet className="w-24 h-24 text-white" />
                        </div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Patrimônio Líquido</p>
                                <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white">
                                    <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(netWorth)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="mt-6 inline-flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-800/80 border border-slate-700 px-2 py-1 rounded-lg font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Total Real (Ativos - Dívidas)
                        </div>
                    </Card>
                </div>

                {/* INCOME CARD */}
                <div className="snap-center shrink-0 w-[88vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-xl shadow-emerald-900/10 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp className="w-24 h-24 text-white" />
                        </div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-emerald-200/80 font-bold text-[10px] uppercase tracking-widest mb-1">
                                    Entradas ({currentDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')})
                                </p>
                                <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white">
                                    <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(monthlyIncome)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        {/* Sparkline */}
                        {incomeSparkline.length > 1 && (
                            <div className="mt-3 opacity-80">
                                <MiniSparkline data={incomeSparkline} color="emerald" width={120} height={28} showDots />
                                <p className="text-[9px] text-emerald-200/60 mt-1">Últimos 7 dias</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* EXPENSE CARD */}
                <div className="snap-center shrink-0 w-[88vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="bg-gradient-to-br from-red-600 to-rose-700 text-white border-none shadow-xl shadow-red-900/10 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingDown className="w-24 h-24 text-white" />
                        </div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-red-200/80 font-bold text-[10px] uppercase tracking-widest mb-1">
                                    Saídas (Minha Parte)
                                </p>
                                <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white">
                                    <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(monthlyExpense)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5">
                                <TrendingDown className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        {/* Sparkline */}
                        {expenseSparkline.length > 1 && (
                            <div className="mt-3 opacity-80">
                                <MiniSparkline data={expenseSparkline} color="red" width={120} height={28} showDots />
                                <p className="text-[9px] text-red-200/60 mt-1">Últimos 7 dias</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};