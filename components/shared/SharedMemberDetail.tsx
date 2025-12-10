import React, { useMemo, useState } from 'react';
import { FamilyMember, Transaction, Category, InvoiceItem } from '../../types';
import { Button } from '../ui/Button';
import { ArrowDownLeft, Clock, FileUp, ShoppingBag, CreditCard, Users, Trash2, Edit2, CheckSquare, Square, Download, Printer } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { exportToCSV, prepareTransactionsForExport } from '../../services/exportUtils';
import { printAccountStatement } from '../../services/printUtils';

// Reusable Privacy Blur
const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

interface SharedMemberDetailProps {
    member: FamilyMember;
    items: InvoiceItem[];
    // Totals passed pre-calculated or calculated here? Passing items is enough.
    currentDate: Date;
    showValues: boolean;
    currency: string;

    // Actions
    onSettle: (type: 'PAY' | 'RECEIVE', amount: number) => void;
    onImport: () => void;
    onEditTransaction: (id: string) => void;
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onBulkDelete?: (ids: string[]) => void;
}

export const SharedMemberDetail: React.FC<SharedMemberDetailProps> = ({
    member, items, currentDate, showValues, currency,
    onSettle, onImport, onEditTransaction, onDeleteTransaction, onBulkDelete
}) => {

    // Selection Mode State (Preserving user feature)
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // 1. Calculate Totals
    const { totalExpenses, totalIncome, netTotal } = useMemo(() => {
        let expenses = 0; // I owe them (Credit) -> Positive in Debt
        let income = 0;   // They owe me (Debit) -> Negative in Debt?
        // Wait, "InvoiceItem" types:
        // DEBIT = They owe me (I paid) -> Positive receiving?
        // CREDIT = I owe them (They paid) -> Negative paying?

        // Let's stick to the visual: "Fatura de X" = How much I have to PAY X.
        // So Credit (I owe) is the main "Expense".
        // Debit (They owe) reduces the bill.

        let net = 0;

        items.forEach(i => {
            if (i.isPaid) return; // Ignore settled

            // If Type CREDIT (I owe): Increases my bill.
            if (i.type === 'CREDIT') {
                expenses += i.amount;
                net += i.amount;
            } else {
                // Type DEBIT (They owe me): Decreases my bill (Refund alike)
                income += i.amount;
                net -= i.amount;
            }
        });

        return { totalExpenses: expenses, totalIncome: income, netTotal: net };
    }, [items]);

    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const handleSelectAll = () => {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(i => i.originalTxId)));
        }
    };

    const handleBulkDelete = () => {
        if (onBulkDelete) {
            onBulkDelete(Array.from(selectedItems));
            setIsSelectionMode(false);
            setSelectedItems(new Set());
        }
    };

    const handleExport = (format: 'CSV' | 'PDF') => {
        // Map InvoiceItems back to a structure export knows?
        // Or just map to CSV friendly object
        const data = items.map(i => ({
            Data: new Date(i.date).toLocaleDateString('pt-BR'),
            Descrição: i.description,
            Categoria: i.category,
            Valor: formatCurrency(i.amount, currency),
            Tipo: i.type === 'CREDIT' ? 'Despesa' : 'Reembolso'
        }));

        if (format === 'CSV') {
            exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Valor', 'Tipo'], `Fatura_${member.name}_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}`);
        } else {
            // Mocking print for now or reusing printAccountStatement if adaptable
            // printAccountStatement expects Account + Transactions.
            // We can construct a fake account and tx list.
            printAccountStatement({ ...member, name: member.name, type: 'OTHER', currency } as any,
                items.map(i => ({
                    id: i.originalTxId,
                    date: i.date,
                    description: i.description,
                    amount: i.amount,
                    type: i.type === 'CREDIT' ? 'EXPENSE' : 'INCOME',
                    category: i.category as Category,
                    accountId: 'shared',
                    isShared: true
                } as any))
            );
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Main Summary Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
                {/* Gradient Header - Different color for Shared/People? Maybe Indigo/Blue */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-cyan-500"></div>

                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                                    <Users className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Fatura de {currentDate.toLocaleDateString('pt-BR', { month: 'long' })} de {member.name}
                                </span>
                            </div>
                            <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${netTotal > 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                <PrivacyBlur showValues={showValues}>
                                    {netTotal >= 0 ? formatCurrency(netTotal, currency) : `+ ${formatCurrency(Math.abs(netTotal), currency)}`}
                                </PrivacyBlur>
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                                {items.length} lançamentos neste mês
                                {netTotal < 0 && <span className="ml-2 font-bold text-emerald-600">(A receber)</span>}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {/* Action Buttons */}
                            {netTotal !== 0 && (
                                <Button
                                    onClick={() => onSettle(netTotal > 0 ? 'PAY' : 'RECEIVE', Math.abs(netTotal))}
                                    className={`w-full md:w-auto rounded-xl font-bold shadow-lg text-white min-w-[160px] ${netTotal > 0
                                            ? 'shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700'
                                            : 'shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                >
                                    {netTotal > 0 ? 'Pagar Fatura' : 'Receber Valor'}
                                </Button>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    onClick={onImport}
                                    variant="secondary"
                                    className="flex-1 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    <FileUp className="w-4 h-4 mr-2" /> Importar
                                </Button>
                                {/* Extra Actions Dropdown or Row */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mini Stats Footer with Exports */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                    <div className="flex gap-4">
                        <span>Total Despesas: {formatCurrency(totalExpenses, currency)}</span>
                        <span>Total Reembolsos: {formatCurrency(totalIncome, currency)}</span>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => handleExport('CSV')} variant="ghost" size="sm" className="h-8 w-8 p-0" title="Exportar CSV"><Download className="w-4 h-4" /></Button>
                        <Button onClick={() => handleExport('PDF')} variant="ghost" size="sm" className="h-8 w-8 p-0" title="Imprimir"><Printer className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div>
                <div className="flex justify-between items-center mb-3 px-2">
                    <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Lançamentos
                    </h3>
                    <div className="flex gap-2">
                        {isSelectionMode ? (
                            <>
                                <Button size="sm" variant="ghost" onClick={handleSelectAll} className="text-xs">
                                    {selectedItems.size === items.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={selectedItems.size === 0}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir ({selectedItems.size})
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsSelectionMode(false)}>Cancelar</Button>
                            </>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => setIsSelectionMode(true)}>
                                <CheckSquare className="w-4 h-4 mr-2" /> Selecionar
                            </Button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                    {items.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhuma despesa compartilhada neste mês.</p>
                        </div>
                    ) : (
                        items.map(item => {
                            const CatIcon = getCategoryIcon(item.category as Category);
                            const isInstallment = item.description.toLowerCase().includes('parcela') || (item.installmentNumber);
                            // InvoiceItem usually has installment info? Yes, let's assume item has it.
                            // item.description usually has "Parcela X/Y" appended in some views, but better to check props if available.
                            // Looking at types.ts: InvoiceItem has `installmentNumber`, `totalInstallments`. 

                            const isSelected = selectedItems.has(item.originalTxId);

                            return (
                                <div
                                    key={item.originalTxId}
                                    className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                                    onClick={() => isSelectionMode && handleToggleSelect(item.originalTxId)}
                                >
                                    <div className="flex items-center gap-4">
                                        {isSelectionMode && (
                                            <div className="text-indigo-600 dark:text-indigo-400">
                                                {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                            </div>
                                        )}

                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'DEBIT' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                            {item.type === 'DEBIT' ? <ArrowDownLeft className="w-5 h-5" /> : <CatIcon className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                                {item.description}
                                            </p>
                                            <div className="flex gap-2 text-xs text-slate-600 dark:text-slate-300 items-center mt-1">
                                                <span className="text-slate-600 dark:text-slate-300">{new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>

                                                {item.category && (
                                                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">
                                                        {item.category}
                                                    </span>
                                                )}

                                                {(item.installmentNumber && item.totalInstallments) ? (
                                                    <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                                                        Parcela {item.installmentNumber}/{item.totalInstallments}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${item.type === 'DEBIT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                            {item.type === 'DEBIT' ? '-' : ''}{formatCurrency(item.amount, currency)}
                                        </span>

                                        {!isSelectionMode && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Edit Button */}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); onEditTransaction(item.originalTxId); }}
                                                    className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                {/* Delete Button */}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteTransaction(item.originalTxId); }}
                                                    className="h-8 w-8 p-0 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

        </div>
    );
};
