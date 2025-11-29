import React from 'react';
import { Asset, AssetType } from '../../types';
import { Building2, Bitcoin, Landmark, PieChart as PieChartIcon, Activity, Edit2, History, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../utils';

interface AssetListProps {
    assets: Asset[];
    onEdit: (asset: Asset) => void;
    onHistory: (asset: Asset) => void;
    onDelete: (id: string) => void;
    onSell: (asset: Asset) => void;
    onBuy: (asset: Asset) => void;
    onAction: (asset: Asset) => void;
    showValues: boolean;
}

export const AssetList: React.FC<AssetListProps> = ({
    assets,
    onEdit,
    onHistory,
    onDelete,
    onSell,
    onBuy,
    onAction,
    showValues
}) => {
    const getAssetIcon = (type: AssetType) => {
        switch (type) {
            case AssetType.STOCK: return <Building2 className="w-6 h-6 text-indigo-600" />;
            case AssetType.REIT: return <Building2 className="w-6 h-6 text-emerald-600" />;
            case AssetType.CRYPTO: return <Bitcoin className="w-6 h-6 text-orange-500" />;
            case AssetType.TREASURY: return <Landmark className="w-6 h-6 text-yellow-600" />;
            case AssetType.ETF: return <PieChartIcon className="w-6 h-6 text-blue-500" />;
            default: return <Activity className="w-6 h-6 text-slate-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Meus Ativos
            </h3>

            {assets.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Nenhum ativo encontrado.</p>
                    <p className="text-sm mt-1">Use o botão "Novo Aporte" para começar.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {assets.map(asset => {
                        const assetTotal = asset.quantity * asset.currentPrice;
                        const assetProfit = assetTotal - (asset.quantity * asset.averagePrice);
                        const assetProfitPercent = (assetProfit / (asset.quantity * asset.averagePrice)) * 100;

                        return (
                            <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                                            {getAssetIcon(asset.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-slate-900 dark:text-white text-xl tracking-tight">{asset.ticker}</h4>
                                                <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full font-bold border border-slate-200 dark:border-slate-600 uppercase tracking-wider">{asset.type}</span>
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">{asset.name}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onEdit(asset)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => onHistory(asset)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Histórico"><History className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(asset.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quantidade</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">{asset.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Preço Médio</p>
                                        <p className="font-medium text-slate-600 dark:text-slate-300">{showValues ? formatCurrency(asset.averagePrice, asset.currency) : '••••••'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Preço Atual</p>
                                        <p className="font-medium text-slate-600 dark:text-slate-300">{showValues ? formatCurrency(asset.currentPrice, asset.currency) : '••••••'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total</p>
                                        <p className="font-black text-slate-900 dark:text-white text-lg">{showValues ? formatCurrency(assetTotal, asset.currency) : '••••••'}</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-between items-center">
                                    <div className={`text-sm font-bold ${assetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} flex items-center gap-1 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700`}>
                                        {assetProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                        <span>{showValues ? formatCurrency(assetProfit, asset.currency) : '•••'}</span>
                                        <span className="opacity-75 ml-1">({assetProfitPercent.toFixed(2)}%)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onAction(asset)} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">Evento</button>
                                        <button onClick={() => onSell(asset)} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Vender</button>
                                        <button onClick={() => onBuy(asset)} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">Comprar</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
