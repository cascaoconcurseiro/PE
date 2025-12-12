import React, { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Asset, AssetType, Account, AccountType } from '../../../types';
import { Plus, Save } from 'lucide-react';

interface AssetFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assetData: any, isCreatingAccount: boolean, newAccountName: string) => void;
    editingAsset: Asset | null;
    accounts: Account[];
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    editingAsset,
    accounts
}) => {
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setIsCreatingAccount(false);
            setNewAccountName('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        onSave(data, isCreatingAccount, newAccountName);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingAsset ? "Editar Ativo" : "Novo Aporte"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Ticker / Código</label>
                    <input name="ticker" required defaultValue={editingAsset?.ticker} placeholder="Ex: PETR4, AAPL, BTC" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white placeholder:text-slate-400 uppercase" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Ativo</label>
                    <input name="name" required defaultValue={editingAsset?.name} placeholder="Ex: Petrobras PN" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white placeholder:text-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                        <select name="type" required defaultValue={editingAsset?.type || AssetType.STOCK} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white">
                            {(Object.values(AssetType) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Moeda</label>
                        <select name="currency" required defaultValue={editingAsset?.currency || 'BRL'} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white">
                            <option value="BRL">Real (BRL)</option>
                            <option value="USD">Dólar (USD)</option>
                            <option value="EUR">Euro (EUR)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade</label>
                        <input name="quantity" type="number" step="any" required defaultValue={editingAsset?.quantity} placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Preço Médio / Custo</label>
                        <input name="averagePrice" type="number" step="any" required defaultValue={editingAsset?.averagePrice} placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" />
                    </div>
                </div>



                {/* Brokerage Account Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Corretora (Onde o ativo ficará)</label>
                    <div className="flex gap-2">
                        {!isCreatingAccount ? (
                            <select
                                name="accountId"
                                required
                                defaultValue={editingAsset?.accountId}
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white"
                            >
                                <option value="">Selecione a corretora...</option>
                                {accounts.filter(a => a.type === AccountType.INVESTMENT).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                            </select>
                        ) : (
                            <input
                                value={newAccountName}
                                onChange={e => setNewAccountName(e.target.value)}
                                placeholder="Nome da nova corretora..."
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                autoFocus
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => setIsCreatingAccount(!isCreatingAccount)}
                            className={`p-3 rounded-xl border transition-colors ${isCreatingAccount ? 'bg-red-50 text-red-600 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}
                            title={isCreatingAccount ? "Cancelar criação" : "Nova Corretora"}
                        >
                            {isCreatingAccount ? <span className="text-xs font-bold">Cancelar</span> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Source Account (Where money comes from) */}
                {!editingAsset && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Origem do Dinheiro (Pagamento)</label>
                        <select name="sourceAccountId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white">
                            <option value="">Selecione a conta...</option>
                            {accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                        </select>
                    </div>
                )}

                <div className="pt-4 flex gap-3">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <Save className="w-4 h-4 mr-2" /> Salvar Ativo
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
