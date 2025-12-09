import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { supabase } from '../../integrations/supabase/client';
import { Transaction, FamilyMember, Account, TransactionType, Category, SyncStatus } from '../../types';
import { formatCurrency } from '../../utils';
import { Check, Search, Download } from 'lucide-react';

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
    const [candidates, setCandidates] = useState<Transaction[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    // Fetch potential installments to import (e.g. recent personal credit card installments)
    useEffect(() => {
        if (isOpen) {
            fetchCandidates();
        }
    }, [isOpen]);

    const fetchCandidates = async () => {
        setIsLoading(true);
        try {
            // Logic: Find recent credit card expenses that are installments and NOT shared
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'DESPESA')
                .eq('is_installment', true)
                .eq('is_shared', false)
                .order('date', { ascending: false })
                .limit(50);

            if (data) {
                setCandidates(data as Transaction[]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleImportConfirm = () => {
        const selectedTxs = candidates.filter(c => selectedIds.has(c.id));

        // Transform for import: Mark as Shared, assign to split?
        // Usage in Shared.tsx treats them as *new* transactions passed to onAddTransaction.
        // But usually we want to "Share" an existing one.
        // For now, to satisfy the build and basic logic, let's create COPIES that are shared?
        // Or updated versions.
        // Given usage `onAddTransaction(t)`, it implies creating NEW ones.
        // Let's create a shared copy relative to the selected members.
        // For simplicity, I'll pass the raw transaction object modified to be shared.

        const preparedTxs = selectedTxs.map(tx => ({
            ...tx,
            id: undefined, // Create new ID
            description: `${tx.description} (Compartilhado)`,
            isShared: true,
            sharedWith: [], // User will need to configure split after or default to equal
            // We might want to open an edit modal for each, but bulk import suggests just dumping them in.
            // Let's assume default split or empty split to be configured.
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        }));

        onImport(preparedTxs);
        setSelectedIds(new Set());
    };

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="Importar Parcelas">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {isLoading ? (
                    <p className="text-center text-slate-500">Buscando transações...</p>
                ) : candidates.length === 0 ? (
                    <p className="text-center text-slate-500">Nenhuma parcela disponível para importação.</p>
                ) : (
                    <div className="space-y-2">
                        {candidates.map(tx => (
                            <div
                                key={tx.id}
                                className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer ${selectedIds.has(tx.id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                onClick={() => toggleSelection(tx.id)}
                            >
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{tx.description}</p>
                                    <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()} • {formatCurrency(tx.amount)}</p>
                                </div>
                                {selectedIds.has(tx.id) && <Check className="w-5 h-5 text-emerald-600" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleImportConfirm} disabled={selectedIds.size === 0}>
                    <Download className="w-4 h-4 mr-2" /> Importar ({selectedIds.size})
                </Button>
            </div>
        </Dialog>
    );
};
