import React, { useState, useEffect } from 'react';
import { Transaction, FamilyMember, Account, Category, TransactionType, SyncStatus, TransactionSplit } from '../../types';
import { Button } from '../ui/Button';
import { round2dec } from '../../utils';
import { X, Calendar, DollarSign, CreditCard, Layers, Check } from 'lucide-react';
import { useToast } from '../ui/Toast';

// Helper for currency format inside component
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface SharedInstallmentImportProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
    members: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
    currentUserName?: string;
}

export const SharedInstallmentImport: React.FC<SharedInstallmentImportProps> = ({
    isOpen, onClose, onImport, members, accounts, currentUserId, currentUserName
}) => {
    const { addToast } = useToast();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState('1');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<Category>(Category.SHOPPING);

    // Simplification: Implicit 'me' as payer, select only the debtor (assignee)
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [accountId, setAccountId] = useState('');

    // Filter out "Me" from assignee list (I can't assign debt to myself in this context if I am payer)
    const availableMembers = React.useMemo(() => members.filter(m => m.id !== 'me'), [members]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDescription('');
            setAmount('');
            setInstallments('1');
            setDate(new Date().toISOString().split('T')[0]);
            setCategory(Category.SHOPPING);
            setAccountId('');
            setIsSubmitting(false); // Reset on open
            // Default to first available member
            if (availableMembers.length > 0) setAssigneeId(availableMembers[0].id);
        }
    }, [isOpen, availableMembers]);

    const handleConfirm = async () => {
        if (isSubmitting) return; // Prevent double click

        if (!amount || !description || !assigneeId) {
            addToast('Preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const installmentValue = parseFloat(amount);
            const numInstallments = parseInt(installments);

            const generatedTransactions: Array<import('../../types').Transaction & { id?: string }> = [];
            const [yearStr, monthStr, dayStr] = date.split('-');
            const startYear = parseInt(yearStr);
            const startMonth = parseInt(monthStr) - 1;
            const startDay = parseInt(dayStr);

            const seriesId = crypto.randomUUID();
            const totalAmount = installmentValue * numInstallments;

            for (let i = 0; i < numInstallments; i++) {
                const currentInstallmentAmount = installmentValue;
                const currentMonthIndex = startMonth + i;
                const targetYear = startYear + Math.floor(currentMonthIndex / 12);
                const targetMonth = currentMonthIndex % 12;
                const maxDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
                const finalDay = Math.min(startDay, maxDaysInMonth);
                const utcDate = new Date(Date.UTC(targetYear, targetMonth, finalDay, 12, 0, 0));
                const dateStr = utcDate.toISOString().split('T')[0];
                const transactionId = crypto.randomUUID(); // Idempotency Key

                // For shared installment imports, when user selects "assignee" as who will pay,
                // it means the assignee owes money to the current user (current user will receive money)
                // So the current user should see this as CREDIT (income they will receive)
                // This means the current user should be the payer and assignee should be in sharedWith
                const sharedWith: TransactionSplit[] = [{
                    memberId: assigneeId, // Assignee owes money to current user
                    assignedAmount: currentInstallmentAmount,
                    percentage: 100,
                    isSettled: false
                }];

                generatedTransactions.push({
                    id: transactionId, // Explicit ID for Idempotency
                    userId: 'temp', // Will be overwritten by service
                    description: `${description} (${i + 1}/${numInstallments})`,
                    amount: currentInstallmentAmount,
                    type: TransactionType.EXPENSE,
                    category: category,
                    date: dateStr,
                    accountId: accountId || undefined,
                    payerId: undefined, // Current user is the payer (will receive money back)
                    isShared: true,
                    sharedWith: sharedWith, // Assignee owes money to current user
                    isInstallment: numInstallments > 1,
                    currentInstallment: i + 1,
                    totalInstallments: numInstallments,
                    seriesId: numInstallments > 1 ? seriesId : undefined,
                    originalAmount: totalAmount,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING,
                    currency: 'BRL',
                    domain: 'SHARED'
                });
            }
            onImport(generatedTransactions);
            // Close modal after a brief delay to ensure UI updates properly
            setTimeout(() => {
                setIsSubmitting(false);
                onClose(); // Close the modal to ensure proper cleanup
            }, 150);
        } catch (e) {
            console.error("Error importing:", e);
            setIsSubmitting(false); // Re-enable on error
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`} onClick={!isSubmitting ? onClose : undefined} />
            <div className={`bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full'}`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Importar Parcelado</h3>
                    <button type="button" onClick={onClose} disabled={isSubmitting}><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Descrição</label>
                        <input disabled={isSubmitting} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Compra Geladeira" />
                    </div>

                    {/* Amount & Installments Row */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Valor da Parcela</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input disabled={isSubmitting} type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Parcelas</label>
                            <input disabled={isSubmitting} type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="1" min="1" max="99" />
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Data 1ª Parcela</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input disabled={isSubmitting} type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Category - Apenas despesas, agrupadas */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Categoria</label>
                        <select disabled={isSubmitting} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={category} onChange={e => setCategory(e.target.value as Category)}>
                            <optgroup label="🏠 Moradia">
                                <option value={Category.HOUSING}>{Category.HOUSING}</option>
                                <option value={Category.RENT}>{Category.RENT}</option>
                                <option value={Category.MAINTENANCE}>{Category.MAINTENANCE}</option>
                                <option value={Category.FURNITURE}>{Category.FURNITURE}</option>
                                <option value={Category.UTILITIES}>{Category.UTILITIES}</option>
                            </optgroup>
                            <optgroup label="🍽️ Alimentação">
                                <option value={Category.FOOD}>{Category.FOOD}</option>
                                <option value={Category.RESTAURANTS}>{Category.RESTAURANTS}</option>
                                <option value={Category.GROCERY}>{Category.GROCERY}</option>
                                <option value={Category.SNACKS}>{Category.SNACKS}</option>
                            </optgroup>
                            <optgroup label="🚗 Transporte">
                                <option value={Category.TRANSPORTATION}>{Category.TRANSPORTATION}</option>
                                <option value={Category.UBER}>{Category.UBER}</option>
                                <option value={Category.FUEL}>{Category.FUEL}</option>
                                <option value={Category.PUBLIC_TRANSPORT}>{Category.PUBLIC_TRANSPORT}</option>
                                <option value={Category.VEHICLE_MAINTENANCE}>{Category.VEHICLE_MAINTENANCE}</option>
                                <option value={Category.PARKING}>{Category.PARKING}</option>
                            </optgroup>
                            <optgroup label="❤️ Saúde">
                                <option value={Category.HEALTH}>{Category.HEALTH}</option>
                                <option value={Category.PHARMACY}>{Category.PHARMACY}</option>
                                <option value={Category.DOCTOR}>{Category.DOCTOR}</option>
                                <option value={Category.EXAMS}>{Category.EXAMS}</option>
                                <option value={Category.GYM}>{Category.GYM}</option>
                            </optgroup>
                            <optgroup label="🎉 Lazer">
                                <option value={Category.LEISURE}>{Category.LEISURE}</option>
                                <option value={Category.ENTERTAINMENT}>{Category.ENTERTAINMENT}</option>
                                <option value={Category.STREAMING}>{Category.STREAMING}</option>
                                <option value={Category.TRAVEL}>{Category.TRAVEL}</option>
                                <option value={Category.HOBBIES}>{Category.HOBBIES}</option>
                            </optgroup>
                            <optgroup label="🛍️ Compras">
                                <option value={Category.SHOPPING}>{Category.SHOPPING}</option>
                                <option value={Category.CLOTHING}>{Category.CLOTHING}</option>
                                <option value={Category.ELECTRONICS}>{Category.ELECTRONICS}</option>
                                <option value={Category.BEAUTY}>{Category.BEAUTY}</option>
                                <option value={Category.HOME_SHOPPING}>{Category.HOME_SHOPPING}</option>
                            </optgroup>
                            <optgroup label="📚 Educação">
                                <option value={Category.EDUCATION}>{Category.EDUCATION}</option>
                                <option value={Category.COURSES}>{Category.COURSES}</option>
                                <option value={Category.BOOKS}>{Category.BOOKS}</option>
                            </optgroup>
                            <optgroup label="👤 Pessoal">
                                <option value={Category.PERSONAL}>{Category.PERSONAL}</option>
                                <option value={Category.PERSONAL_CARE}>{Category.PERSONAL_CARE}</option>
                                <option value={Category.PETS}>{Category.PETS}</option>
                                <option value={Category.GIFTS}>{Category.GIFTS}</option>
                                <option value={Category.DONATION}>{Category.DONATION}</option>
                            </optgroup>
                            <optgroup label="💰 Financeiro">
                                <option value={Category.FINANCIAL}>{Category.FINANCIAL}</option>
                                <option value={Category.INSURANCE}>{Category.INSURANCE}</option>
                                <option value={Category.TAXES}>{Category.TAXES}</option>
                                <option value={Category.FEES}>{Category.FEES}</option>
                                <option value={Category.LOANS}>{Category.LOANS}</option>
                            </optgroup>
                            <optgroup label="📦 Especiais">
                                <option value={Category.MISCELLANEOUS}>{Category.MISCELLANEOUS}</option>
                                <option value={Category.ADJUSTMENT}>{Category.ADJUSTMENT}</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Assignee Selection (Simplified) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Quem vai pagar a parcela? (Responsável)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {availableMembers.map(m => (
                                <button
                                    type="button"
                                    key={m.id}
                                    disabled={isSubmitting}
                                    onClick={() => setAssigneeId(m.id)}
                                    className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 ${assigneeId === m.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700'} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {assigneeId === m.id && <Check className="w-4 h-4" />}
                                    {m.name}
                                </button>
                            ))}
                        </div>
                        {availableMembers.length === 0 && (
                            <p className="text-sm text-red-500 mt-2">Nenhum membro disponível para atribuir.</p>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <Button onClick={handleConfirm} disabled={isSubmitting} className="w-full h-12 text-lg rounded-xl shadow-xl shadow-indigo-500/20">
                        {isSubmitting ? 'Processando...' : `Confirmar ${installments}x de ${amount && !isNaN(parseFloat(amount)) ? (parseFloat(amount)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '...'}`}
                    </Button>
                </div>
            </div>
        </div>
    );
};
