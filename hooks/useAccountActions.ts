import { useState } from 'react';
import { Account, Transaction, TransactionType, Category } from '../types';
import { ActionType } from '../components/accounts/ActionModal';
import { useToast } from '../components/ui/Toast';

interface UseAccountActionsProps {
    selectedAccount: Account | null;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    currentDate?: Date;
}

export const useAccountActions = ({ selectedAccount, onAddTransaction, currentDate }: UseAccountActionsProps) => {
    const { addToast } = useToast();
    const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: ActionType, amount?: string }>({ isOpen: false, type: 'PAY_INVOICE' });

    const openActionModal = (type: ActionType, amount?: string) => {
        setActionModal({ isOpen: true, type, amount });
    };

    const closeActionModal = () => {
        setActionModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleActionSubmit = (amount: number, description: string, sourceId: string) => {
        if (!selectedAccount) return;

        // Validation: Account must have ID
        if (!selectedAccount.id || selectedAccount.id.trim() === '') {
            addToast('Erro: Conta não identificada', 'error');
            return;
        }

        const date = new Date().toISOString();
        const commonProps = { amount, date, accountId: selectedAccount.id, isRecurring: false };

        switch (actionModal.type) {
            case 'DEPOSIT':
                // Validation: Destination required (which is current account)
                if (!commonProps.accountId) {
                    addToast('Erro: Conta de destino obrigatória', 'error');
                    return;
                }
                onAddTransaction({ ...commonProps, description: description || 'Depósito', type: TransactionType.INCOME, category: Category.INCOME });
                addToast('Depósito realizado!', 'success');
                break;
            case 'WITHDRAW':
                // Validation: Source required
                if (!commonProps.accountId) {
                    addToast('Erro: Conta de origem obrigatória', 'error');
                    return;
                }
                if (sourceId) {
                    // Validation: Destination (sourceId) required for transfer
                    if (!sourceId || sourceId.trim() === '') {
                        addToast('Erro: Conta de destino obrigatória', 'error');
                        return;
                    }
                    onAddTransaction({ ...commonProps, description: description || 'Saque para Carteira', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
                } else {
                    onAddTransaction({ ...commonProps, description: description || 'Saque em Espécie', type: TransactionType.EXPENSE, category: Category.OTHER });
                }
                addToast('Saque registrado!', 'success');
                break;
            case 'TRANSFER':
                // Validation: Source and Destination
                if (!commonProps.accountId || !sourceId || sourceId.trim() === '') {
                    addToast('Erro: Contas de origem e destino obrigatórias', 'error');
                    return;
                }
                if (commonProps.accountId === sourceId) {
                    addToast('Erro: Origem e destino não podem ser iguais', 'error');
                    return;
                }
                onAddTransaction({ ...commonProps, description: description || 'Transferência', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
                addToast('Transferência realizada!', 'success');
                break;
            case 'PAY_INVOICE':
                // Validation: Source (sourceId) and Destination (selectedAccount)
                if (!sourceId || sourceId.trim() === '' || !selectedAccount.id) {
                    addToast('Erro: Contas de origem e destino obrigatórias para pagamento de fatura', 'error');
                    return;
                }
                if (sourceId === selectedAccount.id) {
                    addToast('Erro: Origem e destino não podem ser iguais', 'error');
                    return;
                }
                onAddTransaction({
                    amount,
                    description: `Pagamento Fatura - ${selectedAccount.name}`,
                    date,
                    type: TransactionType.TRANSFER,
                    category: Category.TRANSFER,
                    accountId: sourceId,
                    destinationAccountId: selectedAccount.id,
                    isRecurring: false
                });
                addToast('Pagamento de fatura registrado!', 'success');
                break;
        }
        closeActionModal();
    };

    return {
        actionModal,
        openActionModal,
        closeActionModal,
        handleActionSubmit
    };
};
