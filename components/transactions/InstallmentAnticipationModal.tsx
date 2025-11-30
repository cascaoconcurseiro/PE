import React, { useState, useMemo } from 'react';
import { Transaction, Account, AccountType } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils';
import { Calendar, CreditCard, Wallet, ChevronDown, Check, AlertCircle } from 'lucide-react';

interface InstallmentAnticipationModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction;
    allInstallments: Transaction[];
    accounts: Account[];
    onConfirm: (installmentIds: string[], date: string, accountId: string) => void;
}

export const InstallmentAnticipationModal: React.FC<InstallmentAnticipationModalProps> = ({
    isOpen,
    onClose,
    transaction,
    allInstallments,
    accounts,
    onConfirm
}) => {
    const [selectedCount, setSelectedCount] = useState(1);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedAccountId, setSelectedAccountId] = useState(() => {
        // Default to original credit card or first non-credit account
        const originalAccount = accounts.find(a => a.id === transaction.accountId);
        if (originalAccount?.type === AccountType.CREDIT_CARD) {
            return originalAccount.id;
        }
        return accounts.find(a => a.type !== AccountType.CREDIT_CARD)?.id || accounts[0]?.id || '';
    });

    // Get future installments (including current)
    const futureInstallments = useMemo(() => {
        if (!transaction.seriesId) return [transaction];

        return allInstallments
            .filter(t =>
                t.seriesId === transaction.seriesId &&
                new Date(t.date) >= new Date(transaction.date)
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transaction, allInstallments]);

    const maxInstallments = futureInstallments.length;
    const selectedInstallments = futureInstallments.slice(0, selectedCount);
    const totalAmount = selectedInstallments.reduce((sum, t) => sum + t.amount, 0);

    const originalAccount = accounts.find(a => a.id === transaction.accountId);
    const targetAccount = accounts.find(a => a.id === selectedAccountId);
    const isSameAccount = selectedAccountId === transaction.accountId;

    const handleConfirm = () => {
        const ids = selectedInstallments.map(t => t.id);
        onConfirm(ids, paymentDate, selectedAccountId);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Antecipar Parcelas">
            <div className="space-y-6">
                {/* Transaction Info */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{transaction.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {transaction.currentInstallment}/{transaction.totalInstallments} • {formatCurrency(transaction.amount)} por parcela
                    </p>
                </div>

                {/* Installment Selector */}
                <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block">
                        Quantas parcelas deseja antecipar?
                    </label>

                    {/* Visual Selector */}
                    <div className="grid grid-cols-5 gap-2 mb-4">
                        {Array.from({ length: Math.min(maxInstallments, 10) }, (_, i) => i + 1).map(num => (
                            <button
                                key={num}
                                onClick={() => setSelectedCount(num)}
                                className={`
                                    h-12 rounded-xl font-bold text-sm transition-all border-2
                                    ${selectedCount === num
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }
                                `}
                            >
                                {num}x
                            </button>
                        ))}
                    </div>

                    {maxInstallments > 10 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max={maxInstallments}
                                value={selectedCount}
                                onChange={(e) => setSelectedCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxInstallments))}
                                className="flex-1 h-12 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-bold text-center"
                            />
                            <span className="text-sm text-slate-500 dark:text-slate-400">de {maxInstallments}</span>
                        </div>
                    )}

                    {/* Range Slider */}
                    <input
                        type="range"
                        min="1"
                        max={maxInstallments}
                        value={selectedCount}
                        onChange={(e) => setSelectedCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-4"
                        style={{
                            background: `linear-gradient(to right, rgb(79 70 229) 0%, rgb(79 70 229) ${(selectedCount / maxInstallments) * 100}%, rgb(226 232 240) ${(selectedCount / maxInstallments) * 100}%, rgb(226 232 240) 100%)`
                        }}
                    />
                </div>

                {/* Total Amount Display */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Valor Total a Antecipar</span>
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                            {selectedCount} {selectedCount === 1 ? 'parcela' : 'parcelas'}
                        </div>
                    </div>
                    <div className="text-4xl font-black tracking-tight">{formatCurrency(totalAmount)}</div>
                    {selectedCount > 1 && (
                        <p className="text-indigo-200 text-xs mt-2">
                            {selectedCount}x de {formatCurrency(transaction.amount)}
                        </p>
                    )}
                </div>

                {/* Payment Date */}
                <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Data do Pagamento
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full pl-11 pr-4 h-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
                        />
                    </div>
                </div>

                {/* Account Selection */}
                <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Como deseja pagar?
                    </label>
                    <div className="space-y-2">
                        {/* Option 1: Keep in current invoice (if credit card) */}
                        {originalAccount?.type === AccountType.CREDIT_CARD && (
                            <button
                                onClick={() => setSelectedAccountId(originalAccount.id)}
                                className={`
                                    w-full p-4 rounded-xl border-2 transition-all text-left
                                    ${isSameAccount
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-600'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSameAccount ? 'bg-indigo-600 text-white' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">Fatura Atual</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Manter no {originalAccount.name}</p>
                                    </div>
                                    {isSameAccount && <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                                </div>
                            </button>
                        )}

                        {/* Option 2: Pay with another account */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    const firstNonCredit = accounts.find(a => a.type !== AccountType.CREDIT_CARD);
                                    if (firstNonCredit && selectedAccountId === transaction.accountId) {
                                        setSelectedAccountId(firstNonCredit.id);
                                    }
                                }}
                                className={`
                                    w-full p-4 rounded-xl border-2 transition-all text-left
                                    ${!isSameAccount
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-600'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${!isSameAccount ? 'bg-indigo-600 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">Pagar com Saldo</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Usar outra conta</p>
                                    </div>
                                    {!isSameAccount && <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                                </div>
                            </button>

                            {!isSameAccount && (
                                <div className="mt-2 pl-14">
                                    <div className="relative">
                                        <select
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white text-sm font-medium appearance-none"
                                        >
                                            {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Alert */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                        {isSameAccount
                            ? `As ${selectedCount} ${selectedCount === 1 ? 'parcela será movida' : 'parcelas serão movidas'} para a fatura atual do cartão.`
                            : `${selectedCount === 1 ? 'A parcela será paga' : `As ${selectedCount} parcelas serão pagas`} com saldo de ${targetAccount?.name}.`
                        }
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 h-12"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        Confirmar Antecipação
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
