import React, { useMemo } from 'react';
import { Account, Transaction, TransactionType } from '../types';
import { Card } from './ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Bell, Clock, Wallet } from 'lucide-react';
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
    // Adjust opacity based on background for better visibility when blurred
    return <span className={`blur-sm select-none ${darkBg ? 'opacity-80' : 'opacity-60'}`}>R$ ••••</span>;
};

export const Dashboard: React.FC<DashboardProps> = ({ accounts, transactions, currentDate = new Date(), showValues, onEditRequest }) => {
    const selectedYear = currentDate.getFullYear();

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
            // Filter by selected Year
            if (tDate.getFullYear() !== selectedYear) return;
            if (t.type === TransactionType.TRANSFER) return; // Ignore transfers

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
                // Show if future/today OR if past but same month (recently overdue)
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
        .map(([name, value]) => ({ name, value: value as number })), [monthlyTransactions, accounts]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-4">

            {/* SUMMARY CARDS SECTION */}
            {/* Mobile: Horizontal Scroll Snap | Desktop: Grid */}
            <div className="
        flex md:grid md:grid-cols-3 gap-4 
        overflow-x-auto md:overflow-visible 
        pb-6 md:pb-0 
        snap-x snap-mandatory 
        -mx-4 px-4 md:mx-0 md:px-0 
        scrollbar-hide
      ">

                {/* TOTAL BALANCE CARD - IMPROVED CONTRAST */}
                <div className="snap-center shrink-0 w-[85vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white border-none shadow-xl shadow-emerald-900/20 relative overflow-hidden h-full active:scale-[0.98] transition-transform duration-200">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wallet className="w-24 h-24 text-white" />
                        </div>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-emerald-100 font-bold text-xs uppercase tracking-wider mb-1 opacity-90">Patrimônio Líquido</p>
                                <h3 className="text-3xl font-black mt-1 tracking-tight truncate text-white drop-shadow-sm">
                                    <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(totalBalance)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/10">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-emerald-50 bg-emerald-900/30 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold shadow-sm backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 box-shadow-glow"></span> Total convertido (BRL)
                        </div>
                    </Card>
                </div>

                {/* INCOME CARD */}
                <div className="snap-center shrink-0 w-[85vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="border border-slate-200 shadow-sm h-full flex flex-col justify-center active:scale-[0.98] transition-transform duration-200 bg-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-600 font-bold text-xs uppercase tracking-wider">Entradas <span className="text-slate-500 font-normal">({currentDate.toLocaleDateString('pt-BR', { month: 'short' })})</span></p>
                                <h3 className="text-2xl font-black mt-1 text-emerald-700 truncate tracking-tight">
                                    <PrivacyBlur showValues={showValues}>{formatCurrency(monthlyIncome)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* EXPENSE CARD */}
                <div className="snap-center shrink-0 w-[85vw] sm:w-[45vw] md:w-auto h-full">
                    <Card className="border border-slate-200 shadow-sm h-full flex flex-col justify-center active:scale-[0.98] transition-transform duration-200 bg-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-600 font-bold text-xs uppercase tracking-wider">Saídas <span className="text-slate-500 font-normal">({currentDate.toLocaleDateString('pt-BR', { month: 'short' })})</span></p>
                                <h3 className="text-2xl font-black mt-1 text-red-700 truncate tracking-tight">
                                    <PrivacyBlur showValues={showValues}>{formatCurrency(monthlyExpense)}</PrivacyBlur>
                                </h3>
                            </div>
                            <div className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                                <TrendingDown className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* ANNUAL CASH FLOW CHART */}
            <Card title={`Fluxo de Caixa - ${selectedYear}`} className="hidden md:block border-slate-200 bg-white">
                <div className="h-72 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                tickFormatter={(value) => {
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                                    return value.toFixed(0);
                                }}
                            />
                            <Tooltip
                                formatter={(value: number) => showValues ? formatCurrency(value) : '****'}
                                contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px', color: '#1e293b' }}
                                cursor={{ fill: '#f8fafc' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', color: '#475569' }} />
                            <Bar name="Receitas" dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar name="Despesas" dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Upcoming Bills Section */}
            {upcomingBills.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 mb-4 text-amber-900">
                        <div className="p-1.5 bg-amber-100 rounded-lg border border-amber-200">
                            <Bell className="w-4 h-4 text-amber-700" />
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
                                    className="bg-white p-4 rounded-xl border border-amber-100 flex justify-between items-center shadow-sm active:scale-[0.99] transition-transform cursor-pointer hover:bg-amber-50/50"
                                >
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{bill.description}</p>
                                        <p className="text-xs text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3" /> {statusText} ({billDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                                        </p>
                                    </div>
                                    <span className="font-bold text-slate-900 text-base">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(bill.amount, account?.currency)}</PrivacyBlur>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Spending Chart (Mobile Optimized) */}
            <Card title={`Gastos por Categoria`} className="min-h-[420px] md:min-h-[400px] border-slate-200 bg-white">
                {categoryData.length > 0 ? (
                    <div className="h-full w-full mt-2 flex flex-col md:flex-row items-center">
                        <div className="h-64 w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => showValues ? formatCurrency(value) : 'R$ ****'} contentStyle={{ borderRadius: '12px', border: '1px solid #cbd5e1' }} />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Center Text for Pie */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Total</span>
                                    <span className="text-lg font-bold text-slate-900 block">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(monthlyExpense)}</PrivacyBlur>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Legend Grid */}
                        <div className="w-full grid grid-cols-2 gap-3 pt-4 md:pl-8 md:pt-0">
                            {categoryData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-slate-800 text-xs truncate">{entry.name}</span>
                                        <span className="text-slate-600 text-xs font-medium">
                                            <PrivacyBlur showValues={showValues}>{formatCurrency(entry.value)}</PrivacyBlur>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="font-medium">Sem despesas neste mês</p>
                    </div>
                )}
            </Card>
        </div>
    );
};