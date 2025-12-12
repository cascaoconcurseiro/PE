import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Asset, Account, AccountType } from '../../../types';
import { Minus, Save } from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface SellAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSell: (assetId: string, quantity: number, price: number, date: string, accountId: string) => void;
    selectedAsset: Asset | null;
    accounts: Account[];
}

export const SellAssetModal: React.FC<SellAssetModalProps> = ({
    isOpen,
    onClose,
    onSell,
    selectedAsset,
    accounts
}) => {
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [targetAccountId, setTargetAccountId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAsset && quantity && price && targetAccountId) {
            onSell(selectedAsset.id, parseFloat(quantity), parseFloat(price), date, targetAccountId);
            onClose();
        }
    };

    if (!selectedAsset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Vender ${selectedAsset.ticker}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl mb-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Disponível</span>
                        <span className="font-bold">{selectedAsset.quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Preço Médio</span>
                        <span className="font-bold">{formatCurrency(selectedAsset.averagePrice, selectedAsset.currency)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Destino dos Recursos</label>
                    <select required value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-bold">
                        <option value="">Selecione uma conta...</option>
                        {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>

                <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                        <Minus className="w-4 h-4 mr-2" /> Confirmar Venda
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
