import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType } from '../types';
import { convertToBRL } from '../services/currencyService';
import { InvestmentSummaryCards } from './investments/InvestmentSummaryCards';
import { InvestmentOperations } from './investments/InvestmentOperations';
import { InvestmentFilters } from './investments/InvestmentFilters';
import { AllocationChart } from './investments/AllocationChart';
import { BrokerageChart } from './investments/BrokerageChart';
import { AssetList } from './investments/AssetList';
import { AssetFormModal } from './investments/modals/AssetFormModal';
import { SellAssetModal } from './investments/modals/SellAssetModal';
import { DividendModal } from './investments/modals/DividendModal';
import { HistoryModal } from './investments/modals/HistoryModal';
import { IRReportModal } from './investments/modals/IRReportModal';
import { CorporateActionModal } from './investments/modals/CorporateActionModal';
import { prepareAssetsForExport } from '../services/exportUtils';
import { exportToCSV } from '../services/exportUtils';
import { printAssetsReport } from '../services/printUtils';
import { ConfirmModal } from './ui/ConfirmModal';
import { useInvestmentActions } from '../hooks/useInvestmentActions';

interface InvestmentsProps {
    accounts: Account[];
    transactions: Transaction[];
    assets: Asset[];
    onAddAsset: (asset: Omit<Asset, 'id'>) => void;
    onUpdateAsset: (asset: Asset) => void;
    onDeleteAsset: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    onAddAccount: (account: Omit<Account, 'id'>) => Promise<void>;
    currentDate: Date;
    showValues: boolean;
}

export const Investments: React.FC<InvestmentsProps> = ({
    accounts,
    assets,
    onAddAsset,
    onUpdateAsset,
    onDeleteAsset,
    onAddTransaction,
    onAddAccount,
    showValues
}) => {
    // Modal States
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [isIRModalOpen, setIsIRModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);

    // Data States
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    // Hooks
    const {
        confirmModal,
        setConfirmModal,
        handleSaveAsset,
        handleSellAsset,
        handleRecordDividend,
        handleCorporateAction
    } = useInvestmentActions({
        accounts,
        assets,
        onAddAsset,
        onUpdateAsset,
        onAddTransaction,
        onAddAccount
    });

    // Filter States
    const [filterType, setFilterType] = useState<AssetType | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // --- Calculations ---
    const totalInvested = assets.reduce((acc, asset) => acc + convertToBRL(asset.quantity * asset.averagePrice, asset.currency), 0);
    const currentTotal = assets.reduce((acc, asset) => acc + convertToBRL(asset.quantity * asset.currentPrice, asset.currency), 0);
    const profit = currentTotal - totalInvested;
    const profitPercentage = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    const allocationData = useMemo(() => {
        const data: { [key: string]: number } = {};
        assets.forEach(asset => {
            const valueInBRL = convertToBRL(asset.quantity * asset.currentPrice, asset.currency);
            data[asset.type] = (data[asset.type] || 0) + valueInBRL;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [assets]);

    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'ALL' || asset.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const handleExport = () => {
        const data = prepareAssetsForExport(filteredAssets);
        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Carteira_Investimentos');
    };

    const handlePrint = () => {
        printAssetsReport(filteredAssets);
    };

    return (
        <div className="space-y-8 pb-24">
            <InvestmentSummaryCards
                currentTotal={currentTotal}
                totalInvested={totalInvested}
                profit={profit}
                profitPercentage={profitPercentage}
                showValues={showValues}
            />

            <InvestmentOperations
                onNewAsset={() => { setEditingAsset(null); setIsAssetModalOpen(true); }}
                onSell={() => { setSelectedAsset(null); setIsSellModalOpen(true); }}
                onDividend={() => { setSelectedAsset(null); setIsDividendModalOpen(true); }}
                onIR={() => setIsIRModalOpen(true)}
            />

            <InvestmentFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterType={filterType}
                setFilterType={setFilterType}
                onExport={handleExport}
                onPrint={handlePrint}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AllocationChart
                    data={allocationData}
                    currentTotal={currentTotal}
                    showValues={showValues}
                />
                <BrokerageChart
                    assets={filteredAssets}
                    accounts={accounts}
                    showValues={showValues}
                />
            </div>

            <AssetList
                assets={filteredAssets}
                onEdit={(asset) => { setEditingAsset(asset); setIsAssetModalOpen(true); }}
                onHistory={(asset) => { setSelectedAsset(asset); setIsHistoryModalOpen(true); }}
                onDelete={onDeleteAsset}
                onSell={(asset) => { setSelectedAsset(asset); setIsSellModalOpen(true); }}
                onBuy={(asset) => { setEditingAsset(null); setSelectedAsset(asset); setIsAssetModalOpen(true); }}
                onAction={(asset) => { setSelectedAsset(asset); setIsActionModalOpen(true); }}
                showValues={showValues}
            />

            {/* MODALS */}
            <AssetFormModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={(data, isCreating, newName) => handleSaveAsset(data, isCreating, newName, editingAsset, () => {
                    setIsAssetModalOpen(false);
                    setEditingAsset(null);
                })}
                editingAsset={editingAsset}
                accounts={accounts}
                assets={assets}
            />

            <SellAssetModal
                isOpen={isSellModalOpen}
                onClose={() => setIsSellModalOpen(false)}
                onSell={(assetId, qty, price, date, destId) => handleSellAsset(assetId, qty, price, date, destId, () => {
                    setIsSellModalOpen(false);
                    setSelectedAsset(null);
                })}
                selectedAsset={selectedAsset}
                accounts={accounts}
            />

            <DividendModal
                isOpen={isDividendModalOpen}
                onClose={() => setIsDividendModalOpen(false)}
                onSave={(assetId, amount, date, destId) => handleRecordDividend(assetId, amount, date, destId, () => {
                    setIsDividendModalOpen(false);
                    setSelectedAsset(null);
                })}
                assets={assets}
                accounts={accounts}
            />

            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                asset={selectedAsset}
            />

            <IRReportModal
                isOpen={isIRModalOpen}
                onClose={() => setIsIRModalOpen(false)}
                assets={assets}
            />

            <CorporateActionModal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                onSave={(type, factor, cost) => handleCorporateAction(type, factor, cost, selectedAsset, () => {
                    setIsActionModalOpen(false);
                    setSelectedAsset(null);
                })}
                asset={selectedAsset}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
};