import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Transaction, FamilyMember, Account, TransactionType, Category, SyncStatus } from '../../types';
import { Save, Calendar, DollarSign, Layers, CreditCard, AlignLeft, Hash } from 'lucide-react';

interface SharedInstallmentImportProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (transactions: any[]) => void;
    members: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
}

export const SharedInstallmentImport: React.FC<SharedInstallmentImportProps> = ({
    isOpen, onClose, onImport, members, accounts, currentUserId
}) => {
    // Form State
    const [description, setDescription] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [installments, setInstallments] = useState<number>(2); // Default to 2
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [isTotalAmount, setIsTotalAmount] = useState(true); // Toggle: Total Amount vs Installment Amount

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setDescription('');
            setAmountStr('');
            setInstallments(2);
            setStartDate(new Date().toISOString().split('T')[0]);
            // Default to first account if available
            if (accounts.length > 0 && !selectedAccountId) {
                setSelectedAccountId(accounts[0].id);
            }
        }
    }, [isOpen, accounts]);

    const handleSave = () => {
        const amount = parseFloat(amountStr);
        if (!description || !amount || amount <= 0 || !selectedAccountId || installments < 2) return;

        // Calculate installment amount
        const installmentValue = isTotalAmount ? (amount / installments) : amount;

        const transactionsToCreate: any[] = [];
        const installmentGroupId = crypto.randomUUID(); // Link them together if needed later

        // Create Date Object from input (avoid timezone drift)
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);

        for (let i = 0; i < installments; i++) {
            // Calculate date for this installment
            // Simple logic: maintain day of month, increment month
            // Handle edge cases like Jan 31 -> Feb 28 automatically by Date() but might skip month?
            // Safer: Set month explicitly

            const d = new Date(startYear, startMonth - 1 + i, startDay);

            // Format YYYY-MM-DD
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            transactionsToCreate.push({
                date: dateStr,
                amount: parseFloat(installmentValue.toFixed(2)), // Round to 2 decimals
                type: TransactionType.EXPENSE,
                category: Category.SHOPPING, // Default category for installments? Or OPENING_BALANCE? Shopping seems safer.
                description: `${description} (${i + 1}/${installments})`,
                accountId: selectedAccountId,
                isSettled: false,
                isShared: true, // Mark as shared
                isInstallment: true,
                currentInstallment: i + 1,
                totalInstallments: installments,
                installmentGroupId: installmentGroupId,
                sharedWith: [], // Pending split
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING,
                deleted: false
            });
        }

        // Adjust rounding difference on the last installment if Total Amount was used
        if (isTotalAmount) {
            const totalCreated = transactionsToCreate.reduce((sum, t) => sum + t.amount, 0);
            const diff = amount - totalCreated;
            if (Math.abs(diff) > 0.001) {
                // Add diff to the first or last? Usually last.
                const lastIdx = transactionsToCreate.length - 1;
                transactionsToCreate[lastIdx].amount = parseFloat((transactionsToCreate[lastIdx].amount + diff).toFixed(2));
            }
        }

        onImport(transactionsToCreate);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Compra Parcelada">
            <div className="flex flex-col gap-5 p-1">

                {/* Description */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Descrição do Item</label>
                    <div className="relative">
                        <AlignLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Ex: Celular Novo, Geladeira..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-violet-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Valor</label>
                            <button
                                onClick={() => setIsTotalAmount(!isTotalAmount)}
                                className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline"
                            >
                                {isTotalAmount ? 'Total' : 'Por Parcela'}
                            </button>
                        </div>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                placeholder="0,00"
                                value={amountStr}
                                onChange={(e) => setAmountStr(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>

                    {/* Installments */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nº Parcelas</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                min="2"
                                max="99"
                                value={installments}
                                onChange={(e) => setInstallments(parseInt(e.target.value))}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Start Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">1ª Parcela</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>

                    {/* Account */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Conta / Cartão</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
                            >
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!description || !amountStr || !selectedAccountId}>
                        <Save className="w-4 h-4 mr-2" />
                        Gerar {installments} Parcelas
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
