import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Account, AccountType, Transaction, Category } from '../types';
import { Button } from './ui/Button';
import { ArrowLeft, Download, Printer, FileUp, Edit2, Trash2 } from 'lucide-react';
import { useToast } from './ui/Toast';
import { exportToCSV, prepareTransactionsForExport } from '../services/exportUtils';
import { printAccountStatement } from '../services/printUtils';
import { shouldShowTransaction } from '../utils/transactionFilters';

import { AccountForm } from './accounts/AccountForm';
import { ActionModal } from './accounts/ActionModal';
import { CreditCardDetail } from './accounts/CreditCardDetail';
import { BankingDetail } from './accounts/BankingDetail';
import { parseOFX, OFXTransaction } from '../services/ofxParser';
import { ImportModal } from './accounts/ImportModal';
import { InstallmentAnticipationModal } from '../features/transactions/InstallmentAnticipationModal';
import { CreditCardImportModal } from './accounts/CreditCardImportModal';

// New Refactored Components
import { AccountSummaryCards } from './accounts/AccountSummaryCards';
import { AccountList } from './accounts/AccountList';
import { useAccountActions } from '../hooks/useAccountActions';
import { ConfirmModal } from './ui/ConfirmModal';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    onAddAccount: (account: Omit<Account, 'id'>) => void;
    onUpdateAccount: (account: Account) => void;
    onDeleteAccount: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    onAddTransactions?: (transactions: Omit<Transaction, 'id'>[]) => void;
    showValues: boolean;
    currentDate?: Date;
    onAnticipate: (ids: string[], date: string, accountId: string) => void;
    initialAccountId?: string | null;
    onClearInitialAccount?: () => void;
    members?: import('../types').FamilyMember[];
    // Actually Account defines FamilyMember import usually.
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
}

