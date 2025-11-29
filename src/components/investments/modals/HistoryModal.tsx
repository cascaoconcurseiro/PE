import React from 'react';
import { Asset } from '../../../types';
import { formatCurrency } from '../../../utils';
import { Modal } from '../../ui/Modal';
import { X } from 'lucide-react';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, asset }) => {
    if (!asset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Histórico: ${asset.ticker}`}>
            <div className="space-y-4">
                {!asset.tradeHistory || asset.tradeHistory.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhuma negociação registrada.</p>
                ) : (
                    asset.tradeHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((trade) => (
                        <div key={trade.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <div className={`text-xs font-bold uppercase ${trade.type === 'BUY' ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>{trade.type === 'BUY' ? 'Compra' : 'Venda'}</div>
                                <div className="text-sm text-slate-600 dark:text-slate-300">{new Date(trade.date).toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white">{trade.quantity} un. x {formatCurrency(trade.price, trade.currency)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Total: {formatCurrency(trade.total, trade.currency)}</div>
                                {trade.profit && (<div className={`text-xs font-bold ${trade.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>Lucro: {formatCurrency(trade.profit, trade.currency)}</div>)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};