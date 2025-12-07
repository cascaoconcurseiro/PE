import React from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../ui/Button';
import { Trash2, AlertTriangle } from 'lucide-react';

interface TransactionDeleteModalProps {
    isOpen: boolean;
    isSeries: boolean;
    onClose: () => void;
    onConfirm: (scope: 'SINGLE' | 'SERIES') => void;
}

export const TransactionDeleteModal: React.FC<TransactionDeleteModalProps> = ({ isOpen, isSeries, onClose, onConfirm }) => {
    if (!isOpen) return null;

    if (isSeries) {
        return (
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Excluir Transação Recorrente"
            >
                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Atenção!</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-400">
                                Esta transação faz parte de uma série (parcelada ou recorrente). Como deseja prosseguir?
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => onConfirm('SINGLE')}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                        >
                            <div className="text-left">
                                <span className="block font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Apenas esta transação</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Exclui somente o registro atual.</span>
                            </div>
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-indigo-500" />
                        </button>

                        <button
                            onClick={() => onConfirm('SERIES')}
                            className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all group"
                        >
                            <div className="text-left">
                                <span className="block font-bold text-red-700 dark:text-red-400">Todas da série</span>
                                <span className="text-xs text-red-600/80 dark:text-red-400/80">Exclui esta e todas as outras relacionadas (parcelas/futuras).</span>
                            </div>
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </button>
                    </div>

                    <Button variant="secondary" onClick={onClose} className="w-full">
                        Cancelar
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <ConfirmModal
            isOpen={isOpen}
            title="Excluir Transação"
            message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
            onConfirm={() => onConfirm('SINGLE')}
            onCancel={onClose}
            isDanger
        />
    );
};
