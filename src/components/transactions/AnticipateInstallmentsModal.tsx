import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { X, Clock, Check, Wallet, AlertCircle, ChevronDown } from 'lucide-react';
import { Transaction, Account, AccountType } from '../../types';
import { formatCurrency, parseDate } from '../../utils';

interface AnticipateInstallmentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[]; // All transactions
    initialTransaction: Transaction; // The transaction from which to find installments
    accounts: Account[];
    onConfirmAnticipation: (ids: string[], date: string, accountId: string) => void; // Updated interface
}

export const AnticipateInstallmentsModal: React.FC<AnticipateInstallmentsModalProps> = ({
    isOpen,
    onClose,
    transactions,
    initialTransaction,
    accounts,
    onConfirmAnticipation,
}) => {
    const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedAccountId, setSelectedAccountId] = useState(() => {
        const currentAcc = accounts.find(a => a.id === initialTransaction.accountId);
        if (currentAcc?.type === AccountType.CREDIT_CARD) return currentAcc.id;
        return accounts.find(a => a.type !== AccountType.CREDIT_CARD)?.id || '';
    });

    // Filter future installments from the same series
    const futureInstallments = useMemo(() => {
        if (!initialTransaction.seriesId) return [];
        return transactions
            .filter(tx =>
                tx.seriesId === initialTransaction.seriesId &&
                tx.id !== initialTransaction.id &&
                parseDate(tx.date) > parseDate(initialTransaction.date) &&
                !tx.isSettled // Only show unsettled installments
            )
            .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
    }, [transactions, initialTransaction]);

    const toggleInstallment = (id: string) => {
        setSelectedInstallments(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const totalAnticipatedAmount = useMemo(() => {
        return futureInstallments
            .filter(tx => selectedInstallments.includes(tx.id))
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [selectedInstallments, futureInstallments]);

    const handleConfirm = () => {
        if (selectedInstallments.length === 0) {
            alert('Selecione pelo menos uma parcela para antecipar.');
            return;
        }
        if (!selectedAccountId) {
            alert('Selecione a conta de onde o pagamento será feito.');
            return;
        }

        onConfirmAnticipation(selectedInstallments, paymentDate, selectedAccountId); // Pass selectedAccountId
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 rounded-t-3xl">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Antecipar Parcelas</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Selecione as parcelas para pagar agora.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors text-slate-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20">
                    <label className="text-xs font-bold text-purple-800 dark:text-purple-400 uppercase mb-1 block">Data do Pagamento</label>
                    <input
                        type="date"
                        value={paymentDate}
                        onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-xl p-3 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {futureInstallments.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhuma parcela futura encontrada para esta série.</p>
                        </div>
                    ) : (
                        futureInstallments.map(tx => {
                            const isSelected = selectedInstallments.includes(tx.id);
                            return (
                                <div
                                    key={tx.id}
                                    onClick={() => toggleInstallment(tx.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                >
                                    <div>
                                        <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                            Parcela {tx.currentInstallment}/{tx.totalInstallments}
                                        </p>
                                        <p className={`text-xs ${isSelected ? 'text-purple-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                            Vencimento Original: {parseDate(tx.date).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                            {formatCurrency(tx.amount, accounts.find(a => a.id === tx.accountId)?.currency || 'BRL')}
                                        </p>
                                        {isSelected && <Check className="w-4 h-4 ml-auto mt-1" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-3xl">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Total Antecipado</span>
                        <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
                            {formatCurrency(totalAnticipatedAmount, accounts.find(a => a.id === initialTransaction.accountId)?.currency || 'BRL')}
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Destino da Antecipação:</label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <select
                                value={selectedAccountId}
                                onChange={e => setSelectedAccountId(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white font-medium appearance-none"
                            >
                                <option value="" disabled>Selecione...</option>
                                {/* Option for Current Invoice (Same Credit Card) */}
                                {accounts.find(a => a.id === initialTransaction.accountId)?.type === AccountType.CREDIT_CARD && (
                                    <option value={initialTransaction.accountId} className="font-bold text-purple-600">
                                        Fatura Atual ({accounts.find(a => a.id === initialTransaction.accountId)?.name})
                                    </option>
                                )}
                                <optgroup label="Pagar com Saldo (Quitar Agora)">
                                    {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                                    ))}
                                </optgroup>
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 shadow-lg rounded-xl mt-4"
                        disabled={selectedInstallments.length === 0 || !selectedAccountId}
                    >
                        Confirmar Antecipação
                    </Button>
                </div>
            </div>
        </div>
    );
};