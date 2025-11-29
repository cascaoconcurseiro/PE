import React from 'react';
import { Asset, AssetType } from '../../../types';
import { Button } from '../../ui/Button';
import { formatCurrency } from '../../../utils';
import { Modal } from '../../ui/Modal';
import { Printer } from 'lucide-react';

interface IRReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
}

export const IRReportModal: React.FC<IRReportModalProps> = ({ isOpen, onClose, assets }) => {
    const assetTypes = Object.values(AssetType) as string[];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório para Imposto de Renda">
            <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm border border-yellow-100 dark:border-yellow-900/30">
                    <strong>Atenção:</strong> Este relatório é apenas informativo. Confira sempre os informes oficiais das corretoras e escrituradores.
                </div>
                <div className="space-y-6">
                    {assetTypes.map((type) => {
                        // Cast type to AssetType for filtering to avoid TS errors
                        const typeAssets = assets.filter(a => a.type === type as AssetType);
                        if (typeAssets.length === 0) return null;
                        return (
                            <div key={type}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">{type}</h4>
                                <div className="space-y-2">
                                    {typeAssets.map(asset => (
                                        <div key={asset.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg">
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white">{asset.ticker} - {asset.name}</div>
                                                <div className="text-slate-500 dark:text-slate-400 text-xs">CNPJ: (Verificar Informe)</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-slate-700 dark:text-slate-300">{asset.quantity} un. a {formatCurrency(asset.averagePrice, asset.currency)}</div>
                                                <div className="font-bold text-slate-900 dark:text-white">Total: {formatCurrency(asset.quantity * asset.averagePrice, asset.currency)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <Button onClick={() => window.print()} variant="secondary">
                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
            </div>
        </Modal>
    );
};