import React, { useEffect } from 'react';
import { Asset, AssetType, Account, AccountType } from '../../../types';
import { AVAILABLE_CURRENCIES } from '../../../services/currencyService';
import { Button } from '../../ui/Button';
import { Save, AlertCircle } from 'lucide-react';
import { Modal } from '../../ui/Modal';

interface AssetFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    editingAsset: Asset | null;
    accounts: Account[];
    bankingAccounts: Account[];
    isCreatingAccount: boolean;
    setIsCreatingAccount: (v: boolean) => void;
    newAccountName: string;
    setNewAccountName: (v: string) => void;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
    isOpen, onClose, onSave, editingAsset, accounts, bankingAccounts,
    isCreatingAccount, setIsCreatingAccount, newAccountName, setNewAccountName
}) => {
    // Reset state when modal opens
    useEffect(() => {
        if (!isOpen) {
            setIsCreatingAccount(false);
            setNewAccountName('');
        }
    }, [isOpen, setIsCreatingAccount, setNewAccountName]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingAsset ? "Editar Ativo" : "Novo Aporte"}>
            {!editingAsset && (
                <div className="mb-6 p-4 bg-indigo-50 text-indigo-800 text-xs rounded-xl border border-indigo-100 flex items-start gap-3 leading-relaxed">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
                    <span>Se você inserir o código (Ticker) de um ativo que já possui na mesma corretora, o sistema irá <strong>somar a quantidade</strong> e recalcular o <strong>preço médio</strong> automaticamente.</span>
                </div>
            )}

            <form onSubmit={onSave} className="space-y-5">
                {/* Account Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Corretora (Onde o ativo ficará)</label>
                    <select
                        name="accountId"
                        required
                        defaultValue={editingAsset?.accountId}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all"
                        onChange={(e) => setIsCreatingAccount(e.target.value === 'NEW')}
                    >
                        <option value="">Selecione a corretora...</option>
                        {accounts.filter(a => a.type === AccountType.INVESTMENT).map(a => (<option key={a.id} value={a.id}>{a.name} ({a.currency})</option>))}
                        <option value="NEW" className="font-bold text-indigo-600">+ Nova Corretora</option>
                    </select>
                </div>

                {isCreatingAccount && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-in fade-in slide-in-from-top-2">
                        <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">Nome da Nova Corretora</label>
                        <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Ex: NuInvest, XP..." className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900 dark:text-white" />
                    </div>
                )}

                {/* Source Account (Where money comes from) */}
                {!editingAsset && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Origem do Dinheiro (Pagamento)</label>
                        <select name="sourceAccountId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                            <option value="">Selecione a conta...</option>
                            {bankingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)} {a.currency})</option>)}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Ticker</label><input name="ticker" required defaultValue={editingAsset?.ticker} placeholder="Ex: PETR4" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 uppercase dark:text-white" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tipo</label><select name="type" required defaultValue={editingAsset?.type || AssetType.STOCK} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white">{(Object.values(AssetType) as string[]).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nome da Empresa/Fundo</label><input name="name" required defaultValue={editingAsset?.name} placeholder="Ex: Petróleo Brasileiro S.A." className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Moeda do Ativo</label><select name="currency" required defaultValue={editingAsset?.currency || 'BRL'} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white">{AVAILABLE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade</label><input name="quantity" type="number" step="0.000001" required defaultValue={editingAsset?.quantity} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{editingAsset ? 'Preço Médio' : 'Preço de Compra'}</label><input name="averagePrice" type="number" step="0.01" required defaultValue={editingAsset?.averagePrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Preço Atual (Cotação)</label><input name="currentPrice" type="number" step="0.01" required defaultValue={editingAsset?.currentPrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                </div>

                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Data da Operação</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white" /></div>

                <Button type="submit" className="w-full h-14 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg rounded-xl mt-4">
                    <Save className="w-5 h-5 mr-2" /> {editingAsset ? 'Salvar Alterações' : 'Confirmar Aporte'}
                </Button>
            </form>
        </Modal>
    );
};