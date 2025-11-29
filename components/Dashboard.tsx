import React, { useMemo, useRef } from 'react';
import { Account, Transaction, TransactionType } from '../types';
import { Card } from './ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Bell, Clock, Wallet, PieChart as PieIcon, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { formatCurrency, isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';

interface DashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    currentDate?: Date;
    showValues: boolean;
    onEditRequest?: (id: string) => void;
}

const PrivacyBlur = ({ children, showValues, darkBg = false }: { children?: React.ReactNode, showValues: boolean, darkBg?: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className={`blur-sm select-none ${darkBg ? 'opacity-80' : 'opacity-60'}`}>R$ ••••</span>;
};

export const Dashboard: React.FC<DashboardProps> = ({ accounts, transactions, currentDate = new Date(), showValues, onEditRequest }) => {
    const selectedYear = currentDate.getFullYear();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll Handler for Mobile Cards
    const scrollCards = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = container.clientWidth * 0.85; // Scroll ~85% of width
            container.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // 1. FILTER TRANSACTIONS FOR SELECTED MONTH (Memoized)
    const monthlyTransactions = useMemo(() =>
        transactions.filter(t => isSameMonth(t.date, currentDate)),
        [transactions, currentDate]);

    // 2. CALCULATE NET WORTH (PATRIMÔNIO) NORMALIZED TO BRL (Memoized)
    const totalBalance = useMemo(() =>
        accounts.reduce((acc, curr) => {
            const normalizedBalance = convertToBRL(curr.balance, curr.currency || 'BRL');
            return acc + normalizedBalance;
        }, 0),
        [accounts]);

    // 3. SANITIZED METRICS FOR CARDS (Memoized)
    const monthlyIncome = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);
            const amount = t.isRefund ? -t.amount : t.amount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    const monthlyExpense = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);
            const amount = t.isRefund ? -t.amount : t.amount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    // 4. ANNUAL CASH FLOW LOGIC (12 MONTHS) (Memoized)
    const cashFlowData = useMemo(() => {
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            return {
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                monthIndex: i,
                Receitas: 0,
                Despesas: 0
            };
        });

        transactions.forEach(t => {
            const tDate = new Date(t.date);
            if (tDate.getFullYear() !== selectedYear) return;
            if (t.type === TransactionType.TRANSFER) return;

            const monthIndex = tDate.getMonth();
            const account = accounts.find(a => a.id === t.accountId);
            const amountBRL = convertToBRL(t.amount, account?.currency || 'BRL');

            if (t.type === TransactionType.EXPENSE) {
                const value = t.isRefund ? -amountBRL : amountBRL;
                data[monthIndex].Despesas += value;
            } else if (t.type === TransactionType.INCOME) {
                const value = t.isRefund ? -amountBRL : amountBRL;
                data[monthIndex].Receitas += value;
            }
        });

        return data;
    }, [transactions, selectedYear, accounts]);

    // Reminders Logic (Memoized)
    const upcomingBills = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return transactions
            .filter(t => t.enableNotification && t.type === TransactionType.EXPENSE && !t.isRefund)
            .filter(t => {
                const targetDateStr = t.notificationDate || t.date;
                const tDate = new Date(targetDateStr);
                return tDate >= today || (tDate < today && isSameMonth(targetDateStr, today));
            })
            .sort((a, b) => {
                const dateA = new Date(a.notificationDate || a.date).getTime();
                const dateB = new Date(b.notificationDate || b.date).getTime();
                return dateA - dateB;
            })
            .slice(0, 3);
    }, [transactions]);

    // Data for Category Pie Chart (Memoized)
    const categoryData = useMemo(() => Object.entries(
        monthlyTransactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((acc, t) => {
                const account = accounts.find(a => a.id === t.accountId);
                const amountBRL = convertToBRL(t.amount, account?.currency || 'BRL');
                const amount = t.isRefund ? -amountBRL : amountBRL;
                acc[t.category] = (acc[t.category] || 0) + (amount as number);
                return acc;
            }, {} as Record<string, number>)
    )
        .filter(([_, val]) => (val as number) > 0)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value), // Sort by value desc
    [monthlyTransactions, accounts]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-safe">

            {/* SUMMARY CARDS SECTION */}
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
                    {/* TOTAL BALANCE CARD */}
                    <div className="snap-center shrink-0 w-[88vw] sm:w-[45vw] md:w-auto h-full">
                        <Card className="bg-gradient-to-br from-slate-800 to-slate-950 text-white border-none shadow-xl shadow-slate-900/10 relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Wallet className="w-24 h-24 text-white" />
                            </div>
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Patrimônio Líquido</p>
                                    <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white">
                                        <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(totalBalance)}</PrivacyBlur>
                                    </h3>
                                </div>
                                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5">
                                    <Wallet className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="mt-6 inline-flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-800/80 border border-slate-700 px-2 py-1 rounded-lg font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Consolidado
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
                                        Saídas ({currentDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')})
                                    </p>
                                    <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white">
                                        <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(monthlyExpense)}</PrivacyBlur>
                                    </h3>
                                </div>
                                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5">
                                    <TrendingDown className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ANNUAL CASH FLOW CHART - DESKTOP ONLY */}
            <Card className="hidden md:block border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Fluxo de Caixa</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Visão consolidada do ano de {selectedYear}</p>
                    </div>
                </div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" className="stroke-slate-200 dark:stroke-slate-800" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: 'currentColor' }} 
                                className="text-slate-500 dark:text-slate-400 font-medium"
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: 'currentColor' }}
                                className="text-slate-400 dark:text-slate-500"
                                tickFormatter={(value) => {
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                                    return value.toFixed(0);
                                }}
                            />
                            <Tooltip
                                formatter={(value: number) => showValues ? formatCurrency(value) : '****'}
                                contentStyle={{ 
                                    backgroundColor: 'var(--color-bg)', 
                                    borderColor: 'var(--color-border)', 
                                    borderRadius: '12px', 
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    color: 'var(--color-text)'
                                }}
                                itemStyle={{ color: 'inherit' }}
                                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                wrapperClassName="dark:!bg-slate-800 dark:!border-slate-700 dark:!text-slate-200"
                            />
                            <Bar name="Receitas" dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar name="Despesas" dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* UPCOMING BILLS */}
            {upcomingBills.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-amber-900 dark:text-amber-400">
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Bell className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        </div>
                        <h3 className="font-bold text-sm uppercase tracking-wide">Próximos Vencimentos</h3>
                    </div>
                    <div className="space-y-3">
                        {upcomingBills.map(bill => {
                            const account = accounts.find(a => a.id === bill.accountId);
                            const billDate = new Date(bill.notificationDate || bill.date);
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const diffTime = billDate.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            let statusText = '';
                            if (diffDays === 0) statusText = 'Vence Hoje';
                            else if (diffDays < 0) statusText = `Venceu há ${Math.abs(diffDays)} dias`;
                            else statusText = `Vence em ${diffDays} dias`;

                            return (
                                <div
                                    key={bill.id}
                                    onClick={() => onEditRequest && onEditRequest(bill.id)}
                                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex justify-between items-center shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
                                >
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{bill.description}</p>
                                        <p className="text-xs text-amber-700 dark:text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3" /> {statusText} ({billDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                                        </p>
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white text-base">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(bill.amount, account?.currency)}</PrivacyBlur>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* CATEGORY SPENDING CHART (Improved) */}
            <Card className="border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <PieIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Distribuição de Gastos</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Top categorias do mês</p>
                    </div>
                </div>

                {categoryData.length > 0 ? (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Donut Chart */}
                        <div className="h-56 w-full md:w-1/2 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => showValues ? formatCurrency(value) : 'R$ ****'} 
                                        contentStyle={{ 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            backgroundColor: '#1e293b', 
                                            color: '#fff',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                        }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Gasto</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-white block tracking-tight">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(monthlyExpense)}</PrivacyBlur>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Custom Legend */}
                        <div className="w-full md:w-1/2 grid grid-cols-1 gap-2">
                            {categoryData.slice(0, 5).map((entry, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{entry.name}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-slate-900 dark:text-white font-bold text-sm block">
                                            <PrivacyBlur showValues={showValues}>{formatCurrency(entry.value)}</PrivacyBlur>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {((entry.value / monthlyExpense) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {categoryData.length > 5 && (
                                <div className="text-center mt-2">
                                    <span className="text-xs text-slate-400 italic">+ {categoryData.length - 5} outras categorias</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-56 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Wallet className="w-8 h-8 mb-2 opacity-50" />
                        <p className="font-medium text-sm">Sem despesas registradas.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};