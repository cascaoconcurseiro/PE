import React from 'react';
import { Modal } from '../../ui/Modal';
import { Asset } from '../../../types';
import { formatCurrency } from '../../../utils';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    asset
}) => {
    if (!asset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Histórico: ${asset.ticker}`}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {(!asset.tradeHistory || asset.tradeHistory.length === 0) ? (
                    <p className="text-center text-slate-500 py-8">Nenhum histórico registrado.</p>
                ) : (
                    asset.tradeHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{h.type === 'BUY' ? 'Compra' : 'Venda'}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(h.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-sm font-bold ${h.type === 'BUY' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {h.type === 'BUY' ? '+' : '-'}{h.quantity} @ {formatCurrency(h.price, asset.currency)}
                                </p>
                                <p className="text-xs text-slate-400">Total: {formatCurrency(h.quantity * h.price, asset.currency)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};
