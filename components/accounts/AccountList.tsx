import React from 'react';
import { Account, AccountType, Transaction } from '../../types';
import { AccountCard, AddAccountCard } from './AccountCard';
import { Globe, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface AccountListProps {
    activeTab: 'BANKING' | 'CARDS' | 'INTERNATIONAL';
    accounts: Account[];
    transactions: Transaction[];
    currentDate?: Date;
    showValues: boolean;
    onAccountClick: (account: Account) => void;
    onAddClick: () => void;
    isFormOpen: boolean;
}

export const AccountList: React.FC<AccountListProps> = ({ activeTab, accounts, transactions, currentDate, showValues, onAccountClick, onAddClick, isFormOpen }) => {

    // Filter logic extracted from parent
    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency === 'BRL');
    const creditCards = accounts.filter(a => a.type === AccountType.CREDIT_CARD);
    const internationalAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency !== 'BRL');

    const renderGrid = (items: Account[], type: 'BANKING' | 'CARDS' | 'INTERNATIONAL') => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.length === 0 && !isFormOpen && type === 'INTERNATIONAL' && (
                    <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                        <Globe className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p>Nenhuma conta internacional (Nomad, Wise, etc.) cadastrada.</p>
                        <Button variant="ghost" onClick={onAddClick} className="mt-2">Criar Conta Global</Button>
                    </div>
                )}

                {items.map(account => (
                    <AccountCard
                        key={account.id}
                        account={account}
                        transactions={transactions}
                        currentDate={currentDate}
                        showValues={showValues}
                        onClick={onAccountClick}
                    />
                ))}

                {/* The "Add New" button logic */}
                {(type === 'BANKING' || type === 'CARDS' || type === 'INTERNATIONAL') && (
                    <AddAccountCard
                        onClick={onAddClick}
                        label={type === 'CARDS' ? "Adicionar Cartão" : type === 'INTERNATIONAL' ? "Adicionar Conta Global" : "Adicionar Conta"}
                        variant={type === 'INTERNATIONAL' ? 'blue' : 'emerald'}
                    />
                )}
            </div>
        );
    };

    if (activeTab === 'BANKING') return renderGrid(bankingAccounts, 'BANKING');
    if (activeTab === 'CARDS') return renderGrid(creditCards, 'CARDS');
    if (activeTab === 'INTERNATIONAL') return renderGrid(internationalAccounts, 'INTERNATIONAL');

    return null;
};
