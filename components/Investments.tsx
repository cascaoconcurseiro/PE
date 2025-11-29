import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType, TransactionType, Category } from '../types';
import { convertToBRL } from '../services/currencyService';
import { formatCurrency } from '../utils';
import { InvestmentSummaryCards } from './investments/InvestmentSummaryCards';
import { InvestmentOperations } from './investments/InvestmentOperations';
import { InvestmentFilters } from './investments/InvestmentFilters';
import { AllocationChart } from './investments/AllocationChart';
import { AssetList } from './investments/AssetList';
import { AssetFormModal } from './investments/modals/AssetFormModal';
import { SellAssetModal } from './investments/modals/SellAssetModal';
import { DividendModal } from './investments/modals/DividendModal';
import { HistoryModal } from './investments/modals/HistoryModal';
import { IRReportModal } from './investments/modals/IRReportModal';
import { prepareAssetsForExport } from '../services/exportUtils';
import { exportToCSV } from '../services/exportUtils';
import { printAssetsReport } from '../services/printUtils';
import { useToast } from './ui/Toast';
import { ConfirmModal } from './ui/ConfirmModal';

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

    // Data States
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const { addToast } = useToast();

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

    // --- HANDLERS ---

    const handleExport = () => {
        const data = prepareAssetsForExport(filteredAssets);
        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Carteira_Investimentos');
    };

    const handlePrint = () => {
        printAssetsReport(filteredAssets);
    };

    // 1. COMPRA / NOVO APORTE (BUY)
    const handleSaveAsset = async (data: any, isCreatingAccount: boolean, newAccountName: string) => {
        // Handle New Brokerage Creation
        let brokerageId = data.accountId as string;
        if (isCreatingAccount) {
            if (!newAccountName.trim()) {
                addToast('Por favor, informe o nome da nova corretora.', 'error');
                return;
            }
            const newAccount = { name: newAccountName, type: AccountType.INVESTMENT, balance: 0, initialBalance: 0, currency: 'BRL', color: 'slate' };
            const tempId = crypto.randomUUID();
            await (onAddAccount as any)({ ...newAccount, id: tempId });
            brokerageId = tempId;
        }

        // Data extraction
        const ticker = (data.ticker as string).trim().toUpperCase();
        const inputQuantity = parseFloat(data.quantity as string);
        const inputPrice = parseFloat(data.averagePrice as string); // In "Add New", Avg Price field acts as Purchase Price
        const currentPrice = parseFloat(data.currentPrice as string);
        const currency = data.currency as string;
        const type = data.type as AssetType;
        const name = data.name as string;
        const date = new Date().toISOString();
        const sourceAccountId = data.sourceAccountId as string; // Money source

        // Validation
        if (!sourceAccountId && !editingAsset) {
            addToast("Selecione a conta de origem do dinheiro.", 'error');
            return;
        }

        const totalValue = inputQuantity * inputPrice;

        // Check for Existing Asset (Merge Logic)
        const existingAsset = assets.find(a => a.ticker === ticker && a.accountId === brokerageId);

        if (existingAsset && !editingAsset) {
            // === MERGE SCENARIO (Buy more of existing) ===
            setConfirmModal({
                isOpen: true,
                title: 'Ativo Existente',
                message: `Você já possui ${existingAsset.ticker} nesta corretora.\n\nDeseja adicionar essa quantidade à sua posição atual e recalcular o preço médio?`,
                onConfirm: () => {
                    // Exchange Rate Logic
                    const sourceAccount = accounts.find(a => a.id === sourceAccountId);
                    let exchangeRate = 1;
                    if (sourceAccount && sourceAccount.currency !== currency) {
                        // Simplified: Assume 1:1 and warn user
                        addToast(`Moedas diferentes (${sourceAccount.currency} -> ${currency}). Taxa de câmbio definida como 1:1. Edite a transação se necessário.`, 'warning');
                    }

                    // Calculate Weighted Average Price
                    const oldTotalVal = existingAsset.quantity * existingAsset.averagePrice;
                    const newPurchaseVal = totalValue;
                    const newQuantity = existingAsset.quantity + inputQuantity;
                    const newAveragePrice = (oldTotalVal + newPurchaseVal) / newQuantity;

                    // Update Asset
                    onUpdateAsset({
                        ...existingAsset,
                        quantity: newQuantity,
                        averagePrice: newAveragePrice,
                        currentPrice: currentPrice, // Update current market price
                        lastUpdate: date,
                        tradeHistory: [
                            ...(existingAsset.tradeHistory || []),
                            {
                                id: crypto.randomUUID(),
                                date: date.split('T')[0],
                                type: 'BUY',
                                quantity: inputQuantity,
                                price: inputPrice,
                                total: newPurchaseVal,
                                currency: currency
                            }
                        ]
                    });

                    // Create Expense Transaction
                    onAddTransaction({
                        amount: totalValue * exchangeRate,
                        description: `Compra ${ticker} (${inputQuantity} un) - Via Aporte`,
                        date: date.split('T')[0],
                        type: TransactionType.EXPENSE,
                        category: Category.INVESTMENT,
                        accountId: sourceAccountId,
                        isRecurring: false,
                        exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined
                    });

                    addToast(`${ticker} atualizado! Novo Preço Médio: ${formatCurrency(newAveragePrice, currency)}`, 'success');
                    setIsAssetModalOpen(false);
                    setEditingAsset(null);
                }
            });
        } else {
            // === NEW ASSET or EDIT SCENARIO ===
            const assetData = {
                ticker,
                name,
                type,
                quantity: inputQuantity,
                averagePrice: inputPrice,
                currentPrice: currentPrice,
                currency,
                accountId: brokerageId,
                lastUpdate: date
            };

            if (editingAsset) {
                onUpdateAsset({ ...assetData, id: editingAsset.id, tradeHistory: editingAsset.tradeHistory } as Asset);
            } else {
                // Exchange Rate Logic for New Asset
                const sourceAccount = accounts.find(a => a.id === sourceAccountId);
                let exchangeRate = 1;
                if (sourceAccount && sourceAccount.currency !== currency) {
                    addToast(`Moedas diferentes (${sourceAccount.currency} -> ${currency}). Taxa de câmbio definida como 1:1. Edite a transação se necessário.`, 'warning');
                }

                // New Asset - Initial Purchase Record
                const initialTrade = {
                    id: crypto.randomUUID(),
                    date: date.split('T')[0],
                    type: 'BUY' as const,
                    quantity: inputQuantity,
                    price: inputPrice,
                    total: inputQuantity * inputPrice,
                    currency: currency
                };

                onAddAsset({
                    ...assetData,
                    tradeHistory: [initialTrade]
                });

                // Create Expense Transaction for initial purchase
                onAddTransaction({
                    amount: (inputQuantity * inputPrice) * exchangeRate,
                    description: `Compra Inicial ${ticker} (${inputQuantity} un)`,
                    date: date.split('T')[0],
                    type: TransactionType.EXPENSE,
                    category: Category.INVESTMENT,
                    accountId: sourceAccountId,
                    isRecurring: false,
                    exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined
                });
            }
        }
        setIsAssetModalOpen(false);
        setEditingAsset(null);
    }

    // 2. VENDA (SELL)
    const handleSellAsset = (assetId: string, quantity: number, price: number, date: string, destAccountId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        if (quantity > asset.quantity) {
            addToast('Quantidade insuficiente para venda.', 'error');
            return;
        }

        const totalValue = quantity * price;
        const destAccount = accounts.find(a => a.id === destAccountId);
        let exchangeRate = 1;

        if (destAccount && destAccount.currency !== asset.currency) {
            addToast(`Moedas diferentes. Taxa de câmbio definida como 1:1.`, 'warning');
        }

        // 1. Transaction (Income)
        onAddTransaction({
            amount: totalValue * exchangeRate,
            description: `Venda ${asset.ticker} (${quantity} un)`,
            date: date,
            type: TransactionType.INCOME,
            category: Category.INVESTMENT,
            accountId: destAccountId, // Money goes here
            isRecurring: false,
            exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined
        });

        // 2. Update Asset (Sell doesn't change Avg Price, only reduces Qty)
        const profit = (price - asset.averagePrice) * quantity;

        onUpdateAsset({
            ...asset,
            quantity: asset.quantity - quantity,
            currentPrice: price,
            lastUpdate: new Date().toISOString(),
            tradeHistory: [
                ...(asset.tradeHistory || []),
                {
                    id: crypto.randomUUID(),
                    date,
                    type: 'SELL',
                    quantity,
                    price,
                    total: totalValue,
                    profit,
                    currency: asset.currency
                }
            ]
        });

        setIsSellModalOpen(false); setSelectedAsset(null);
    };

    // 3. PROVENTOS (DIVIDENDS)
    const handleRecordDividend = (assetId: string, amount: number, date: string, destAccountId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        // Transaction (Income)
        onAddTransaction({
            amount: amount,
            description: `Dividendos - ${asset.ticker}`,
            date: date,
            type: TransactionType.INCOME,
            category: Category.INVESTMENT,
            accountId: destAccountId, // Money goes here
            isRecurring: false
        });

        setIsDividendModalOpen(false); setSelectedAsset(null);
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
                {/* Placeholder for future chart or info */}
                <div className="hidden lg:block bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm">
                    Mais gráficos em breve...
                </div>
            </div>

            <AssetList
                assets={filteredAssets}
                onEdit={(asset) => { setEditingAsset(asset); setIsAssetModalOpen(true); }}
                onHistory={(asset) => { setSelectedAsset(asset); setIsHistoryModalOpen(true); }}
                onDelete={onDeleteAsset}
                onSell={(asset) => { setSelectedAsset(asset); setIsSellModalOpen(true); }}
                onBuy={(asset) => { setEditingAsset(null); setSelectedAsset(asset); setIsAssetModalOpen(true); }} // Pre-fill logic could be added
                showValues={showValues}
            />

            {/* MODALS */}
            <AssetFormModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={handleSaveAsset}
                editingAsset={editingAsset}
                accounts={accounts}
            />

            <SellAssetModal
                isOpen={isSellModalOpen}
                onClose={() => setIsSellModalOpen(false)}
                onSell={handleSellAsset}
                selectedAsset={selectedAsset}
                accounts={accounts}
            />

            <DividendModal
                isOpen={isDividendModalOpen}
                onClose={() => setIsDividendModalOpen(false)}
                onSave={handleRecordDividend}
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

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
};