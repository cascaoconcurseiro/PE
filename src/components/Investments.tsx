import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType, TransactionType, Category } from '../types';
import { convertToBRL } from '../services/currencyService';
import { formatCurrency } from '../utils';
import { prepareAssetsForExport, exportToCSV } from '../services/exportUtils';
import { printAssetsReport } from '../services/printUtils';

// Modular Components
import { InvestmentSummaryCards } from './investments/InvestmentSummaryCards';
import { InvestmentOperations } from './investments/InvestmentOperations';
import { InvestmentFilters } from './investments/InvestmentFilters';
import { AssetList } from './investments/AssetList';
import { AllocationChart } from './investments/AllocationChart';

// Modals
import { AssetFormModal } from './investments/modals/AssetFormModal';
import { SellAssetModal } from './investments/modals/SellAssetModal';
import { DividendModal } from './investments/modals/DividendModal';
import { HistoryModal } from './investments/modals/HistoryModal';
import { IRReportModal } from './investments/modals/IRReportModal';

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
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [isIRModalOpen, setIsIRModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);

    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [newAccountName, setNewAccountName] = useState('');

    const [filterType, setFilterType] = useState<AssetType | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

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

    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD);

    const handleExport = () => {
        const data = prepareAssetsForExport(filteredAssets);
        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Carteira_Investimentos');
    };

    const handlePrint = () => {
        printAssetsReport(filteredAssets);
    };

    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        let brokerageId = formData.get('accountId') as string;
        if (isCreatingAccount) {
            if (!newAccountName.trim()) { alert('Por favor, informe o nome da nova corretora.'); return; }
            const newAccount = { name: newAccountName, type: AccountType.INVESTMENT, balance: 0, initialBalance: 0, currency: 'BRL', color: 'slate' };
            const tempId = crypto.randomUUID();
            await (onAddAccount as any)({ ...newAccount, id: tempId });
            brokerageId = tempId;
        }

        const ticker = (formData.get('ticker') as string).trim().toUpperCase();
        const inputQuantity = parseFloat(formData.get('quantity') as string);
        const inputPrice = parseFloat(formData.get('averagePrice') as string);
        const currentPrice = parseFloat(formData.get('currentPrice') as string);
        const currency = formData.get('currency') as string;
        const type = formData.get('type') as AssetType;
        const name = formData.get('name') as string;
        const date = new Date().toISOString();
        const sourceAccountId = formData.get('sourceAccountId') as string;

        if (!sourceAccountId && !editingAsset) { alert("Selecione a conta de origem do dinheiro."); return; }
        if (isNaN(inputPrice)) { alert("Preço inválido."); return; }

        const totalValue = inputQuantity * inputPrice;
        const existingAsset = assets.find(a => a.ticker === ticker && a.accountId === brokerageId);

        if (existingAsset && !editingAsset) {
            if (!window.confirm(`Você já possui ${existingAsset.ticker} nesta corretora.\n\nDeseja adicionar essa quantidade à sua posição atual e recalcular o preço médio?`)) return;

            const sourceAccount = accounts.find(a => a.id === sourceAccountId);
            let exchangeRate = 1;
            if (sourceAccount && sourceAccount.currency !== currency) {
                const rateStr = prompt(`A conta de origem é ${sourceAccount.currency} e o ativo é ${currency}.\nQual a taxa de câmbio? (1 ${currency} = X ${sourceAccount.currency})`);
                if (rateStr) exchangeRate = parseFloat(rateStr.replace(',', '.')) || 1;
            }

            const oldTotalVal = existingAsset.quantity * existingAsset.averagePrice;
            const newPurchaseVal = totalValue;
            const newQuantity = existingAsset.quantity + inputQuantity;
            const newAveragePrice = (oldTotalVal + newPurchaseVal) / newQuantity;

            onUpdateAsset({
                ...existingAsset,
                quantity: newQuantity,
                averagePrice: newAveragePrice,
                currentPrice: currentPrice,
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

            alert(`${ticker} atualizado! Novo Preço Médio: ${formatCurrency(newAveragePrice, currency)}`);
        } else {
            const assetData = {
                ticker, name, type, quantity: inputQuantity, averagePrice: inputPrice, currentPrice, currency, accountId: brokerageId, lastUpdate: date
            };

            if (editingAsset) {
                onUpdateAsset({ ...assetData, id: editingAsset.id, tradeHistory: editingAsset.tradeHistory } as Asset);
            } else {
                const sourceAccount = accounts.find(a => a.id === sourceAccountId);
                let exchangeRate = 1;
                if (sourceAccount && sourceAccount.currency !== currency) {
                    const rateStr = prompt(`A conta de origem é ${sourceAccount.currency} e o ativo é ${currency}.\nQual a taxa de câmbio? (1 ${currency} = X ${sourceAccount.currency})`);
                    if (rateStr) exchangeRate = parseFloat(rateStr.replace(',', '.')) || 1;
                }

                const initialTrade = {
                    id: crypto.randomUUID(),
                    date: date.split('T')[0],
                    type: 'BUY' as const,
                    quantity: inputQuantity,
                    price: inputPrice,
                    total: inputQuantity * inputPrice,
                    currency: currency
                };

                onAddAsset({ ...assetData, tradeHistory: [initialTrade] });

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
        setIsCreatingAccount(false);
        setNewAccountName('');
    };

    const handleSellAsset = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        let asset = selectedAsset;
        if (!asset) {
            const assetId = formData.get('assetId') as string;
            asset = assets.find(a => a.id === assetId) || null;
        }
        if (!asset) return;

        const quantity = parseFloat(formData.get('quantity') as string);
        const price = parseFloat(formData.get('price') as string);
        const date = formData.get('date') as string;
        const destAccountId = formData.get('destAccountId') as string;

        if (quantity > asset.quantity) { alert('Quantidade insuficiente.'); return; }

        const totalValue = quantity * price;
        const destAccount = accounts.find(a => a.id === destAccountId);
        let exchangeRate = 1;

        if (destAccount && destAccount.currency !== asset.currency) {
            const rateStr = prompt(`O ativo é ${asset.currency} e a conta destino é ${destAccount.currency}.\nQual a taxa de câmbio?`);
            if (rateStr) exchangeRate = parseFloat(rateStr.replace(',', '.')) || 1;
        }

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

    const handleRecordDividend = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        let asset = selectedAsset;
        if (!asset) {
            const assetId = formData.get('assetId') as string;
            asset = assets.find(a => a.id === assetId) || null;
        }
        if (!asset) return;

        const amount = parseFloat(formData.get('amount') as string);
        const date = formData.get('date') as string;
        const type = formData.get('type') as string;
        const destAccountId = formData.get('destAccountId') as string;

        onAddTransaction({
            amount: amount,
            description: `${type} - ${asset.ticker}`,
            date: date,
            type: TransactionType.INCOME,
            category: Category.INVESTMENT,
            accountId: destAccountId,
            isRecurring: false
        });

        setIsDividendModalOpen(false); setSelectedAsset(null);
    };

    return (
        <div className="space-y-8 pb-24 animate-in fade-in duration-500">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <AssetList
                        assets={filteredAssets}
                        showValues={showValues}
                        onEdit={(asset) => { setEditingAsset(asset); setIsAssetModalOpen(true); }}
                        onHistory={(asset) => { setSelectedAsset(asset); setIsHistoryModalOpen(true); }}
                        onDelete={(id) => onDeleteAsset(id)}
                        onSell={(asset) => { setSelectedAsset(asset); setIsSellModalOpen(true); }}
                        onBuy={(asset) => { setEditingAsset(null); setSelectedAsset(asset); setIsAssetModalOpen(true); }}
                    />
                </div>

                <div className="xl:col-span-1 space-y-6">
                    <AllocationChart
                        data={allocationData}
                        currentTotal={currentTotal}
                        showValues={showValues}
                        assets={assets}
                    />
                </div>
            </div>

            <AssetFormModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={handleSaveAsset}
                editingAsset={editingAsset}
                accounts={accounts}
                bankingAccounts={bankingAccounts}
                isCreatingAccount={isCreatingAccount}
                setIsCreatingAccount={setIsCreatingAccount}
                newAccountName={newAccountName}
                setNewAccountName={setNewAccountName}
            />

            <SellAssetModal
                isOpen={isSellModalOpen}
                onClose={() => setIsSellModalOpen(false)}
                onSell={handleSellAsset}
                assets={assets}
                bankingAccounts={bankingAccounts}
                selectedAsset={selectedAsset}
            />

            <DividendModal
                isOpen={isDividendModalOpen}
                onClose={() => setIsDividendModalOpen(false)}
                onRecord={handleRecordDividend}
                assets={assets}
                bankingAccounts={bankingAccounts}
                selectedAsset={selectedAsset}
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
        </div>
    );
};