import React, { useState, useEffect } from 'react';
import { FamilyMember, Account, Category, AccountType } from '../../types';
import { Button } from '../ui/Button';
import { X, Calendar, DollarSign, Layers, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { sharedTransactionManager } from '../../services/SharedTransactionManager';
import { EXPENSE_CATEGORIES } from '../../utils/categoryConstants';
import { supabase } from '../../integrations/supabase/client';

// Helper for currency format inside component
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface SharedInstallmentImportProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (txs?: any[]) => void; // Trigger refresh and optional data update
    members: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
    currentUserName?: string;
}

export const SharedInstallmentImport: React.FC<SharedInstallmentImportProps> = ({
    isOpen,
    onClose,
    onImport,
    members,
    accounts,
    currentUserId,
    currentUserName
}) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState('1');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<Category>(Category.OTHER);
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [accountId, setAccountId] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [errors, setErrors] = useState<string[]>([]);

    const { addToast } = useToast();

    // Filter out "Me" from assignee list
    const availableMembers = React.useMemo(() =>
        members.filter(m => m.id !== 'me'),
        [members]
    );

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setDescription('');
            setAmount('');
            setInstallments('1');
            setDate(new Date().toISOString().split('T')[0]);
            setCategory(Category.OTHER);
            setCategory(Category.OTHER);
            setAccountId(''); // Reset account
            setIsSubmitting(false);
            setProgress({ current: 0, total: 0 });
            setErrors([]);

            // Default to first available member
            if (availableMembers.length > 0) {
                setAssigneeId(availableMembers[0].id);
            }
        }
    }, [isOpen, availableMembers]);


    // Calculate Total for Display (Since input is Parcel)
    const totalAmount = (parseFloat(amount) || 0) * (parseInt(installments) || 0);

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        if (!description.trim()) {
            newErrors.push('Descrição é obrigatória');
        }

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            newErrors.push('Valor da parcela deve ser maior que zero');
        }

        if (!installments || isNaN(parseInt(installments)) || parseInt(installments) < 1) {
            newErrors.push('Número de parcelas deve ser pelo menos 1');
        }

        if (parseInt(installments) > 99) {
            newErrors.push('Número máximo de parcelas é 99');
        }

        if (!assigneeId) {
            newErrors.push('Selecione quem vai pagar as parcelas');
        }

        if (!date) {
            newErrors.push('Data da primeira parcela é obrigatória');
        }

        // Account validation removed as per user request (No bank link)

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleConfirm = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (isSubmitting) return;

        if (!validateForm()) {
            addToast('Corrija os erros no formulário', 'error');
            return;
        }

        setIsSubmitting(true);
        console.log('DEBUG: Starting import process via RPC...');

        // Safety timeout
        await new Promise(r => setTimeout(r, 100));

        try {
            // New "Author vs Owner" Logic
            let ownerUserId = currentUserId;
            let mirrorUserId = null;

            // 1. Determine Owner (Who Pays)
            if (assigneeId === 'me' || assigneeId === currentUserId) {
                // I am the Payer (Owner)
                ownerUserId = currentUserId;

                // IF I am paying and it's an "Import", implies Shared.
                // Try to find the Partner to create a Mirror for them
                const partner = members.find(m => m.id !== 'me' && m.id !== currentUserId);
                mirrorUserId = partner?.linkedUserId || null;
            } else {
                // Someone else is Payer (Owner)
                const selectedMember = members.find(m => m.id === assigneeId);
                if (!selectedMember?.linkedUserId) {
                    throw new Error('O usuário selecionado para pagamento não possui conta vinculada (ID ausente).');
                }
                ownerUserId = selectedMember.linkedUserId;

                // If they pay, I get the Mirror (so I can see it as shared/debt)
                mirrorUserId = currentUserId;
            }

            console.log('DEBUG: RPC Params', {
                owner: ownerUserId,
                author: currentUserId,
                mirror: mirrorUserId
            });

            const { data, error } = await supabase.rpc('import_shared_installments', {
                p_user_id: ownerUserId,       // Dívida vai para quem paga
                p_author_id: currentUserId,   // Eu criei
                p_description: description,
                p_parcel_amount: parseFloat(amount),
                p_installments: parseInt(installments),
                p_first_due_date: date,
                p_category: category,
                p_account_id: null,
                p_shared_with_user_id: mirrorUserId
            });

            if (error) throw error;

            console.log('DEBUG: Import Success:', data);
            sharedTransactionManager.clearCache();

            addToast('Importação concluída com sucesso!', 'success');
            onImport(data);
            onClose();

        } catch (error: any) {
            console.error('Erro ao importar:', error);
            addToast('Erro ao importar transações. Tente novamente.', 'error');
            setErrors(['Falha na comunicação com o servidor.']);
        } finally {
            setIsSubmitting(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div
                className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
                onClick={!isSubmitting ? onClose : undefined}
            />
            <div className={`bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full'}`}>

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-500" />
                        Importar Parcelado Compartilhado
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="disabled:opacity-50"
                    >
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Progress indicator */}
                    {isSubmitting && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Importando parcelas...
                                    </p>
                                    {progress.total > 0 && (
                                        <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                                        Erros encontrados:
                                    </p>
                                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                                        {errors.map((error, index) => (
                                            <li key={index}>• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            Descrição *
                        </label>
                        <input
                            disabled={isSubmitting}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white disabled:opacity-50"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ex: Compra Geladeira"
                        />
                    </div>

                    {/* Amount & Installments Row */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                Valor da Parcela *
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input
                                    disabled={isSubmitting}
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white disabled:opacity-50"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            {amount && installments && parseFloat(amount) > 0 && parseInt(installments) > 1 && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Total: {parseInt(installments)}x {parseFloat(amount).toFixed(2)} = R$ {(parseFloat(amount) * parseInt(installments)).toFixed(2)}
                                </p>
                            )}
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                Parcelas *
                            </label>
                            <input
                                disabled={isSubmitting}
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white disabled:opacity-50"
                                value={installments}
                                onChange={e => setInstallments(e.target.value)}
                                placeholder="1"
                                min="1"
                                max="99"
                            />
                        </div>
                    </div>

                    {/* Total Amount Display */}
                    {totalAmount > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Valor total: <span className="font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(totalAmount)}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            Data 1ª Parcela *
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                disabled={isSubmitting}
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white disabled:opacity-50"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            Categoria *
                        </label>
                        <select
                            disabled={isSubmitting}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white disabled:opacity-50"
                            value={category}
                            onChange={e => setCategory(e.target.value as Category)}
                        >
                            {EXPENSE_CATEGORIES.map((group, index) => (
                                <optgroup key={index} label={group.label}>
                                    {group.options.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Credit Card Selector REMOVED */}

                    {/* Assignee Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            Quem vai pagar as parcelas? *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setAssigneeId('me')}
                                className={`
                                    p-3 rounded-xl border font-bold text-sm transition-all
                                    ${assigneeId === 'me'
                                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-500'}
                                `}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    {assigneeId === 'me' && <Check className="w-4 h-4" />}
                                    Eu ({currentUserName?.split(' ')[0] || 'Mim'})
                                </div>
                            </button>

                            {availableMembers.map(member => (
                                <button
                                    key={member.id}
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => setAssigneeId(member.id)}
                                    className={`
                                        p-3 rounded-xl border font-bold text-sm transition-all
                                        ${assigneeId === member.id
                                            ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-500'}
                                    `}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        {assigneeId === member.id && <Check className="w-4 h-4" />}
                                        {member.name.split(' ')[0]}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {availableMembers.length === 0 && (
                            <p className="text-sm text-red-500 mt-2">
                                Nenhum membro disponível para atribuir.
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <Button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {isSubmitting ? (
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                            // Logic Fixed: Display PARCEL Value directly
                            amount && !isNaN(parseFloat(amount)) && installments && !isNaN(parseInt(installments))
                                ? `Confirmar ${installments}x de ${formatCurrency(parseFloat(amount))}`
                                : 'Confirmar'
                        )}
                    </Button>
                    {totalAmount > 0 && (
                        <p className="text-center text-xs text-slate-500 mt-2">
                            Total: {formatCurrency(totalAmount)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
