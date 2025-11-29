import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils';
import { convertToBRL, AVAILABLE_CURRENCIES } from '../services/currencyService';
import {
    TrendingUp, Wallet, PieChart as PieChartIcon, DollarSign, ArrowUpRight, ArrowDownRight,
    Plus, MoreHorizontal, Bitcoin, Building2, Landmark,
    Activity, Search, Trash2, Edit2, X, Download, Printer, Minus, Save, AlertCircle
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
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');

    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [isIRModalOpen, setIsIRModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
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

    // --- SMART ASSET HANDLING (AUTO AVERAGE PRICE) ---
    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        // 1. Handle Account Creation if needed
        let finalAccountId = formData.get('accountId') as string;
        if (isCreatingAccount) {
            if (!newAccountName.trim()) { alert('Por favor, informe o nome da nova corretora.'); return; }
            const newAccount = { name: newAccountName, type: AccountType.INVESTMENT, balance: 0, initialBalance: 0, currency: 'BRL', color: 'slate' };
            const tempId = crypto.randomUUID();
            await (onAddAccount as any)({ ...newAccount, id: tempId });
            finalAccountId = tempId;
        }

        // 2. Get Input Data
        const ticker = (formData.get('ticker') as string).trim().toUpperCase();
        const inputQuantity = parseFloat(formData.get('quantity') as string);
        const inputPrice = parseFloat(formData.get('averagePrice') as string); // In "Add New", Avg Price field acts as Purchase Price
        const currentPrice = parseFloat(formData.get('currentPrice') as string);
        const currency = formData.get('currency') as string;
        const type = formData.get('type') as AssetType;
        const name = formData.get('name') as string;
        const date = new Date().toISOString();

        // 3. Check if Asset Exists (Merge Logic)
        const existingAsset = assets.find(a => a.ticker === ticker && a.accountId === finalAccountId);

        if (existingAsset && !editingAsset) {
            // === MERGE SCENARIO (Buy more of existing) ===
            const confirmMerge = window.confirm(`Você já possui ${existingAsset.ticker} nesta corretora.\n\nDeseja adicionar essa quantidade à sua posição atual e recalcular o preço médio?`);
            
            if (!confirmMerge) return;

            // Calculate Weighted Average Price
            const oldTotalVal = existingAsset.quantity * existingAsset.averagePrice;
            const newPurchaseVal = inputQuantity * inputPrice;
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
                amount: newPurchaseVal,
                description: `Compra ${ticker} (${inputQuantity} un) - Via Aporte`,
                date: date.split('T')[0],
                type: TransactionType.EXPENSE,
                category: Category.INVESTMENT,
                accountId: finalAccountId,
                isRecurring: false
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
                accountId: finalAccountId,
                lastUpdate: date
            };

            if (editingAsset) {
                onUpdateAsset({ ...assetData, id: editingAsset.id, tradeHistory: editingAsset.tradeHistory } as Asset);
            } else {
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
                    amount: inputQuantity * inputPrice,
                    description: `Compra Inicial ${ticker} (${inputQuantity} un)`,
                    date: date.split('T')[0],
                    type: TransactionType.EXPENSE,
                    category: Category.INVESTMENT,
                    accountId: finalAccountId,
                    isRecurring: false
                });
            }
        }

        setIsAssetModalOpen(false); 
        setEditingAsset(null); 
        setIsCreatingAccount(false); 
        setNewAccountName('');
    };

    const handleBuyAsset = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        let asset = selectedAsset;
        if (!asset) { const assetId = formData.get('assetId') as string; asset = assets.find(a => a.id === assetId) || null; }
        if (!asset) return;
        const quantity = parseFloat(formData.get('quantity') as string);
        const price = parseFloat(formData.get('price') as string);
        const date = formData.get('date') as string;
        const accountId = formData.get('accountId') as string;
        const account = accounts.find(a => a.id === accountId);
        
        let totalValue = quantity * price;
        let exchangeRate = 1;
        
        if (account && account.currency !== asset.currency) {
            const rateStr = prompt(`Taxa de câmbio? (1 ${asset.currency} = X ${account.currency})`);
            if (rateStr) { exchangeRate = parseFloat(rateStr.replace(',', '.')); if (!isNaN(exchangeRate)) totalValue = totalValue * exchangeRate; }
        }
        
        onAddTransaction({ amount: totalValue, description: `Compra ${asset.ticker} (${quantity} un)`, date: date, type: TransactionType.EXPENSE, category: Category.INVESTMENT, accountId: accountId, isRecurring: false, isInstallment: false, exchangeRate: exchangeRate });
        
        // Calculate New Average Price
        const oldTotal = asset.quantity * asset.averagePrice;
        const newTotal = quantity * price;
        const newQuantity = asset.quantity + quantity;
        const newAveragePrice = (oldTotal + newTotal) / newQuantity;
        
        onUpdateAsset({ ...asset, quantity: newQuantity, averagePrice: newAveragePrice, currentPrice: price, tradeHistory: [...(asset.tradeHistory || []), { id: crypto.randomUUID(), date, type: 'BUY', quantity, price, total: quantity * price, currency: asset.currency }] });
        setIsBuyModalOpen(false); setSelectedAsset(null);
    };

    const handleSellAsset = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        let asset = selectedAsset;
        if (!asset) { const assetId = formData.get('assetId') as string; asset = assets.find(a => a.id === assetId) || null; }
        if (!asset) return;
        const quantity = parseFloat(formData.get('quantity') as string);
        const price = parseFloat(formData.get('price') as string);
        const date = formData.get('date') as string;
        const accountId = formData.get('accountId') as string;
        const account = accounts.find(a => a.id === accountId);
        if (quantity > asset.quantity) { alert('Quantidade insuficiente.'); return; }
        let totalValue = quantity * price;
        let exchangeRate = 1;
        if (account && account.currency !== asset.currency) {
            const rateStr = prompt(`Taxa de câmbio?`);
            if (rateStr) { exchangeRate = parseFloat(rateStr.replace(',', '.')); if (!isNaN(exchangeRate)) totalValue = totalValue * exchangeRate; }
        }
        onAddTransaction({ amount: totalValue, description: `Venda ${asset.ticker} (${quantity} un)`, date: date, type: TransactionType.INCOME, category: Category.INVESTMENT, accountId: accountId, isRecurring: false, isInstallment: false, exchangeRate: exchangeRate });
        
        // Sell does NOT change Average Price, only quantity
        const profit = (price - asset.averagePrice) * quantity;
        
        onUpdateAsset({ ...asset, quantity: asset.quantity - quantity, currentPrice: price, tradeHistory: [...(asset.tradeHistory || []), { id: crypto.randomUUID(), date, type: 'SELL', quantity, price, total: quantity * price, profit, currency: asset.currency }] });
        setIsSellModalOpen(false); setSelectedAsset(null);
    };

    const handleRecordDividend = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        let asset = selectedAsset;
        if (!asset) { const assetId = formData.get('assetId') as string; asset = assets.find(a => a.id === assetId) || null; }
        if (!asset) return;
        const amount = parseFloat(formData.get('amount') as string);
        const date = formData.get('date') as string;
        const type = formData.get('type') as string;
        const accountId = formData.get('accountId') as string;
        onAddTransaction({ amount: amount, description: `${type} - ${asset.ticker}`, date: date, type: TransactionType.INCOME, category: Category.INVESTMENT, accountId: accountId, isRecurring: false, isInstallment: false });
        setIsDividendModalOpen(false); setSelectedAsset(null);
    };

    const handleExport = () => {
        const data = prepareAssetsForExport(filteredAssets);
        exportToCSV(data, ['Ticker', 'Nome', 'Tipo', 'Qtd', 'Preço Médio', 'Preço Atual', 'Total Atual'], 'Carteira_Investimentos');
    };

    const handlePrint = () => {
        printAssetsReport(filteredAssets);
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Header Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg"><Wallet className="w-6 h-6 text-emerald-400" /></div>
                        <span className="text-slate-300 text-sm font-medium">Patrimônio Total (BRL)</span>
                    </div>
                    <div className="text-3xl font-black tracking-tight">{showValues ? formatCurrency(currentTotal) : 'R$ ••••••'}</div>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-indigo-50 rounded-lg"><TrendingUp className="w-6 h-6 text-indigo-600" /></div><span className="text-slate-500 text-sm font-medium">Total Investido (BRL)</span></div><div className="text-3xl font-black text-slate-900">{showValues ? formatCurrency(totalInvested) : 'R$ ••••••'}</div>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2"><div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>{profit >= 0 ? <ArrowUpRight className="w-6 h-6 text-emerald-600" /> : <ArrowDownRight className="w-6 h-6 text-red-600" />}</div><span className="text-slate-500 text-sm font-medium">Rentabilidade (BRL)</span></div><div className={`text-3xl font-black tracking-tight ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{showValues ? formatCurrency(profit) : '••••••'}<span className="text-sm font-bold ml-2 opacity-75 bg-slate-100 px-2 py-1 rounded-lg text-slate-600">({profitPercentage.toFixed(2)}%)</span></div>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Asset List (Expanded) */}
                <div className="xl:col-span-3 space-y-6">
                    
                    {/* Brokerages (More compact) */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Custódia / Corretoras</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                            {accounts.filter(a => a.type === AccountType.INVESTMENT).map(account => (
                                <div key={account.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-[200px] flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-700"><Landmark className="w-5 h-5" /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-700 text-sm truncate max-w-[120px]">{account.name}</h4>
                                        <p className="text-sm font-black text-slate-900">{showValues ? formatCurrency(account.balance, account.currency) : '••••••'}</p>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); setIsCreatingAccount(true); }} className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all min-w-[180px]">
                                <div className="p-2 bg-slate-50 rounded-lg"><Plus className="w-5 h-5" /></div>
                                <span className="text-sm font-bold">Nova Corretora</span>
                            </button>
                        </div>
                    </div>

                    {/* Assets Grid - Spaced Out */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Meus Ativos</h3>
                        
                        {/* Search Bar Below Summary */}
                        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4">
                            <div className="flex items-center gap-2 flex-1 w-full px-2"><Search className="w-5 h-5 text-slate-400" /><input type="text" placeholder="Buscar ativos (ex: PETR4, Bitcoin)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none text-base outline-none w-full placeholder:text-slate-400 py-1" /></div>
                            <div className="flex gap-2 w-full md:w-auto p-1 overflow-x-auto no-scrollbar">
                                <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="bg-slate-100 border-none text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-100 font-bold min-w-[120px]"><option value="ALL">Todos</option>{Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                                <div className="flex gap-1">
                                    <Button onClick={handleExport} variant="secondary" className="px-3 border-slate-200" title="Baixar CSV"><Download className="w-5 h-5" /></Button>
                                    <Button onClick={handlePrint} variant="secondary" className="px-3 border-slate-200" title="Imprimir Relatório"><Printer className="w-5 h-5" /></Button>
                                </div>
                                <div className="relative">
                                    <Button onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)} variant="secondary" className="bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2.5 h-full whitespace-nowrap"><MoreHorizontal className="w-5 h-5 md:mr-1" /><span className="hidden md:inline">Opções</span></Button>
                                    {isActionsMenuOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)}></div><div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"><button onClick={() => { setIsActionsMenuOpen(false); setIsIRModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 font-medium transition-colors"><Building2 className="w-4 h-4" /> Relatório IR</button><button onClick={() => { setIsActionsMenuOpen(false); setSelectedAsset(null); setIsDividendModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 font-medium transition-colors border-t border-slate-50"><DollarSign className="w-4 h-4" /> Registrar Proventos</button><button onClick={() => { setIsActionsMenuOpen(false); setSelectedAsset(null); setIsSellModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 font-medium transition-colors border-t border-slate-50"><Minus className="w-4 h-4" /> Registrar Venda</button></div></>)}
                                </div>
                                <Button onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-indigo-200 shadow-lg whitespace-nowrap"><Plus className="w-4 h-4 mr-2" /> Novo Ativo</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredAssets.length === 0 ? (
                                <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 text-slate-500">
                                    <p>Nenhum ativo encontrado.</p>
                                </div>
                            ) : (
                                filteredAssets.map(asset => {
                                    const assetTotal = asset.quantity * asset.currentPrice;
                                    const assetProfit = assetTotal - (asset.quantity * asset.averagePrice);
                                    const assetProfitPercent = (assetProfit / (asset.quantity * asset.averagePrice)) * 100;
                                    
                                    return (
                                        <div key={asset.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-slate-50 rounded-xl shrink-0 shadow-sm border border-slate-100">{getAssetIcon(asset.type)}</div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 text-lg">{asset.ticker}</h4>
                                                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold border border-slate-200 uppercase">{asset.type}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-medium truncate max-w-[180px]">{asset.name}</div>
                                                    </div>
                                                </div>
                                                
                                                {/* Hover Actions */}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingAsset(asset); setIsAssetModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => onDeleteAsset(asset.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quantidade</p>
                                                    <p className="font-bold text-slate-700 text-lg">{asset.quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Atual</p>
                                                     <p className="font-black text-slate-900 text-lg">{showValues ? formatCurrency(assetTotal, asset.currency) : '••••••'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Preço Médio</p>
                                                    <p className="font-medium text-slate-600">{showValues ? formatCurrency(asset.averagePrice, asset.currency) : '••••••'}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Preço Atual</p>
                                                     <p className="font-medium text-slate-600">{showValues ? formatCurrency(asset.currentPrice, asset.currency) : '••••••'}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                                 <div className={`text-sm font-bold ${assetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} flex items-center gap-1`}>
                                                    {assetProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                                    {assetProfitPercent.toFixed(2)}%
                                                 </div>
                                                 <div className="flex gap-2">
                                                     <button onClick={() => { setSelectedAsset(asset); setIsSellModalOpen(true); }} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Vender</button>
                                                     <button onClick={() => { setSelectedAsset(asset); setIsBuyModalOpen(true); }} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors">Comprar</button>
                                                 </div>
                                            </div>
                                        </div>
                                    ); 
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Allocation Chart Side Panel */}
                <div className="xl:col-span-1">
                    <Card className="sticky top-6 border border-slate-200 bg-white shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-indigo-600" />
                            Alocação da Carteira
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                        {allocationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 space-y-2">
                             {allocationData.sort((a,b) => b.value - a.value).map((item, idx) => (
                                 <div key={item.name} className="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                     <span className="flex items-center gap-2">
                                         <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                         <span className="text-slate-600 font-medium">{item.name}</span>
                                     </span>
                                     <span className="font-bold text-slate-900">{((item.value / currentTotal) * 100).toFixed(1)}%</span>
                                 </div>
                             ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* ... (Keep existing modals code mostly same, just ensure they use the new state) */}
            {isHistoryModalOpen && selectedAsset && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Histórico de Negociações - {selectedAsset.ticker}</h3><button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div><div className="space-y-4">{!selectedAsset.tradeHistory || selectedAsset.tradeHistory.length === 0 ? (<p className="text-center text-slate-500 py-8">Nenhuma negociação registrada.</p>) : (selectedAsset.tradeHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trade => (<div key={trade.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><div><div className={`text-xs font-bold uppercase ${trade.type === 'BUY' ? 'text-indigo-600' : 'text-red-600'}`}>{trade.type === 'BUY' ? 'Compra' : 'Venda'}</div><div className="text-sm text-slate-600">{new Date(trade.date).toLocaleDateString('pt-BR')}</div></div><div className="text-right"><div className="font-bold text-slate-900">{trade.quantity} un. x {formatCurrency(trade.price, trade.currency)}</div><div className="text-xs text-slate-500">Total: {formatCurrency(trade.total, trade.currency)}</div>{trade.profit && (<div className={`text-xs font-bold ${trade.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Lucro: {formatCurrency(trade.profit, trade.currency)}</div>)}</div></div>)))}</div></div></div>)}
            {/* ... (Other modals) */}
            {isAssetModalOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">{editingAsset ? 'Editar Ativo' : 'Novo Ativo'}</h3><button onClick={() => setIsAssetModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div>
            
            {/* SMART FORM ALERT */}
            {!editingAsset && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Se você inserir o código (Ticker) de um ativo que já possui, o sistema irá atualizar sua posição automaticamente calculando o novo preço médio.</span>
                </div>
            )}

            <form onSubmit={handleSaveAsset} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Ticker</label><input name="ticker" required defaultValue={editingAsset?.ticker} placeholder="Ex: PETR4" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900 uppercase" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label><select name="type" required defaultValue={editingAsset?.type || AssetType.STOCK} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">{Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}</select></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Nome da Empresa/Fundo</label><input name="name" required defaultValue={editingAsset?.name} placeholder="Ex: Petróleo Brasileiro S.A." className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Moeda</label><select name="currency" required defaultValue={editingAsset?.currency || 'BRL'} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">{AVAILABLE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}</select></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Qtd</label><input name="quantity" type="number" step="0.000001" required defaultValue={editingAsset?.quantity} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Preço Compra / Médio</label><input name="averagePrice" type="number" step="0.01" required defaultValue={editingAsset?.averagePrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Preço Atual</label><input name="currentPrice" type="number" step="0.01" required defaultValue={editingAsset?.currentPrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Corretora Custodiante</label><select name="accountId" required defaultValue={editingAsset?.accountId} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" onChange={(e) => setIsCreatingAccount(e.target.value === 'NEW')}><option value="">Selecione...</option>{accounts.filter(a => a.type === AccountType.INVESTMENT).map(a => (<option key={a.id} value={a.id}>{a.name} ({a.currency})</option>))}<option value="NEW" className="font-bold text-indigo-600">+ Nova Corretora</option></select></div>{isCreatingAccount && (<div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2"><label className="block text-xs font-bold text-indigo-700 mb-1">Nome da Nova Corretora</label><input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Ex: NuInvest, XP..." className="w-full px-4 py-3 rounded-xl bg-white border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div>)}<Button type="submit" className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg"><Save className="w-5 h-5 mr-2" /> Salvar Ativo</Button></form></div></div>)}
            {isBuyModalOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Registrar Compra</h3><button onClick={() => setIsBuyModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div><form onSubmit={handleBuyAsset} className="space-y-4">{!selectedAsset && (<div><label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label><select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"><option value="">Selecione o ativo...</option>{assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}</select></div>)}{selectedAsset && (<div className="p-4 bg-slate-50 rounded-xl mb-4"><div className="font-bold text-slate-900">{selectedAsset.ticker}</div><div className="text-sm text-slate-500">{selectedAsset.name}</div></div>)}<div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Quantidade</label><input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Preço Unitário ({selectedAsset?.currency || 'BRL'})</label><input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Data</label><input name="date" type="date" onClick={(e) => e.currentTarget.showPicker()} required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Conta de Origem (Pagamento)</label>{accounts.length > 0 ? (<select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>) : (<div className="p-3 bg-red-50 rounded-xl text-red-700 text-sm border border-red-100">Você precisa de uma conta cadastrada para realizar compras.</div>)}</div><Button type="submit" className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg" disabled={accounts.length === 0}><Plus className="w-5 h-5 mr-2" /> Confirmar Compra</Button></form></div></div>)}
            {isSellModalOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Registrar Venda</h3><button onClick={() => setIsSellModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div><form onSubmit={handleSellAsset} className="space-y-4">{!selectedAsset && (<div><label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label><select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"><option value="">Selecione o ativo...</option>{assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}</select></div>)}{selectedAsset && (<div className="p-4 bg-slate-50 rounded-xl mb-4"><div className="font-bold text-slate-900">{selectedAsset.ticker}</div><div className="text-sm text-slate-500">{selectedAsset.name}</div></div>)}<div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Quantidade</label><input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Preço Unitário ({selectedAsset?.currency || 'BRL'})</label><input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Data</label><input name="date" type="date" onClick={(e) => e.currentTarget.showPicker()} required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Conta de Destino (Recebimento)</label>{accounts.length > 0 ? (<select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>) : (<div className="p-3 bg-red-50 rounded-xl text-red-700 text-sm border border-red-100">Você precisa de uma conta cadastrada para realizar vendas.</div>)}</div><Button type="submit" className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white shadow-red-200 shadow-lg" disabled={accounts.length === 0}><Minus className="w-5 h-5 mr-2" /> Confirmar Venda</Button></form></div></div>)}
            {isDividendModalOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Registrar Proventos</h3><button onClick={() => setIsDividendModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div><form onSubmit={handleRecordDividend} className="space-y-4">{!selectedAsset && (<div><label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label><select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"><option value="">Selecione o ativo...</option>{assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}</select></div>)}{selectedAsset && (<div className="p-4 bg-slate-50 rounded-xl mb-4"><div className="font-bold text-slate-900">{selectedAsset.ticker}</div><div className="text-sm text-slate-500">{selectedAsset.name}</div></div>)}<div><label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label><select name="type" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"><option value="Dividendos">Dividendos</option><option value="JCP">JCP</option><option value="Rendimentos">Rendimentos</option></select></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Valor Total</label><input name="amount" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Data de Recebimento</label><input name="date" type="date" onClick={(e) => e.currentTarget.showPicker()} required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Conta de Destino</label>{accounts.length > 0 ? (<select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>) : (<div className="p-3 bg-red-50 rounded-xl text-red-700 text-sm border border-red-100">Você precisa de uma conta cadastrada para receber proventos.</div>)}</div><Button type="submit" className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-lg" disabled={accounts.length === 0}><DollarSign className="w-5 h-5 mr-2" /> Confirmar Recebimento</Button></form></div></div>)}
            {isIRModalOpen && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Relatório para Imposto de Renda</h3><button onClick={() => setIsIRModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div><div className="space-y-4"><div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl text-sm border border-yellow-100"><strong>Atenção:</strong> Este relatório é apenas informativo. Confira sempre os informes oficiais das corretoras e escrituradores.</div><div className="space-y-6">{Object.values(AssetType).map(type => { const typeAssets = assets.filter(a => a.type === type); if (typeAssets.length === 0) return null; return (<div key={type}><h4 className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">{type}</h4><div className="space-y-2">{typeAssets.map(asset => (<div key={asset.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded-lg"><div><div className="font-bold">{asset.ticker} - {asset.name}</div><div className="text-slate-500 text-xs">CNPJ: (Verificar Informe)</div></div><div className="text-right"><div className="font-mono">{asset.quantity} un. a {formatCurrency(asset.averagePrice, asset.currency)}</div><div className="font-bold text-slate-900">Total: {formatCurrency(asset.quantity * asset.averagePrice, asset.currency)}</div></div></div>))}</div></div>); })}</div></div><div className="mt-6 pt-4 border-t border-slate-100 flex justify-end"><Button onClick={() => window.print()} variant="secondary">Imprimir / Salvar PDF</Button></div></div></div>)}
        </div>
    );
};