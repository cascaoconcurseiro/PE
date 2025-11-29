import React, { useState, useMemo } from 'react';
import { Account, Transaction, Asset, AssetType, AccountType, TransactionType, Category, TradeHistory } from '../types';
import { formatCurrency, parseDate } from '../utils';
import { convertToBRL, AVAILABLE_CURRENCIES } from '../services/currencyService';
import {
    TrendingUp, Wallet, PieChart as PieChartIcon, DollarSign, ArrowUpRight, ArrowDownRight,
    Plus, MoreHorizontal, RefreshCw, Bitcoin, Building2, Landmark,
    Briefcase, LineChart, Activity, Search, Filter, ChevronDown, Trash2, Edit2, X, Check, Save, Minus, History
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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
    transactions,
    assets,
    onAddAsset,
    onUpdateAsset,
    onDeleteAsset,
    onAddTransaction,
    onAddAccount,
    currentDate,
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

    // --- CALCULATIONS ---
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
            case AssetType.STOCK: return <Building2 className="w-5 h-5 text-indigo-600" />;
            case AssetType.REIT: return <Building2 className="w-5 h-5 text-emerald-600" />;
            case AssetType.CRYPTO: return <Bitcoin className="w-5 h-5 text-orange-500" />;
            case AssetType.TREASURY: return <Landmark className="w-5 h-5 text-yellow-600" />;
            case AssetType.ETF: return <PieChartIcon className="w-5 h-5 text-blue-500" />;
            default: return <Activity className="w-5 h-5 text-slate-500" />;
        }
    };

    // --- HANDLERS ---

    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        let finalAccountId = formData.get('accountId') as string;

        // Handle New Account Creation
        if (isCreatingAccount) {
            if (!newAccountName.trim()) {
                alert('Por favor, informe o nome da nova corretora.');
                return;
            }

            const newAccount = {
                name: newAccountName,
                type: AccountType.INVESTMENT,
                balance: 0,
                initialBalance: 0,
                currency: 'BRL',
                color: 'slate'
            };

            const tempId = crypto.randomUUID();
            await (onAddAccount as any)({ ...newAccount, id: tempId });
            finalAccountId = tempId;
        }

        const assetData = {
            ticker: formData.get('ticker') as string,
            name: formData.get('name') as string,
            type: formData.get('type') as AssetType,
            quantity: parseFloat(formData.get('quantity') as string),
            averagePrice: parseFloat(formData.get('averagePrice') as string),
            currentPrice: parseFloat(formData.get('currentPrice') as string),
            currency: formData.get('currency') as string,
            accountId: finalAccountId,
            lastUpdate: new Date().toISOString()
        };

        if (editingAsset) {
            onUpdateAsset({ ...assetData, id: editingAsset.id, tradeHistory: editingAsset.tradeHistory });
        } else {
            onAddAsset(assetData);
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
        if (!asset) {
            const assetId = formData.get('assetId') as string;
            asset = assets.find(a => a.id === assetId) || null;
        }

        if (!asset) return;

        const quantity = parseFloat(formData.get('quantity') as string);
        const price = parseFloat(formData.get('price') as string);
        const date = formData.get('date') as string;
        const accountId = formData.get('accountId') as string;
        const account = accounts.find(a => a.id === accountId);

        let totalValue = quantity * price;
        let exchangeRate = 1;

        // Multi-currency Logic
        if (account && account.currency !== asset.currency) {
            const rateStr = prompt(`A conta selecionada (${account.currency}) é diferente da moeda do ativo (${asset.currency}).\n\nQual a taxa de câmbio utilizada? (1 ${asset.currency} = X ${account.currency})`);
            if (rateStr) {
                exchangeRate = parseFloat(rateStr.replace(',', '.'));
                if (!isNaN(exchangeRate)) {
                    totalValue = totalValue * exchangeRate;
                }
            }
        }

        // 1. Create Transaction (Expense)
        onAddTransaction({
            amount: totalValue,
            description: `Compra ${asset.ticker} (${quantity} un)`,
            date: date,
            type: TransactionType.EXPENSE,
            category: Category.INVESTMENT,
            accountId: accountId,
            isRecurring: false,
            isInstallment: false,
            exchangeRate: exchangeRate
        });

        // 2. Update Asset (Weighted Average Price)
        const oldTotal = asset.quantity * asset.averagePrice;
        const newTotal = quantity * price; // In Asset Currency
        const newQuantity = asset.quantity + quantity;
        const newAveragePrice = (oldTotal + newTotal) / newQuantity;

        onUpdateAsset({
            ...asset,
            quantity: newQuantity,
            averagePrice: newAveragePrice,
            currentPrice: price,
            tradeHistory: [
                ...(asset.tradeHistory || []),
                {
                    id: crypto.randomUUID(),
                    date,
                    type: 'BUY',
                    quantity,
                    price,
                    total: quantity * price,
                    currency: asset.currency
                }
            ]
        });

        setIsBuyModalOpen(false);
        setSelectedAsset(null);
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
        const accountId = formData.get('accountId') as string;
        const account = accounts.find(a => a.id === accountId);

        if (quantity > asset.quantity) {
            alert('Quantidade insuficiente para venda.');
            return;
        }

        let totalValue = quantity * price;
        let exchangeRate = 1;

        // Multi-currency Logic
        if (account && account.currency !== asset.currency) {
            const rateStr = prompt(`A conta selecionada (${account.currency}) é diferente da moeda do ativo (${asset.currency}).\n\nQual a taxa de câmbio utilizada? (1 ${asset.currency} = X ${account.currency})`);
            if (rateStr) {
                exchangeRate = parseFloat(rateStr.replace(',', '.'));
                if (!isNaN(exchangeRate)) {
                    totalValue = totalValue * exchangeRate;
                }
            }
        }

        // 1. Create Transaction (Income)
        onAddTransaction({
            amount: totalValue,
            description: `Venda ${asset.ticker} (${quantity} un)`,
            date: date,
            type: TransactionType.INCOME,
            category: Category.INVESTMENT,
            accountId: accountId,
            isRecurring: false,
            isInstallment: false,
            exchangeRate: exchangeRate
        });

        // Calculate Profit
        const profit = (price - asset.averagePrice) * quantity;

        // 2. Update Asset
        onUpdateAsset({
            ...asset,
            quantity: asset.quantity - quantity,
            currentPrice: price,
            tradeHistory: [
                ...(asset.tradeHistory || []),
                {
                    id: crypto.randomUUID(),
                    date,
                    type: 'SELL',
                    quantity,
                    price,
                    total: quantity * price,
                    profit,
                    currency: asset.currency
                }
            ]
        });

        setIsSellModalOpen(false);
        setSelectedAsset(null);
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
        const accountId = formData.get('accountId') as string;

        onAddTransaction({
            amount: amount,
            description: `${type} - ${asset.ticker}`,
            date: date,
            type: TransactionType.INCOME,
            category: Category.INVESTMENT,
            accountId: accountId,
            isRecurring: false,
            isInstallment: false
        });

        setIsDividendModalOpen(false);
        setSelectedAsset(null);
    };

    return (
        <div className="space-y-6 pb-24">
            {/* --- HEADER: NET WORTH & SUMMARY --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-300 text-sm font-medium">Patrimônio Total (BRL)</span>
                    </div>
                    <div className="text-2xl font-bold">
                        {showValues ? formatCurrency(currentTotal) : 'R$ ••••••'}
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="text-slate-500 text-sm font-medium">Total Investido (BRL)</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                        {showValues ? formatCurrency(totalInvested) : 'R$ ••••••'}
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {profit >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                        </div>
                        <span className="text-slate-500 text-sm font-medium">Rentabilidade (BRL)</span>
                    </div>
                    <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {showValues ? formatCurrency(profit) : '••••••'}
                        <span className="text-sm font-normal ml-2 opacity-75">
                            ({profitPercentage.toFixed(2)}%)
                        </span>
                    </div>
                </Card>
            </div>

            {/* --- BROKERAGES SECTION --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {accounts.filter(a => a.type === AccountType.INVESTMENT).map(account => (
                    <Card key={account.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
                        <div className="text-xs text-slate-500 mb-1 truncate">{account.name}</div>
                        <div className="font-bold text-slate-900">
                            {showValues ? formatCurrency(account.balance, account.currency) : '••••••'}
                        </div>
                    </Card>
                ))}
            </div>

            {/* --- ASSET ALLOCATION & LIST --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Allocation Chart */}
                <Card className="lg:col-span-1 min-h-[300px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-indigo-600" />
                        Alocação
                    </h3>
                    <div className="flex-1 w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {allocationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Right Column: Asset List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-1 w-full sm:w-auto">
                            <Search className="w-4 h-4 text-slate-400 ml-2" />
                            <input
                                type="text"
                                placeholder="Buscar ativo..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value as any)}
                                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 font-bold"
                            >
                                <option value="ALL">Todos</option>
                                {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>

                            {/* ACTIONS DROPDOWN */}
                            <div className="relative">
                                <Button
                                    onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                                    variant="secondary"
                                    className="bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl px-3 py-2 text-sm font-bold h-full aspect-square sm:aspect-auto flex items-center justify-center"
                                >
                                    <MoreHorizontal className="w-5 h-5 sm:mr-1" />
                                    <span className="hidden sm:inline">Ações</span>
                                </Button>

                                {isActionsMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)}></div>
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            <button onClick={() => { setIsActionsMenuOpen(false); setIsIRModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 font-medium transition-colors">
                                                <Building2 className="w-4 h-4" /> Relatório IR
                                            </button>
                                            <button onClick={() => { setIsActionsMenuOpen(false); setSelectedAsset(null); setIsDividendModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 font-medium transition-colors border-t border-slate-50">
                                                <DollarSign className="w-4 h-4" /> Registrar Proventos
                                            </button>
                                            <button onClick={() => { setIsActionsMenuOpen(false); setSelectedAsset(null); setIsSellModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 font-medium transition-colors border-t border-slate-50">
                                                <Minus className="w-4 h-4" /> Registrar Venda
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <Button onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-indigo-200 shadow-lg whitespace-nowrap">
                                <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Novo Ativo</span><span className="sm:hidden">Novo</span>
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredAssets.map(asset => {
                            const assetTotal = asset.quantity * asset.currentPrice;
                            const assetProfit = assetTotal - (asset.quantity * asset.averagePrice);
                            const assetProfitPercent = (assetProfit / (asset.quantity * asset.averagePrice)) * 100;

                            return (
                                <Card key={asset.id} className="hover:shadow-md transition-all border border-slate-100">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 rounded-xl">
                                                {getAssetIcon(asset.type)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-900">{asset.ticker}</h4>
                                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">{asset.type}</span>
                                                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold">{asset.currency}</span>
                                                </div>
                                                <div className="text-sm text-slate-500">{asset.name}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-1 w-full sm:w-auto justify-between sm:justify-end gap-8">
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 font-medium">Quantidade</div>
                                                <div className="font-bold text-slate-900">{asset.quantity}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 font-medium">Preço Médio</div>
                                                <div className="font-bold text-slate-900">{showValues ? formatCurrency(asset.averagePrice, asset.currency) : '••••••'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 font-medium">Atual</div>
                                                <div className="font-bold text-slate-900">{showValues ? formatCurrency(asset.currentPrice, asset.currency) : '••••••'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 font-medium">Total</div>
                                                <div className="font-bold text-slate-900">{showValues ? formatCurrency(assetTotal, asset.currency) : '••••••'}</div>
                                                <div className={`text-xs font-bold ${assetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {assetProfit >= 0 ? '+' : ''}{assetProfitPercent.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAsset(asset); setIsHistoryModalOpen(true); }} className="text-slate-500 hover:text-indigo-600 hover:bg-slate-50">
                                            <History className="w-4 h-4 mr-1" /> Histórico
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAsset(asset); setIsDividendModalOpen(true); }} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                                            <DollarSign className="w-4 h-4 mr-1" /> Proventos
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAsset(asset); setIsBuyModalOpen(true); }} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                            <Plus className="w-4 h-4 mr-1" /> Comprar
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedAsset(asset); setIsSellModalOpen(true); }} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                            <Minus className="w-4 h-4 mr-1" /> Vender
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setEditingAsset(asset); setIsAssetModalOpen(true); }} className="text-slate-400 hover:text-slate-600">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => onDeleteAsset(asset.id)} className="text-slate-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* HISTORY MODAL */}
            {isHistoryModalOpen && selectedAsset && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Histórico de Negociações - {selectedAsset.ticker}</h3>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {!selectedAsset.tradeHistory || selectedAsset.tradeHistory.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Nenhuma negociação registrada.</p>
                            ) : (
                                selectedAsset.tradeHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trade => (
                                    <div key={trade.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <div className={`text-xs font-bold uppercase ${trade.type === 'BUY' ? 'text-indigo-600' : 'text-red-600'}`}>
                                                {trade.type === 'BUY' ? 'Compra' : 'Venda'}
                                            </div>
                                            <div className="text-sm text-slate-600">{new Date(trade.date).toLocaleDateString('pt-BR')}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-900">{trade.quantity} un. x {formatCurrency(trade.price, trade.currency)}</div>
                                            <div className="text-xs text-slate-500">Total: {formatCurrency(trade.total, trade.currency)}</div>
                                            {trade.profit && (
                                                <div className={`text-xs font-bold ${trade.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    Lucro: {formatCurrency(trade.profit, trade.currency)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ASSET MODAL */}
            {isAssetModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">{editingAsset ? 'Editar Ativo' : 'Novo Ativo'}</h3>
                            <button onClick={() => setIsAssetModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveAsset} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ticker</label>
                                    <input name="ticker" required defaultValue={editingAsset?.ticker} placeholder="Ex: PETR4" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                                    <select name="type" required defaultValue={editingAsset?.type || AssetType.STOCK} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                        {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Nome da Empresa/Fundo</label>
                                <input name="name" required defaultValue={editingAsset?.name} placeholder="Ex: Petróleo Brasileiro S.A." className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Moeda</label>
                                    <select name="currency" required defaultValue={editingAsset?.currency || 'BRL'} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                        {AVAILABLE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Qtd</label>
                                    <input name="quantity" type="number" step="0.000001" required defaultValue={editingAsset?.quantity} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Preço Médio</label>
                                    <input name="averagePrice" type="number" step="0.01" required defaultValue={editingAsset?.averagePrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Preço Atual</label>
                                    <input name="currentPrice" type="number" step="0.01" required defaultValue={editingAsset?.currentPrice} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Corretora Custodiante</label>
                                <select
                                    name="accountId"
                                    required
                                    defaultValue={editingAsset?.accountId}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"
                                    onChange={(e) => setIsCreatingAccount(e.target.value === 'NEW')}
                                >
                                    <option value="">Selecione...</option>
                                    {accounts.filter(a => a.type === AccountType.INVESTMENT).map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                                    ))}
                                    <option value="NEW" className="font-bold text-indigo-600">+ Nova Corretora</option>
                                </select>
                            </div>

                            {isCreatingAccount && (
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-indigo-700 mb-1">Nome da Nova Corretora</label>
                                    <input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        placeholder="Ex: NuInvest, XP..."
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900"
                                    />
                                </div>
                            )}

                            <Button type="submit" className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg">
                                <Save className="w-5 h-5 mr-2" /> Salvar Ativo
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* BUY MODAL */}
            {isBuyModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Registrar Compra</h3>
                            <button onClick={() => setIsBuyModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleBuyAsset} className="space-y-4">
                            {!selectedAsset && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label>
                                    <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                        <option value="">Selecione o ativo...</option>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {selectedAsset && (
                                <div className="p-4 bg-slate-50 rounded-xl mb-4">
                                    <div className="font-bold text-slate-900">{selectedAsset.ticker}</div>
                                    <div className="text-sm text-slate-500">{selectedAsset.name}</div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Quantidade</label>
                                    <input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Preço Unitário ({selectedAsset?.currency || 'BRL'})</label>
                                    <input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Data</label>
                                <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Conta de Origem (Pagamento)</label>
                                <select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                                </select>
                            </div>
                            <Button type="submit" className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-lg">
                                <Plus className="w-5 h-5 mr-2" /> Confirmar Compra
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* SELL MODAL */}
            {isSellModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Registrar Venda</h3>
                            <button onClick={() => setIsSellModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSellAsset} className="space-y-4">
                            {!selectedAsset && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label>
                                    <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                        <option value="">Selecione o ativo...</option>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {selectedAsset && (
                                <div className="p-4 bg-slate-50 rounded-xl mb-4">
                                    <div className="font-bold text-slate-900">{selectedAsset.ticker}</div>
                                    <div className="text-sm text-slate-500">{selectedAsset.name}</div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Quantidade</label>
                                    <input name="quantity" type="number" step="0.000001" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Preço Unitário ({selectedAsset?.currency || 'BRL'})</label>
                                    <input name="price" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Data</label>
                                <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Conta de Destino (Recebimento)</label>
                                <select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                                </select>
                            </div>
                            <Button type="submit" className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white shadow-red-200 shadow-lg">
                                <Minus className="w-5 h-5 mr-2" /> Confirmar Venda
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* DIVIDEND MODAL */}
            {isDividendModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Registrar Proventos</h3>
                            <button onClick={() => setIsDividendModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleRecordDividend} className="space-y-4">
                            {!selectedAsset && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ativo</label>
                                    <select name="assetId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                        <option value="">Selecione o ativo...</option>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.ticker} - {a.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {selectedAsset && (
                                <div className="p-4 bg-slate-50 rounded-xl mb-4">
                                    <div className="font-bold text-slate-900">{selectedAsset.ticker}</div>
                                    <div className="text-sm text-slate-500">{selectedAsset.name}</div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                                <select name="type" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                    <option value="Dividendos">Dividendos</option>
                                    <option value="JCP">JCP</option>
                                    <option value="Rendimentos">Rendimentos</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Valor Total</label>
                                <input name="amount" type="number" step="0.01" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Data de Recebimento</label>
                                <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Conta de Destino</label>
                                <select name="accountId" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-slate-900">
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <Button type="submit" className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-lg">
                                <DollarSign className="w-5 h-5 mr-2" /> Confirmar Recebimento
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* IR REPORT MODAL */}
            {isIRModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Relatório para Imposto de Renda</h3>
                            <button onClick={() => setIsIRModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl text-sm border border-yellow-100">
                                <strong>Atenção:</strong> Este relatório é apenas informativo. Confira sempre os informes oficiais das corretoras e escrituradores.
                            </div>

                            <div className="space-y-6">
                                {Object.values(AssetType).map(type => {
                                    const typeAssets = assets.filter(a => a.type === type);
                                    if (typeAssets.length === 0) return null;

                                    return (
                                        <div key={type}>
                                            <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">{type}</h4>
                                            <div className="space-y-2">
                                                {typeAssets.map(asset => (
                                                    <div key={asset.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded-lg">
                                                        <div>
                                                            <div className="font-bold">{asset.ticker} - {asset.name}</div>
                                                            <div className="text-slate-500 text-xs">CNPJ: (Verificar Informe)</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-mono">
                                                                {asset.quantity} un. a {formatCurrency(asset.averagePrice, asset.currency)}
                                                            </div>
                                                            <div className="font-bold text-slate-900">
                                                                Total: {formatCurrency(asset.quantity * asset.averagePrice, asset.currency)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => window.print()} variant="secondary">
                                Imprimir / Salvar PDF
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
