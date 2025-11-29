import React from 'react';
import { Asset, Account } from '../../../types';
import { Button } from '../../ui/Button';
import { Minus } from 'lucide-react';
import { formatCurrency } from '../../../utils';
import { Modal } from '../../ui/Modal';

interface SellAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSell: (e: React.FormEvent) => void;
    assets: Asset[];
    bankingAccounts: Account[];
    selectedAsset: Asset | null;
}

export const SellAssetModal: React.FC<SellAssetModalProps> = ({
    isOpen, onClose, onSell, assets, bankingAccounts, selectedAsset
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Venda">
            <form onSubmit={onSell} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ativo</label>
                    {selectedAsset ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{selectedAsset.ticker} - {selectedAsset.name}</div>
                    ) : (
                        <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                            <option value="">Selecione o ativo...</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade</label><input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Preço Venda</label><input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Destino do Dinheiro (Recebimento)</label>
                    <select name="destAccountId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                        <option value="">Selecione a conta...</option>
                        {bankingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>)}
                    </select>
                </div>

                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>

                <Button type="submit" className="w-full h-14 text-base bg-red-600 hover:bg-red-700 text-white shadow-red-200 shadow-lg rounded-xl mt-2">
                    <Minus className="w-5 h-5 mr-2" /> Confirmar Venda
                </Button>
            </form>
        </Modal>
    );
};