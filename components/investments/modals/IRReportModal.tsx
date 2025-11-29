import React from 'react';
import { Modal } from '../../ui/Modal';
import { Asset, AssetType } from '../../../types';
import { formatCurrency } from '../../../utils';
import { exportToCSV, prepareAssetsForExport } from '../../../services/exportUtils';
import { Download, Printer } from 'lucide-react';
import { Button } from '../../ui/Button';

interface IRReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
}

export const IRReportModal: React.FC<IRReportModalProps> = ({
    isOpen,
    onClose,
    assets
}) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório para Imposto de Renda">
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-blue-800 dark:text-blue-300 text-sm">
                    <p>Este relatório apresenta a posição consolidada dos seus ativos para declaração de Bens e Direitos.</p>
                </div>

                <div className="space-y-4">
                    {assets.map(asset => (
                        <div key={asset.id} className="border-b border-slate-100 dark:border-slate-700 pb-4 last:border-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-slate-900 dark:text-white">{asset.ticker} - {asset.name}</h4>
                                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{asset.type}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                <div>
                                    <span className="text-slate-500 block text-xs">Discriminação Sugerida</span>
                                    <p className="text-slate-700 dark:text-slate-300 mt-1">
                                        {asset.quantity} unidades de {asset.name} ({asset.ticker}), ao custo médio de {formatCurrency(asset.averagePrice, asset.currency)}.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 block text-xs">Situação em 31/12</span>
                                    <p className="font-bold text-slate-900 dark:text-white text-lg mt-1">
                                        {formatCurrency(asset.quantity * asset.averagePrice, asset.currency)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                    <Button variant="secondary" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" /> Imprimir
                    </Button>
                    <Button onClick={() => {
                        const data = prepareAssetsForExport(assets);
                        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Relatorio_IR');
                    }}>
                        <Download className="w-4 h-4 mr-2" /> Exportar Excel
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
