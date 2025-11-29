import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Asset, AssetType } from '../../../types';
import { formatCurrency } from '../../../utils';
import { exportToCSV, prepareAssetsForExport } from '../../../services/exportUtils';
import { calculateTaxReport } from '../../../services/taxEngine';
import { Download, Printer, FileText, Calculator } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'ASSETS' | 'TAX'>('ASSETS');
    const taxReport = React.useMemo(() => calculateTaxReport(assets), [assets]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório para Imposto de Renda">
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">

                {/* Tabs */}
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit mx-auto">
                    <button
                        onClick={() => setActiveTab('ASSETS')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'ASSETS' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <FileText className="w-4 h-4" /> Bens e Direitos
                    </button>
                    <button
                        onClick={() => setActiveTab('TAX')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'TAX' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Calculator className="w-4 h-4" /> Apuração Mensal (DARF)
                    </button>
                </div>

                {activeTab === 'ASSETS' ? (
                    <>
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
                                exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Relatorio_IR_Bens');
                            }}>
                                <Download className="w-4 h-4 mr-2" /> Exportar Excel
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                            <p>Simulação de imposto devido baseada nas vendas registradas. Verifique sempre com seu contador.</p>
                        </div>

                        <div className="space-y-6">
                            {taxReport.map(month => (
                                <div key={month.month} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <h4 className="font-bold text-lg text-slate-800 dark:text-white capitalize">
                                            {new Date(month.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                        </h4>
                                        {month.taxDue > 0 ? (
                                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
                                                DARF: {formatCurrency(month.taxDue)}
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                                                Isento
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                            <span className="text-slate-500 text-xs block">Swing Trade</span>
                                            <span className={`font-bold ${month.swingTradeProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatCurrency(month.swingTradeProfit)}
                                            </span>
                                            <span className="text-xs text-slate-400 block mt-1">Vendas: {formatCurrency(month.totalSoldSwingTrade)}</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                            <span className="text-slate-500 text-xs block">Day Trade</span>
                                            <span className={`font-bold ${month.dayTradeProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatCurrency(month.dayTradeProfit)}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                            <span className="text-slate-500 text-xs block">FIIs</span>
                                            <span className={`font-bold ${month.fiiProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatCurrency(month.fiiProfit)}
                                            </span>
                                        </div>
                                    </div>

                                    {month.details.length > 0 && (
                                        <div className="text-xs text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg">
                                            {month.details.map((detail, idx) => (
                                                <p key={idx}>• {detail}</p>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-4 text-xs text-slate-400">
                                        <span>Prejuízo Acum. Swing: {formatCurrency(month.accumulatedLossSwing)}</span>
                                        <span>Prejuízo Acum. FII: {formatCurrency(month.accumulatedLossFII)}</span>
                                    </div>
                                </div>
                            ))}

                            {taxReport.length === 0 && (
                                <p className="text-center text-slate-400 py-8">Nenhuma venda registrada para apuração.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
