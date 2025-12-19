import { useState } from 'react';
import { Account, Asset, Transaction, AssetType, TransactionType, Category, AccountType } from '../types';
import { useToast } from '../components/ui/Toast';
import { formatCurrency } from '../utils';

interface UseInvestmentActionsProps {
    accounts: Account[];
    assets: Asset[];
    onAddAsset: (asset: Omit<Asset, 'id'>) => void;
    onUpdateAsset: (asset: Asset) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    onAddAccount: (account: Omit<Account, 'id'>) => Promise<void>;
}

export const useInvestmentActions = ({
    accounts,
    assets,
    onAddAsset,
    onUpdateAsset,
    onAddTransaction,
    onAddAccount
}: UseInvestmentActionsProps) => {
    const { addToast } = useToast();

    // Confirm Modal State specific to actions (e.g. merging assets)
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // 1. COMPRA / NOVO APORTE (BUY)
    const handleSaveAsset = async (
        data: import('../types').Asset,
        isCreatingAccount: boolean,
        newAccountName: string,
        editingAsset: Asset | null,
        onSuccess: () => void
    ) => {
        // Handle New Brokerage Creation
        let brokerageId = data.accountId as string;
        if (isCreatingAccount) {
            if (!newAccountName.trim()) {
                addToast('Por favor, informe o nome da nova corretora.', 'error');
                return;
            }
            const newAccount = { name: newAccountName, type: AccountType.INVESTMENT, balance: 0, initialBalance: 0, currency: 'BRL' };
            const tempId = crypto.randomUUID();
            await onAddAccount({ ...newAccount });
            brokerageId = tempId;
        }

        // Data extraction
        const ticker = String(data.ticker || '').trim().toUpperCase();
        const inputQuantity = typeof data.quantity === 'number' ? data.quantity : parseFloat(String(data.quantity));
        const inputPrice = typeof data.averagePrice === 'number' ? data.averagePrice : parseFloat(String(data.averagePrice)); // In "Add New", Avg Price field acts as Purchase Price
        const currentPrice = typeof data.currentPrice === 'number' ? data.currentPrice : parseFloat(String(data.currentPrice));
        const currency = String(data.currency || 'BRL');
        const type = data.type;
        const name = String(data.name || '');
        const date = new Date().toISOString();
        const sourceAccountId = (data as unknown as Record<string, unknown>).sourceAccountId as string; // Money source

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
                        exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined,
                        currency: currency,
                        domain: 'PERSONAL'
                    });

                    addToast(`${ticker} atualizado! Novo Preço Médio: ${formatCurrency(newAveragePrice, currency)}`, 'success');
                    onSuccess();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
                    exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined,
                    currency: currency,
                    domain: 'PERSONAL'
                });
            }
            onSuccess();
        }
    };

    // 2. VENDA (SELL)
    const handleSellAsset = (
        assetId: string,
        quantity: number,
        price: number,
        date: string,
        destAccountId: string,
        onSuccess: () => void
    ) => {
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
            exchangeRate: exchangeRate !== 1 ? exchangeRate : undefined,
            currency: asset.currency,
            domain: 'PERSONAL'
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

        onSuccess();
    };

    // 3. PROVENTOS (DIVIDENDS)
    const handleRecordDividend = (
        assetId: string,
        amount: number,
        date: string,
        destAccountId: string,
        onSuccess: () => void
    ) => {
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
            isRecurring: false,
            currency: asset.currency,
            domain: 'PERSONAL'
        });

        onSuccess();
    };

    // 4. EVENTOS CORPORATIVOS
    const handleCorporateAction = (
        type: 'SPLIT' | 'INPLIT' | 'BONUS',
        factor: number,
        cost: number = 0,
        selectedAsset: Asset | null,
        onSuccess: () => void
    ) => {
        if (!selectedAsset) return;

        let newQty = selectedAsset.quantity;
        let newAvgPrice = selectedAsset.averagePrice;
        const oldTotal = selectedAsset.quantity * selectedAsset.averagePrice;

        if (type === 'SPLIT') {
            newQty = selectedAsset.quantity * factor;
            newAvgPrice = selectedAsset.averagePrice / factor;
        } else if (type === 'INPLIT') {
            newQty = selectedAsset.quantity / factor;
            newAvgPrice = selectedAsset.averagePrice * factor;
        } else if (type === 'BONUS') {
            const bonusQty = selectedAsset.quantity * (factor / 100);
            newQty = selectedAsset.quantity + bonusQty;
            newAvgPrice = (oldTotal + cost) / newQty;
        }

        onUpdateAsset({
            ...selectedAsset,
            quantity: newQty,
            averagePrice: newAvgPrice,
            lastUpdate: new Date().toISOString(),
            tradeHistory: [
                ...(selectedAsset.tradeHistory || []),
                {
                    id: crypto.randomUUID(),
                    // FIX: Format date locally to avoid timezone issues
                    date: (() => {
                        const now = new Date();
                        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    })(),
                    type: 'BUY',
                    quantity: newQty - selectedAsset.quantity,
                    price: 0,
                    total: cost,
                    currency: selectedAsset.currency,
                }
            ]
        });

        addToast(`Evento ${type} registrado com sucesso!`, 'success');
        onSuccess();
    };

    return {
        confirmModal,
        setConfirmModal,
        handleSaveAsset,
        handleSellAsset,
        handleRecordDividend,
        handleCorporateAction
    };
};