export const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, members, onAddAccount, onUpdateAccount, onDeleteAccount, onDeleteTransaction, onAddTransaction, onAddTransactions, showValues, currentDate = new Date(), onAnticipate, initialAccountId, onClearInitialAccount }) => {
    const accountsProps = { accounts, transactions, members, onAddAccount, onUpdateAccount, onDeleteAccount, onDeleteTransaction, onAddTransaction, onAddTransactions, showValues, currentDate, onAnticipate, initialAccountId, onClearInitialAccount };
    const [viewState, setViewState] = useState<'LIST' | 'DETAIL'>('LIST');
    const [activeTab, setActiveTab] = useState<'BANKING' | 'CARDS' | 'INTERNATIONAL'>('BANKING');
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const { addToast } = useToast();

    // Handle Deep Linking
    useEffect(() => {
        if (typeof initialAccountId === 'string') { // Check specifically if it's a string (could be empty string but usually ID)
            const acc = accounts.find(a => a.id === initialAccountId);
            if (acc) {
                setSelectedAccount(acc);
                setViewState('DETAIL');

                // Clear the prop in parent so we don't get stuck stuck
                if (onClearInitialAccount) {
                    // We use a small timeout to ensure the render cycle completes? Not strictly needed with React state usually
                    // But safer to allow the transition to happen
                    // Actually, calling it immediately is fine as it schedules state update in parent.
                    onClearInitialAccount();
                }
            }
        }
    }, [initialAccountId, accounts]); // Removing onClearInitialAccount from deps to avoid loop if parent recreates it (useCallback recommended in parent)
    const { actionModal, openActionModal, closeActionModal, handleActionSubmit } = useAccountActions({
        selectedAccount,
        onAddTransaction,
        currentDate
    });



    const ofxInputRef = useRef<HTMLInputElement>(null);
    const [importModal, setImportModal] = useState<{ isOpen: boolean, transactions: OFXTransaction[] }>({ isOpen: false, transactions: [] });
    const [anticipateModal, setAnticipateModal] = useState<{ isOpen: boolean, transaction: Transaction | null }>({ isOpen: false, transaction: null });
    const [importBillModal, setImportBillModal] = useState<{ isOpen: boolean, account: Account | null }>({ isOpen: false, account: null });

    // Deletion State
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

    const handleAccountClick = (account: Account) => {
        setSelectedAccount(account);
        setViewState('DETAIL');
        setIsEditing(false);
    };

    const handleBack = () => {
        setViewState('LIST');
        setSelectedAccount(null);
        setIsEditing(false);
        closeActionModal();
    };

    const handleDelete = () => {
        if (selectedAccount) {
            setAccountToDelete(selectedAccount);
        }
    };

    const handleUpdate = (updatedData: Partial<Account>) => {
        if (selectedAccount) {
            const updatedAccount = { ...selectedAccount, ...updatedData };
            onUpdateAccount(updatedAccount);
            setSelectedAccount(updatedAccount);
            setIsEditing(false);
            addToast('Conta atualizada com sucesso!', 'success');
        }
    };

    const handleExport = (format: 'CSV' | 'PDF') => {
        if (!selectedAccount) return;
        const txs = transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .filter(t => t.accountId === selectedAccount.id);
        if (format === 'CSV') {
            const data = prepareTransactionsForExport(txs, accounts);
            exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Tipo', 'Conta', 'Destino', 'Valor'], `Extrato_${selectedAccount.name}`);
        } else {
            printAccountStatement(selectedAccount, txs);
        }
    };

    const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const transactions = await parseOFX(file);
            setImportModal({ isOpen: true, transactions });
        } catch (error) {
            addToast("Erro ao ler arquivo OFX.", 'error');
        }
        if (ofxInputRef.current) ofxInputRef.current.value = '';
    };

    const handleImportConfirm = (importedTxs: OFXTransaction[]) => {
        if (!selectedAccount) return;

        const txsToImport: Omit<Transaction, 'id'>[] = [];
        let count = 0;

        importedTxs.forEach(tx => {
            const isDuplicate = transactions.some(t => t.accountId === selectedAccount.id && t.amount === tx.amount && t.date === tx.date && t.type === tx.type);
            if (!isDuplicate) {
                txsToImport.push({
                    amount: tx.amount,
                    description: tx.description,
                    date: tx.date,
                    type: tx.type,
                    category: Category.OTHER,
                    accountId: selectedAccount.id,
                    isRecurring: false
                });
                count++;
            }
        });

        if (txsToImport.length > 0) {
            if (onAddTransactions) {
                onAddTransactions(txsToImport);
            } else {
                txsToImport.forEach(t => onAddTransaction(t));
                addToast(`${count} transações importadas!`, 'success');
            }
        } else {
            addToast(`Nenhuma transação nova para importar.`, 'info');
        }

        setImportModal({ isOpen: false, transactions: [] });
    };

    const handleImportBills = (txs: Omit<Transaction, 'id'>[]) => {
        if (onAddTransactions) {
            onAddTransactions(txs);
        } else {
            // Fallback for compatibility
            txs.forEach(tx => onAddTransaction(tx));
            addToast(`${txs.length} faturas importadas com sucesso!`, 'success');
        }
        setImportBillModal({ isOpen: false, account: null });
    };

    const handleAnticipateRequest = (tx: Transaction) => setAnticipateModal({ isOpen: true, transaction: tx });
    const handleConfirmAnticipation = (ids: string[], date: string, accountId: string) => {
        onAnticipate(ids, date, accountId);
        setAnticipateModal({ isOpen: false, transaction: null });
    };

    const totalBalance = useMemo(() => accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency === 'BRL').reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
    const totalCreditUsed = useMemo(() => accounts.filter(a => a.type === AccountType.CREDIT_CARD).reduce((acc, curr) => acc + Math.abs(curr.balance), 0), [accounts]);


    if (viewState === 'DETAIL' && selectedAccount) {
        if (isEditing) {
            return (
                <div className="pb-24 animate-in fade-in slide-in-from-bottom-4">
                    <div className="mb-4 flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="p-0 hover:bg-transparent"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" /></Button>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Editar Conta</h2>
                    </div>
                    <AccountForm type={selectedAccount.type === AccountType.CREDIT_CARD ? 'CARDS' : (selectedAccount.currency !== 'BRL' ? 'INTERNATIONAL' : 'BANKING')} initialData={selectedAccount} onSave={handleUpdate} onCancel={() => setIsEditing(false)} />
                </div>
            );
        }
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-24">
                <div className="flex items-center justify-between no-print">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={handleBack} className="p-0 hover:bg-transparent"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" /></Button>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{selectedAccount.name}</h2>
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-bold">{selectedAccount.currency}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm"><Edit2 className="w-4 h-4" /></Button>
                        <Button onClick={handleDelete} variant="secondary" size="sm" className="text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                        <Button onClick={() => handleExport('CSV')} variant="secondary" size="sm" className="hidden sm:flex gap-2"><Download className="w-4 h-4" /> CSV</Button>
                        <Button onClick={() => handleExport('PDF')} variant="secondary" size="sm" className="hidden sm:flex gap-2"><Printer className="w-4 h-4" /></Button>
                        <div className="relative"><Button onClick={() => ofxInputRef.current?.click()} variant="secondary" size="sm" className="gap-2"><FileUp className="w-4 h-4" /> OFX</Button><input type="file" ref={ofxInputRef} accept=".ofx" className="hidden" onChange={handleOFXUpload} /></div>
                    </div>
                </div>

                {selectedAccount.type === AccountType.CREDIT_CARD ? (
                    <CreditCardDetail account={selectedAccount} transactions={transactions} currentDate={currentDate} showValues={showValues} onAction={(type, amount) => openActionModal(type, amount)} onAnticipateInstallments={handleAnticipateRequest} onImportBills={() => setImportBillModal({ isOpen: true, account: selectedAccount })} onDeleteTransaction={onDeleteTransaction} />
                ) : (
                    <BankingDetail account={selectedAccount} transactions={transactions} showValues={showValues} currentDate={currentDate} onAction={(type) => openActionModal(type)} onDeleteTransaction={onDeleteTransaction} />
                )}

                <ActionModal isOpen={actionModal.isOpen} type={actionModal.type} account={selectedAccount} accounts={accounts} initialAmount={actionModal.amount} onClose={closeActionModal} onConfirm={handleActionSubmit} />
                <ImportModal isOpen={importModal.isOpen} onClose={() => setImportModal({ ...importModal, isOpen: false })} onImport={handleImportConfirm} importedTransactions={importModal.transactions} />
                {anticipateModal.isOpen && anticipateModal.transaction && (<InstallmentAnticipationModal isOpen={anticipateModal.isOpen} onClose={() => setAnticipateModal({ isOpen: false, transaction: null })} transaction={anticipateModal.transaction} allInstallments={transactions} accounts={accounts} onConfirm={handleConfirmAnticipation} />)}
                {importBillModal.isOpen && importBillModal.account && (<CreditCardImportModal isOpen={importBillModal.isOpen} onClose={() => setImportBillModal({ isOpen: false, account: null })} account={importBillModal.account} onImport={handleImportBills} />)}
                <ConfirmModal
                    isOpen={!!accountToDelete}
                    onCancel={() => setAccountToDelete(null)}
                    onConfirm={() => {
                        if (accountToDelete) {
                            onDeleteAccount(accountToDelete.id);
                            setAccountToDelete(null);
                        }
                    }}
                    title="Excluir Conta Bancária?"
                    message={`Tem certeza que deseja excluir a conta "${accountToDelete?.name}"? \n\n⚠️ O histórico de transações desta conta será preservado no banco de dados, mas ficará oculto dos relatórios principais.`}
                    confirmLabel="Excluir Conta"
                    isDanger
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">

            <AccountSummaryCards
                totalBalance={totalBalance}
                totalCreditUsed={totalCreditUsed}
                showValues={showValues}
            />

            <div className="flex justify-start items-center overflow-x-auto no-scrollbar">
                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1">
                    <button onClick={() => setActiveTab('BANKING')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'BANKING' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Contas Bancárias</button>
                    <button onClick={() => setActiveTab('CARDS')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'CARDS' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Cartões de Crédito</button>
                    <button onClick={() => setActiveTab('INTERNATIONAL')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'INTERNATIONAL' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Internacional</button>
                </div>
            </div>

            {isFormOpen && (
                <AccountForm type={activeTab === 'CARDS' ? 'CARDS' : activeTab === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'BANKING'} onSave={(acc) => { onAddAccount(acc as Omit<Account, 'id'>); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />
            )}

            <AccountList
                activeTab={activeTab}
                accounts={accounts}
                transactions={transactions}
                currentDate={currentDate}
                showValues={showValues}
                onAccountClick={handleAccountClick}
                onAddClick={() => setIsFormOpen(true)}
                isFormOpen={isFormOpen}
            />
        </div>
    );
};