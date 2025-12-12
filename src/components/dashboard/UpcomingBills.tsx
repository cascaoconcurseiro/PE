import React from 'react';
import { Bell, Clock } from 'lucide-react';
import { Transaction, Account } from '../../types';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface UpcomingBillsProps {
    bills: Transaction[];
    accounts: Account[];
    showValues: boolean;
    onEditRequest?: (id: string) => void;
}

export const UpcomingBills: React.FC<UpcomingBillsProps> = ({ bills, accounts, showValues, onEditRequest }) => {
    if (bills.length === 0) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-amber-900 dark:text-amber-400">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Bell className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wide">Próximos Vencimentos</h3>
            </div>
            <div className="space-y-3">
                {bills.map(bill => {
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
    );
};