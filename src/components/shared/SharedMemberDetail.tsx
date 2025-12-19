import React, { useMemo, useState } from 'react';
import { FamilyMember, Transaction, Category, InvoiceItem, TransactionType } from '../../types';
import { Button } from '../ui/Button';
import { ArrowDownLeft, Clock, FileUp, ShoppingBag, CreditCard, Users, Trash2, Edit2, CheckSquare, Square, Download, Printer, RotateCcw, CheckCircle } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../../utils';
import { exportToCSV, prepareTransactionsForExport } from '../../services/exportUtils';
import { printAccountStatement } from '../../services/printUtils';
import { useToast } from '../ui/Toast';

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
    tripName?: string;
    currentUserId?: string; // ID do usuário logado para verificar ownership

    // Actions
    onSettle: (type: 'PAY' | 'RECEIVE', amount: number) => void;
    onBulkSettle?: (items: InvoiceItem[]) => void;
    allowIndividualSettlement?: boolean;
    onImport: () => void;
    onEditTransaction: (id: string) => void;
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
    onBulkDelete?: (ids: string[]) => void;
    onUndoSettlement?: (item: InvoiceItem) => void;
}

export const SharedMemberDetail: React.FC<SharedMemberDetailProps> = ({
    member, items, currentDate, showValues, currency, tripName, currentUserId,
    onSettle, onBulkSettle, allowIndividualSettlement, onImport, onEditTransaction, onDeleteTransaction, onBulkDelete, onUndoSettlement
}) => {
    const { addToast } = useToast();

    // Selection Mode State (Preserving user feature)
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // 1. Calculate Totals
    // InvoiceItem types based on useSharedFinances:
    // CREDIT = I paid, they owe me (me devem) = positive for me
    // DEBIT = They paid, I owe them (eu devo) = negative for me
    const { totalExpenses, totalIncome, netTotal } = useMemo(() => {
        let expenses = 0; // DEBIT items = I owe them
        let income = 0;   // CREDIT items = They owe me

        let net = 0;

        items.forEach(i => {
            if (i.isPaid) return; // Ignore settled

            if (i.type === 'DEBIT') {
                // DEBIT = They paid, I owe them
                expenses += i.amount;
                net -= i.amount; // Negative for me
            } else {
                // CREDIT = I paid, they owe me
                income += i.amount;
                net += i.amount; // Positive for me
            }
        });

        return { totalExpenses: expenses, totalIncome: income, netTotal: net };
    }, [items]);

    const handleToggleSelect = (id: string) => {
        const item = items.find(i => i.originalTxId === id);
        
        // Se está tentando selecionar (não desmarcar) um item que não é dele
        if (item && !selectedItems.has(id) && item.creatorUserId && item.creatorUserId !== currentUserId) {
            addToast('Você não pode excluir este item pois foi criado por outra pessoa.', 'warning');
            return;
        }
        
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    // Filtrar apenas itens que o usuário atual pode excluir (criou)
    const deletableItems = items.filter(i => !i.creatorUserId || i.creatorUserId === currentUserId);

    const handleSelectAll = () => {
        if (selectedItems.size === deletableItems.length) {
            setSelectedItems(new Set());
        } else {
            // Só selecionar itens que o usuário pode excluir
            setSelectedItems(new Set(deletableItems.map(i => i.originalTxId)));
        }
    };

    const handleBulkDelete = () => {
        if (!onBulkDelete) return;
        
        // Verificar se algum item selecionado não pertence ao usuário
        const selectedInvoiceItems = items.filter(i => selectedItems.has(i.originalTxId));
        const notOwnedItems = selectedInvoiceItems.filter(i => i.creatorUserId && i.creatorUserId !== currentUserId);
        
        if (notOwnedItems.length > 0) {
            addToast(`${notOwnedItems.length} item(s) não pode(m) ser excluído(s) pois foi(ram) criado(s) por outra pessoa.`, 'error');
            // Remover itens não permitidos da seleção
            const allowedIds = selectedInvoiceItems
                .filter(i => !i.creatorUserId || i.creatorUserId === currentUserId)
                .map(i => i.originalTxId);
            
            if (allowedIds.length === 0) {
                return;
            }
            
            // Excluir apenas os permitidos
            onBulkDelete(allowedIds);
        } else {
            onBulkDelete(Array.from(selectedItems));
        }
        
        setIsSelectionMode(false);
        setSelectedItems(new Set());
    };

    const handleExport = (format: 'CSV' | 'PDF') => {
        // Map InvoiceItems to CSV-compatible arrays
        const headers = ['Data', 'Descrição', 'Categoria', 'Valor', 'Tipo'];
        const data = items.map(i => [
            new Date(i.date).toLocaleDateString('pt-BR'),
            i.description,
            i.category || '',
            i.amount.toFixed(2).replace('.', ','),

            i.type === 'DEBIT' ? 'Débito' : 'Crédito'
        ]);

        if (format === 'CSV') {
            exportToCSV(data, headers, `Fatura_${member.name}_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}`);
        } else {
            // printAccountStatement expects Account + Transactions.
            printAccountStatement({ ...member, name: member.name, type: 'OTHER', currency } as any,
                items.map(i => ({
                    id: i.originalTxId,
                    date: i.date,
                    description: i.description,
                    amount: i.amount,
                    type: i.type === 'DEBIT' ? TransactionType.EXPENSE : TransactionType.INCOME,
                    category: i.category as Category,
                    accountId: 'shared',
                    isShared: true
                } as Transaction))
            );
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Main Summary Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group">
                {/* Gradient Header - Red for debt (I owe), Green for credit (they owe me) */}
                <div className={`absolute top-0 left-0 w-full h-2 ${netTotal > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : netTotal < 0
                        ? 'bg-gradient-to-r from-red-500 to-rose-500'
                        : 'bg-gradient-to-r from-slate-400 to-slate-500'
                    }`}></div>

                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${netTotal > 0
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    : netTotal < 0
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                    <Users className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {netTotal > 0
                                        ? `Crédito de ${member.name}`
                                        : netTotal < 0
                                            ? `Débito para ${member.name}`
                                            : `Acerto com ${member.name}`
                                    }
                                    {tripName ? ` - ${tripName}` : ''}
                                    {' - '}{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
                                </span>
                            </div>
                            <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${netTotal > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : netTotal < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                <PrivacyBlur showValues={showValues}>
                                    {netTotal > 0
                                        ? `+ ${formatCurrency(netTotal, currency)}`
                                        : netTotal < 0
                                            ? `- ${formatCurrency(Math.abs(netTotal), currency)}`
                                            : 'R$ 0,00'
                                    }
                                </PrivacyBlur>
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                                {items.length} lançamentos neste mês
                                {netTotal > 0 && <span className="ml-2 font-bold text-emerald-600">(A receber)</span>}
                                {netTotal < 0 && <span className="ml-2 font-bold text-red-600">(A pagar)</span>}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {/* Action Buttons */}
                            {netTotal !== 0 && (
                                <Button
                                    onClick={() => onSettle(netTotal > 0 ? 'RECEIVE' : 'PAY', Math.abs(netTotal))}
                                    className={`w-full md:w-auto rounded-xl font-bold shadow-lg text-white min-w-[160px] ${netTotal > 0
                                        ? 'shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700'
                                        : 'shadow-red-500/20 bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {netTotal > 0 ? 'Receber Fatura' : 'Pagar Fatura'}{currency !== 'BRL' ? ` (${currency})` : ''}
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
                        <span className="text-red-600">Débito: {formatCurrency(totalExpenses, currency)}</span>
                        <span className="text-emerald-600">Crédito: {formatCurrency(totalIncome, currency)}</span>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => handleExport('CSV')} variant="secondary" size="sm" className="h-9 px-3 gap-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 border-0" title="Exportar CSV">
                            <Download className="w-4 h-4" />
                            <span className="text-xs font-bold">CSV</span>
                        </Button>
                        <Button onClick={() => handleExport('PDF')} variant="secondary" size="sm" className="h-9 px-3 gap-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 border-0" title="Imprimir">
                            <Printer className="w-4 h-4" />
                            <span className="text-xs font-bold">Imprimir</span>
                        </Button>
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

                                {allowIndividualSettlement && onBulkSettle && selectedItems.size > 0 && (
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-lg border-0"
                                        onClick={() => {
                                            const selectedInvoiceItems = items.filter(i => selectedItems.has(i.originalTxId));

                                            // VALIDATION: Filter out already paid items
                                            const unpaidItems = selectedInvoiceItems.filter(i => !i.isPaid);
                                            const paidCount = selectedInvoiceItems.length - unpaidItems.length;

                                            if (paidCount > 0) {
                                                addToast(`${paidCount} item(s) selecionado(s) já está(ão) pago(s) e foi(ram) removido(s) do acerto.`, 'warning');
                                            }

                                            if (unpaidItems.length === 0) {
                                                if (paidCount === 0) addToast("Nenhum item válido selecionado.", 'error');
                                                return;
                                            }

                                            if (onBulkSettle) {
                                                onBulkSettle(unpaidItems);
                                                setIsSelectionMode(false);
                                                setSelectedItems(new Set());
                                            }
                                        }}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" /> Acertar ({selectedItems.size})
                                    </Button>
                                )}

                                <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={selectedItems.size === 0}>
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

                {/* Date-Grouped Transaction List */}
                {items.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
                        <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhuma despesa compartilhada neste mês.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(() => {
                            // Group items by date
                            const grouped: Record<string, InvoiceItem[]> = {};
                            items.forEach(item => {
                                const dateKey = item.date.split('T')[0];
                                if (!grouped[dateKey]) grouped[dateKey] = [];
                                grouped[dateKey].push(item);
                            });
                            const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                            return sortedDates.map(dateStr => {
                                const dateObj = new Date(dateStr + 'T12:00:00');
                                const dayItems = grouped[dateStr];

                                return (
                                    <div key={dateStr}>
                                        {/* Date Header */}
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shadow-sm shrink-0">
                                                <span className="text-[10px] uppercase font-black text-slate-400 leading-none">{dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                                <span className="text-lg font-black text-slate-800 dark:text-white leading-none">{dateObj.getDate()}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                                    {dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                    {dayItems.length} ite{dayItems.length !== 1 ? 'ns' : 'm'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Day Transactions Card */}
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {dayItems.map(item => {
                                                const CatIcon = getCategoryIcon(item.category as Category);
                                                const isSelected = selectedItems.has(item.originalTxId);

                                                return (
                                                    <div
                                                        key={item.originalTxId}
                                                        className={`group p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                                                        onClick={() => isSelectionMode && handleToggleSelect(item.originalTxId)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            {isSelectionMode && (
                                                                <div className="text-indigo-600 dark:text-indigo-400">
                                                                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                                </div>
                                                            )}

                                                            {/* Category Icon - DEBIT (eu devo, outro pagou) = red, CREDIT (me devem, eu paguei) = green */}
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${item.type === 'DEBIT'
                                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                }`}>
                                                                {item.type === 'DEBIT' ? <CatIcon className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                    {item.description}
                                                                </p>
                                                                <div className="flex flex-wrap gap-2 text-xs items-center mt-1">
                                                                    {item.category && (
                                                                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wide">
                                                                            {item.category}
                                                                        </span>
                                                                    )}

                                                                    {(item.installmentNumber && item.totalInstallments) && (
                                                                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                                                                            <Clock className="w-3 h-3" />
                                                                            {item.installmentNumber}/{item.totalInstallments}
                                                                        </span>
                                                                    )}

                                                                    {/* Type indicator badge */}
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.type === 'DEBIT'
                                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                        }`}>
                                                                        {item.type === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 pl-2">
                                                            <span className={`font-bold text-base whitespace-nowrap ${item.type === 'DEBIT'
                                                                ? 'text-red-700 dark:text-red-400'
                                                                : 'text-emerald-700 dark:text-emerald-400'
                                                                }`}>
                                                                {item.type === 'DEBIT' ? '-' : '+'}{formatCurrency(item.amount, currency)}
                                                            </span>

                                                            {!isSelectionMode && (
                                                                <div className="flex gap-1">
                                                                    {/* Settled indicator and undo button for history items */}
                                                                    {item.isPaid ? (
                                                                        <>
                                                                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                                <span className="hidden sm:inline">Pago</span>
                                                                            </span>
                                                                            {onUndoSettlement && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={(e) => { e.stopPropagation(); onUndoSettlement(item); }}
                                                                                    className="h-8 w-8 p-0 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600"
                                                                                    title="Desfazer acerto"
                                                                                >
                                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        // Só mostrar botões de editar/excluir se o usuário atual é o criador
                                                                        // Se creatorUserId não existe, assume que é do usuário atual (compatibilidade)
                                                                        (!item.creatorUserId || item.creatorUserId === currentUserId) ? (
                                                                            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={(e) => { e.stopPropagation(); onEditTransaction(item.originalTxId); }}
                                                                                    className="h-9 w-9 p-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/50"
                                                                                    title="Editar"
                                                                                >
                                                                                    <Edit2 className="w-4 h-4" />
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={(e) => { e.stopPropagation(); onDeleteTransaction(item.originalTxId); }}
                                                                                    className="h-9 w-9 p-0 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50"
                                                                                    title="Excluir"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </Button>
                                                                            </div>
                                                                        ) : null
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}
            </div>

        </div>
    );
};
