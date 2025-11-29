import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils';
import { convertToBRL, AVAILABLE_CURRENCIES } from '../services/currencyService';
import {
    TrendingUp, Wallet, PieChart as PieChartIcon, DollarSign, ArrowUpRight, ArrowDownRight,
    Plus, Bitcoin, Building2, Landmark,
    Activity, Search, Trash2, Edit2, X, Download, Printer, Minus, Save, AlertCircle, ArrowRightLeft, Filter, History, FileUp
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { exportToCSV, prepareAssetsForExport } from '../services/exportUtils';
import { printAssetsReport } from '../services/printUtils';

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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false); // Used for "Novo Aporte" (Buy/Add)
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [isIRModalOpen, setIsIRModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);

    // Data States
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [newAccountName, setNewAccountName] = useState('');
    
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

    // --- Utilities ---
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

    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD);

    // --- HANDLERS ---

    // Export Functions
    const handleExport = () => {
        const data = prepareAssetsForExport(filteredAssets);
        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Carteira_Investimentos');
    };

    const handlePrint = () => {
        printAssetsReport(filteredAssets);
    };

    // 1. COMPRA / NOVO APORTE (BUY)
    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        // Handle New Brokerage Creation
        let brokerageId = formData.get('accountId') as string;
        if (isCreatingAccount) {
            if (!newAccountName.trim()) { alert('Por favor, informe o nome da nova corretora.'); return; }
            const newAccount = { name: newAccountName, type: AccountType.INVESTMENT, balance: 0, initialBalance: 0, currency: 'BRL', color: 'slate' };
            const tempId = crypto.randomUUID();
            await (onAddAccount as any)({ ...newAccount, id: tempId });
            brokerageId = tempId;
        }

        // Data extraction
        const ticker = (formData.get('ticker') as string).trim().toUpperCase();
        const inputQuantity = parseFloat(formData.get('quantity') as string);
        const inputPrice = parseFloat(formData.get('price') as string); // In "Add New", Avg Price field acts as Purchase Price
        const currentPrice = parseFloat(formData.get('currentPrice') as string);
        const currency = formData.get('currency') as string;
        const type = formData.get('type') as AssetType;
        const name = formData.get('name') as string;
        const date = new Date().toISOString();
        const sourceAccountId = formData.get('sourceAccountId') as string; // Money source
        
        // Validation
        if (!sourceAccountId && !editingAsset) { alert("Selecione a conta de origem do dinheiro."); return; }

        const totalValue = inputQuantity * inputPrice;

        // Check for Existing Asset (Merge Logic)
        const existingAsset = assets.find(a => a.ticker === ticker && a.accountId === brokerageId);

        if (existingAsset && !editingAsset) {
            // === MERGE SCENARIO (Buy more of existing) ===
            const confirmMerge = window.confirm(`Você já possui ${existingAsset.ticker} nesta corretora.\n\nDeseja adicionar essa quantidade à sua posição atual e recalcular o preço médio?`);
            
            if (!confirmMerge) return;

            // Exchange Rate Logic
            const sourceAccount = accounts.find(a => a.id === sourceAccountId);
            let exchangeRate = 1;
            if (sourceAccount && sourceAccount.currency !== currency) {
                const rateStr = prompt(`A conta de origem é ${sourceAccount.currency} e o ativo é ${currency}.\nQual a taxa de câmbio? (1 ${currency} = X ${sourceAccount.currency})`);
                if (rateStr) exchangeRate = parseFloat(rateStr.replace(',', '.')) || 1;
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

            alert(`${ticker} atualizado! Novo Preço Médio: ${formatCurrency(newAveragePrice, currency)}`);
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
                    const rateStr = prompt(`A conta de origem é ${sourceAccount.currency} e o ativo é ${currency}.\nQual a taxa de câmbio? (1 ${currency} = X ${sourceAccount.currency})`);
                    if (rateStr) exchangeRate = parseFloat(rateStr.replace(',', '.')) || 1;
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
        setIsCreatingAccount(false); 
        setNewAccountName('');
    };

    // 2. VENDA (SELL)
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

        // Transaction (Income)
        onAddTransaction({
            amount: amount,
            description: `${type} - ${asset.ticker}`,
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
            {/* --- 1. SUMMARY CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-950 text-white border-none shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Wallet className="w-24 h-24 text-white" /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md"><Wallet className="w-5 h-5 text-emerald-400" /></div>
                            <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Patrimônio Total</span>
                        </div>
                        <div className="text-3xl font-black tracking-tight">{showValues ? formatCurrency(currentTotal) : 'R$ ••••••'}</div>
                    </div>
                </Card>
                
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Total Investido</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{showValues ? formatCurrency(totalInvested) : 'R$ ••••••'}</div>
                </Card>

                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                            {profit >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Rentabilidade</span>
                    </div>
                    <div className={`text-3xl font-black tracking-tight ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {showValues ? formatCurrency(profit) : '••••••'}
                        <span className="text-sm font-bold ml-2 opacity-80 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 inline-block align-middle">
                            {profitPercentage.toFixed(2)}%
                        </span>
                    </div>
                </Card>
            </div>

            {/* --- 2. OPERATIONS CENTER (THE "QUADRADO") --- */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Central de Operações
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Novo Aporte / Compra */}
                    <Button 
                        onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }}
                        variant="secondary"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 hover:shadow-md transition-all group"
                    >
                        <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 text-xs">Novo Aporte</span>
                    </Button>

                    {/* Registrar Venda */}
                    <Button 
                        onClick={() => { setSelectedAsset(null); setIsSellModalOpen(true); }}
                        variant="secondary"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-red-500 hover:ring-1 hover:ring-red-500 hover:shadow-md transition-all group"
                    >
                        <div className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <Minus className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-700 dark:group-hover:text-red-400 text-xs">Registrar Venda</span>
                    </Button>

                    {/* Proventos */}
                    <Button 
                        onClick={() => { setSelectedAsset(null); setIsDividendModalOpen(true); }}
                        variant="secondary"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 hover:shadow-md transition-all group"
                    >
                        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 text-xs">Proventos</span>
                    </Button>

                    {/* Relatório IR */}
                    <Button 
                        onClick={() => setIsIRModalOpen(true)}
                        variant="secondary"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:ring-1 hover:ring-slate-400 hover:shadow-md transition-all group"
                    >
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                            <FileUp className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-xs">Relatório IR</span>
                    </Button>
                </div>
            </div>

            {/* --- 3. SEARCH & FILTER BAR --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-center sticky top-4 z-20">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar ativos (ex: PETR4, Bitcoin)..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-slate-700 dark:text-white placeholder:text-slate-400" 
                    />
                </div>
                
                <div className="flex gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <select 
                            value={filterType} 
                            onChange={e => setFilterType(e.target.value as any)} 
                            className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-white appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todos os Tipos</option>
                            {(Object.values(AssetType) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    
                    <Button onClick={handleExport} variant="secondary" className="h-12 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" title="Baixar CSV">
                        <Download className="w-5 h-5" />
                    </Button>
                    <Button onClick={handlePrint} variant="secondary" className="h-12 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" title="Imprimir Relatório">
                        <Printer className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* --- 4. MAIN CONTENT GRID --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* ASSET LIST */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Meus Ativos
                    </h3>
                    
                    {filteredAssets.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">Nenhum ativo encontrado.</p>
                            <p className="text-sm mt-1">Use o botão "Novo Aporte" para começar.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredAssets.map(asset => {
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
                                                <button onClick={() => { setEditingAsset(asset); setIsAssetModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => { setSelectedAsset(asset); setIsHistoryModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Histórico"><History className="w-4 h-4" /></button>
                                                <button onClick={() => onDeleteAsset(asset.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
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
                                                 <button onClick={() => { setSelectedAsset(asset); setIsSellModalOpen(true); }} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Vender</button>
                                                 <button onClick={() => { setSelectedAsset(asset); setIsAssetModalOpen(true); }} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">Comprar</button>
                                             </div>
                                        </div>
                                    </div>
                                ); 
                            })}
                        </div>
                    )}
                </div>

                {/* ALLOCATION CHART */}
                <div className="xl:col-span-1 space-y-6">
                    <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Alocação da Carteira
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="h-64 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {allocationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => showValues ? formatCurrency(value) : 'R$ ****'} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">{showValues ? formatCurrency(currentTotal) : '••••'}</span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-3">
                                {allocationData.sort((a,b) => b.value - a.value).map((item, idx) => (
                                    <div key={item.name} className="flex justify-between text-xs items-center">
                                        <span className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                            <span className="text-slate-600 dark:text-slate-300 font-bold">{item.name}</span>
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{((item.value / currentTotal) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* ASSET MODAL (Buy/Add/Edit) */}
            {isAssetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{editingAsset ? 'Editar Ativo' : 'Novo Aporte'}</h3>
                            <button onClick={() => setIsAssetModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="overflow-y-auto p-6 custom-scrollbar">
                            {!editingAsset && (
                                <div className="mb-6 p-4 bg-indigo-50 text-indigo-800 text-xs rounded-xl border border-indigo-100 flex items-start gap-3 leading-relaxed">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
                                    <span>Se você inserir o código (Ticker) de um ativo que já possui na mesma corretora, o sistema irá <strong>somar a quantidade</strong> e recalcular o <strong>preço médio</strong> automaticamente.</span>
                                </div>
                            )}

                            <form onSubmit={handleSaveAsset} className="space-y-5">
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
                                            {bankingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>)}
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
                        </div>
                    </div>
                </div>
            )}

            {/* SELL MODAL */}
            {isSellModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Registrar Venda</h3>
                            <button onClick={() => setIsSellModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSellAsset} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ativo</label>
                                {selectedAsset ? (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{selectedAsset.ticker} - {selectedAsset.name}</div>
                                ) : (
                                    <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                                        <option value="">Selecione o ativo...</option>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade</label><input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Preço Venda</label><input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Destino do Dinheiro (Recebimento)</label>
                                <select name="destAccountId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                                    <option value="">Selecione a conta...</option>
                                    {bankingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>)}
                                </select>
                            </div>

                            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 dark:text-white" /></div>

                            <Button type="submit" className="w-full h-14 text-base bg-red-600 hover:bg-red-700 text-white shadow-red-200 shadow-lg rounded-xl mt-2">
                                <Minus className="w-5 h-5 mr-2" /> Confirmar Venda
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* DIVIDEND MODAL */}
            {isDividendModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Registrar Proventos</h3>
                            <button onClick={() => setIsDividendModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRecordDividend} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ativo</label>
                                <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                                    <option value="">Selecione o ativo...</option>
                                    {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                                    <select name="type" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white">
                                        <option value="Dividendos">Dividendos</option>
                                        <option value="JCP">JCP</option>
                                        <option value="Rendimentos">Rendimentos</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Valor Total</label>
                                    <input name="amount" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Receber em (Destino)</label>
                                <select name="destAccountId" required className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white transition-all">
                                    <option value="">Selecione a conta...</option>
                                    {bankingAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>)}
                                </select>
                            </div>

                            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white" /></div>

                            <Button type="submit" className="w-full h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-lg rounded-xl mt-2">
                                <DollarSign className="w-5 h-5 mr-2" /> Confirmar Recebimento
                            </Button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* HISTORY MODAL */}
             {isHistoryModalOpen && selectedAsset && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800 dark:text-white">Histórico de Negociações - {selectedAsset.ticker}</h3><button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button></div><div className="space-y-4">{!selectedAsset.tradeHistory || selectedAsset.tradeHistory.length === 0 ? (<p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhuma negociação registrada.</p>) : (selectedAsset.tradeHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trade => (<div key={trade.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700"><div><div className={`text-xs font-bold uppercase ${trade.type === 'BUY' ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>{trade.type === 'BUY' ? 'Compra' : 'Venda'}</div><div className="text-sm text-slate-600 dark:text-slate-300">{new Date(trade.date).toLocaleDateString('pt-BR')}</div></div><div className="text-right"><div className="font-bold text-slate-900 dark:text-white">{trade.quantity} un. x {formatCurrency(trade.price, trade.currency)}</div><div className="text-xs text-slate-500 dark:text-slate-400">Total: {formatCurrency(trade.total, trade.currency)}</div>{trade.profit && (<div className={`text-xs font-bold ${trade.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>Lucro: {formatCurrency(trade.profit, trade.currency)}</div>)}</div></div>)))}</div></div></div>)}

            {/* IR REPORT MODAL */}
            {isIRModalOpen && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800 dark:text-white">Relatório para Imposto de Renda</h3><button onClick={() => setIsIRModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button></div><div className="space-y-4"><div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm border border-yellow-100 dark:border-yellow-900/30"><strong>Atenção:</strong> Este relatório é apenas informativo. Confira sempre os informes oficiais das corretoras e escrituradores.</div><div className="space-y-6">{Object.values(AssetType).map(type => { const typeAssets = assets.filter(a => a.type === type); if (typeAssets.length === 0) return null; return (<div key={type}><h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">{type}</h4><div className="space-y-2">{typeAssets.map(asset => (<div key={asset.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"><div><div className="font-bold text-slate-900 dark:text-white">{asset.ticker} - {asset.name}</div><div className="text-slate-500 dark:text-slate-400 text-xs">CNPJ: (Verificar Informe)</div></div><div className="text-right"><div className="font-mono text-slate-700 dark:text-slate-300">{asset.quantity} un. a {formatCurrency(asset.averagePrice, asset.currency)}</div><div className="font-bold text-slate-900 dark:text-white">Total: {formatCurrency(asset.quantity * asset.averagePrice, asset.currency)}</div></div></div>))}</div></div>); })}</div></div><div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end"><Button onClick={() => window.print()} variant="secondary">Imprimir / Salvar PDF</Button></div></div></div>)}
        </div>
    );
};