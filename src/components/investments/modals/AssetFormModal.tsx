import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Asset, AssetType, Account, AccountType } from '../../../types';
import { Plus, Save, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface AssetFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assetData: import('../../../types').Asset, isCreatingAccount: boolean, newAccountName: string) => void;
    editingAsset: Asset | null;
    accounts: Account[];
    assets?: Asset[]; // Optional: for ticker detection
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    editingAsset,
    accounts,
    assets = []
}) => {
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [ticker, setTicker] = useState('');
    const [selectedBrokerage, setSelectedBrokerage] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setIsCreatingAccount(false);
            setNewAccountName('');
            setTicker('');
            setSelectedBrokerage('');
        } else if (editingAsset) {
            setTicker(editingAsset.ticker);
            setSelectedBrokerage(editingAsset.accountId);
        }
    }, [isOpen, editingAsset]);

    // Detect if ticker already exists in selected brokerage
    const existingAsset = useMemo(() => {
        if (!ticker || !selectedBrokerage || editingAsset) return null;
        return assets.find(a => 
            a.ticker.toUpperCase() === ticker.toUpperCase() && 
            a.accountId === selectedBrokerage
        );
    }, [ticker, selectedBrokerage, assets, editingAsset]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        
        const assetData: Asset = {
            id: editingAsset?.id || crypto.randomUUID(),
            ticker: String(data.ticker || '').toUpperCase(),
            name: String(data.name || ''),
            type: data.type as AssetType,
            quantity: parseFloat(String(data.quantity)) || 0,
            averagePrice: parseFloat(String(data.averagePrice)) || 0,
            currentPrice: editingAsset?.currentPrice || parseFloat(String(data.averagePrice)) || 0,
            currency: String(data.currency || 'BRL'),
            accountId: String(data.accountId || ''),
        };
        
        onSave(assetData, isCreatingAccount, newAccountName);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingAsset ? "Editar Ativo" : "Novo Aporte"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Existing Asset Alert */}
                {existingAsset && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold text-amber-800 dark:text-amber-300">Ativo já existe nesta corretora!</p>
                            <p className="text-amber-700 dark:text-amber-400 mt-1">
                                Você possui <strong>{existingAsset.quantity}</strong> unidades de <strong>{existingAsset.ticker}</strong> com preço médio de <strong>{formatCurrency(existingAsset.averagePrice, existingAsset.currency)}</strong>.
                            </p>
                            <p className="text-amber-600 dark:text-amber-500 mt-1 text-xs">
                                Ao salvar, o sistema irá somar a quantidade e recalcular o preço médio automaticamente.
                            </p>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Ticker / Código</label>
                    <input 
                        name="ticker" 
                        required 
                        value={ticker}
                        onChange={e => setTicker(e.target.value.toUpperCase())}
                        placeholder="Ex: PETR4, AAPL, BTC" 
                        className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white placeholder:text-slate-400 uppercase ${existingAsset ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700'}`} 
                    />
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
                                value={selectedBrokerage}
                                onChange={e => setSelectedBrokerage(e.target.value)}
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
