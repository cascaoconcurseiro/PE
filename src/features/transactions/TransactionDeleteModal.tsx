import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../ui/Button';
import { Trash2, AlertTriangle, Check } from 'lucide-react';

interface TransactionDeleteModalProps {
    isOpen: boolean;
    isSeries: boolean;
    onClose: () => void;
    onConfirm: (scope: 'SINGLE' | 'SERIES') => void;
}

export const TransactionDeleteModal: React.FC<TransactionDeleteModalProps> = ({ isOpen, isSeries, onClose, onConfirm }) => {
    const [selectedScope, setSelectedScope] = useState<'SINGLE' | 'SERIES'>('SINGLE');

    if (!isOpen) return null;

    if (isSeries) {
        return (
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Excluir Transação"
            >
                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Atenção!</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-400">
                                Esta transação faz parte de uma série (parcelada ou recorrente).
                                Selecione uma opção e clique em confirmar.
                            </p>
                        </div>
                    </div>

                    {/* Selection Options */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            O que deseja excluir?
                        </label>

                        <button
                            type="button"
                            onClick={() => setSelectedScope('SINGLE')}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedScope === 'SINGLE'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <div className="text-left">
                                <span className={`block font-bold ${selectedScope === 'SINGLE' ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    Apenas esta transação
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Exclui somente o registro atual.
                                </span>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedScope === 'SINGLE'
                                    ? 'border-indigo-500 bg-indigo-500'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                {selectedScope === 'SINGLE' && <Check className="w-4 h-4 text-white" />}
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedScope('SERIES')}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedScope === 'SERIES'
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500/30'
                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <div className="text-left">
                                <span className={`block font-bold ${selectedScope === 'SERIES' ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    Todas da série
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Exclui esta e todas as outras relacionadas (parcelas/futuras).
                                </span>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedScope === 'SERIES'
                                    ? 'border-red-500 bg-red-500'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                {selectedScope === 'SERIES' && <Check className="w-4 h-4 text-white" />}
                            </div>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => onConfirm(selectedScope)}
                            className={`flex-1 ${selectedScope === 'SERIES'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Confirmar Exclusão
                        </Button>
                    </div>
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
