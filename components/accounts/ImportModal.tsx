import React, { useState } from 'react';
import { Transaction, TransactionType, Category } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils';
import { Check, AlertTriangle } from 'lucide-react';
import { OFXTransaction } from '../../services/ofxParser';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (transactions: OFXTransaction[]) => void;
    importedTransactions: OFXTransaction[];
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, importedTransactions }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(importedTransactions.map(t => t.id)));

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        const toImport = importedTransactions.filter(t => selectedIds.has(t.id));
        onImport(toImport);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Transações (OFX)">
            <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex gap-3 items-start text-blue-700 dark:text-blue-300 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>Verifique as transações abaixo antes de importar. O sistema tentou identificar automaticamente receitas e despesas.</p>
                </div>

                <div className="max-h-[400px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                    {importedTransactions.map(tx => (
                        <div
                            key={tx.id}
                            className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedIds.has(tx.id) ? 'bg-slate-50 dark:bg-slate-800/50' : 'opacity-50'}`}
                            onClick={() => toggleSelection(tx.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(tx.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {selectedIds.has(tx.id) && <Check className="w-3 h-3" />}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{tx.description}</p>
                                    <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <span className={`font-bold text-sm ${tx.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-600'}`}>
                                {tx.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(tx.amount)}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                        Importar {selectedIds.size} Transações
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
