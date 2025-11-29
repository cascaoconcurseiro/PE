import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Asset, Account, AccountType } from '../../../types';
import { DollarSign } from 'lucide-react';

interface DividendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assetId: string, amount: number, date: string, accountId: string) => void;
    assets: Asset[];
    accounts: Account[];
}

export const DividendModal: React.FC<DividendModalProps> = ({
    isOpen,
    onClose,
    onSave,
    assets,
    accounts
}) => {
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [targetAccountId, setTargetAccountId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAssetId && amount && targetAccountId) {
            onSave(selectedAssetId, parseFloat(amount), date, targetAccountId);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Proventos (Dividendos/JCP)">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label>
                    <select required value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-bold">
                        <option value="">Selecione o ativo...</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Valor Recebido</label>
                        <input type="number" step="any" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-bold" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Data de Recebimento</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-bold" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Conta de Destino</label>
                    <select required value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-bold">
                        <option value="">Selecione a conta...</option>
                        {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>

                <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <DollarSign className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
