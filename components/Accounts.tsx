import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Account, AccountType, Transaction, TransactionType, Category } from '../types';
import { Button } from './ui/Button';
import { Wallet, CreditCard, Plus, ArrowLeft, Download, Printer, FileUp, MoreHorizontal, Landmark, Banknote, Edit2, Trash2, Globe } from 'lucide-react';
import { formatCurrency } from '../utils';
import { useToast } from './ui/Toast';
import { exportToCSV, prepareTransactionsForExport } from '../services/exportUtils';
import { printAccountStatement } from '../services/printUtils';
import { getInvoiceData } from '../services/accountUtils';

import { AccountForm } from './accounts/AccountForm';
import { ActionModal, ActionType } from './accounts/ActionModal';
import { CreditCardDetail } from './accounts/CreditCardDetail';
import { BankingDetail } from './accounts/BankingDetail';
import { parseOFX, OFXTransaction } from '../services/ofxParser';
import { ImportModal } from './accounts/ImportModal';
import { InstallmentAnticipationModal } from './transactions/InstallmentAnticipationModal';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    onAddAccount: (account: Omit<Account, 'id'>) => void;
    onUpdateAccount: (account: Account) => void;
    onDeleteAccount: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    showValues: boolean;
    currentDate?: Date;
    onAnticipate: (ids: string[], date: string, accountId: string) => void; 
}

const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

export const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, onAddAccount, onUpdateAccount, onDeleteAccount, onAddTransaction, showValues, currentDate = new Date(), onAnticipate }) => {
    const [viewState, setViewState] = useState<'LIST' | 'DETAIL'>('LIST');
    const [activeTab, setActiveTab] = useState<'BANKING' | 'CARDS' | 'INTERNATIONAL'>('BANKING');
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const { addToast } = useToast();

    const [invoiceDate, setInvoiceDate] = useState(currentDate);

    useEffect(() => {
        if (!selectedAccount) setInvoiceDate(currentDate);
    }, [currentDate, selectedAccount]);

    const ofxInputRef = useRef<HTMLInputElement>(null);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: ActionType, amount?: string }>({ isOpen: false, type: 'PAY_INVOICE' });
    const [importModal, setImportModal] = useState<{ isOpen: boolean, transactions: OFXTransaction[] }>({ isOpen: false, transactions: [] });
    const [anticipateModal, setAnticipateModal] = useState<{ isOpen: boolean, transaction: Transaction | null }>({ isOpen: false, transaction: null });

    const handleAccountClick = (account: Account) => {
        setSelectedAccount(account);
        setViewState('DETAIL');
        setIsEditing(false);
    };

    const handleBack = () => {
        setViewState('LIST');
        setSelectedAccount(null);
        setIsEditing(false);
        setActionModal({ isOpen: false, type: 'PAY_INVOICE' });
    };

    const handleDelete = () => {
        if (selectedAccount) {
            if (confirm('Tem certeza que deseja excluir esta conta?')) {
                onDeleteAccount(selectedAccount.id);
                handleBack();
            }
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
        const txs = transactions.filter(t => t.accountId === selectedAccount.id);
        if (format === 'CSV') {
            const data = prepareTransactionsForExport(txs, accounts);
            exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Tipo', 'Conta', 'Destino', 'Valor'], `Extrato_${selectedAccount.name}`);
        } else {
            printAccountStatement(selectedAccount, txs);
        }
    };

    const handleActionSubmit = (amount: number, description: string, sourceId: string) => {
        if (!selectedAccount) return;
        const date = new Date().toISOString();
        const commonProps = { amount, date, accountId: selectedAccount.id, isRecurring: false };

        switch (actionModal.type) {
            case 'DEPOSIT':
                onAddTransaction({ ...commonProps, description: description || 'Depósito', type: TransactionType.INCOME, category: Category.INCOME });
                addToast('Depósito realizado!', 'success');
                break;
            case 'WITHDRAW':
                if (sourceId) onAddTransaction({ ...commonProps, description: description || 'Saque para Carteira', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
                else onAddTransaction({ ...commonProps, description: description || 'Saque em Espécie', type: TransactionType.EXPENSE, category: Category.OTHER });
                addToast('Saque registrado!', 'success');
                break;
            case 'TRANSFER':
                onAddTransaction({ ...commonProps, description: description || 'Transferência', type: TransactionType.TRANSFER, category: Category.TRANSFER, destinationAccountId: sourceId });
                addToast('Transferência realizada!', 'success');
                break;
            case 'PAY_INVOICE':
                onAddTransaction({ amount, description: `Pagamento Fatura - ${selectedAccount.name}`, date, type: TransactionType.TRANSFER, category: Category.TRANSFER, accountId: sourceId, destinationAccountId: selectedAccount.id, isRecurring: false });
                addToast('Pagamento de fatura registrado!', 'success');
                break;
        }
        setActionModal({ ...actionModal, isOpen: false });
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
        let count = 0;
        importedTxs.forEach(tx => {
            const isDuplicate = transactions.some(t => t.accountId === selectedAccount.id && t.amount === tx.amount && t.date === tx.date && t.type === tx.type);
            if (!isDuplicate) {
                onAddTransaction({ amount: tx.amount, description: tx.description, date: tx.date, type: tx.type, category: Category.OTHER, accountId: selectedAccount.id, isRecurring: false });
                count++;
            }
        });
        addToast(`${count} transações importadas!`, count > 0 ? 'success' : 'info');
        setImportModal({ isOpen: false, transactions: [] });
    };

    const handleAnticipateRequest = (tx: Transaction) => setAnticipateModal({ isOpen: true, transaction: tx });
    const handleConfirmAnticipation = (ids: string[], date: string, accountId: string) => {
        onAnticipate(ids, date, accountId);
        setAnticipateModal({ isOpen: false, transaction: null });
    };

    const totalBalance = useMemo(() => accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency === 'BRL').reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
    const totalCreditUsed = useMemo(() => accounts.filter(a => a.type === AccountType.CREDIT_CARD).reduce((acc, curr) => acc + Math.abs(curr.balance), 0), [accounts]);

    const getIcon = (type: AccountType) => {
        switch (type) {
            case AccountType.CREDIT_CARD: return <CreditCard className="w-6 h-6" />;
            case AccountType.SAVINGS: return <Banknote className="w-6 h-6" />;
            case AccountType.INVESTMENT: return <Landmark className="w-6 h-6" />;
            case AccountType.CASH: return <Wallet className="w-6 h-6" />;
            default: return <Wallet className="w-6 h-6" />;
        }
    };

    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency === 'BRL');
    const creditCards = accounts.filter(a => a.type === AccountType.CREDIT_CARD);
    const internationalAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD && a.currency !== 'BRL');

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
                    <CreditCardDetail account={selectedAccount} transactions={transactions} currentDate={invoiceDate} showValues={showValues} onInvoiceDateChange={setInvoiceDate} onAction={(type, amount) => setActionModal({ isOpen: true, type, amount })} onAnticipateInstallments={handleAnticipateRequest} />
                ) : (
                    <BankingDetail account={selectedAccount} transactions={transactions} showValues={showValues} onAction={(type) => setActionModal({ isOpen: true, type })} />
                )}

                <ActionModal isOpen={actionModal.isOpen} type={actionModal.type} account={selectedAccount} accounts={accounts} initialAmount={actionModal.amount} onClose={() => setActionModal({ ...actionModal, isOpen: false })} onConfirm={handleActionSubmit} />
                <ImportModal isOpen={importModal.isOpen} onClose={() => setImportModal({ ...importModal, isOpen: false })} onImport={handleImportConfirm} importedTransactions={importModal.transactions} />
                {anticipateModal.isOpen && anticipateModal.transaction && (<InstallmentAnticipationModal isOpen={anticipateModal.isOpen} onClose={() => setAnticipateModal({ isOpen: false, transaction: null })} transaction={anticipateModal.transaction} allInstallments={transactions} accounts={accounts} onConfirm={handleConfirmAnticipation} />)}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-32 h-32" /></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Saldo Bancário (BRL)</p>
                    <h2 className="text-3xl font-black tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(totalBalance)}</PrivacyBlur></h2>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard className="w-32 h-32" /></div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fatura Total Cartões</p>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white"><PrivacyBlur showValues={showValues}>{formatCurrency(totalCreditUsed)}</PrivacyBlur></h2>
                </div>
            </div>

            <div className="flex justify-start items-center overflow-x-auto no-scrollbar">
                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex gap-1">
                    <button onClick={() => setActiveTab('BANKING')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'BANKING' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Contas Bancárias</button>
                    <button onClick={() => setActiveTab('CARDS')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'CARDS' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Cartões de Crédito</button>
                    <button onClick={() => setActiveTab('INTERNATIONAL')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'INTERNATIONAL' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Internacional</button>
                </div>
            </div>

            {isFormOpen && (
                <AccountForm type={activeTab === 'CARDS' ? 'CARDS' : activeTab === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'BANKING'} onSave={(acc) => { onAddAccount(acc as any); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />
            )}

            {activeTab === 'BANKING' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bankingAccounts.map(account => (
                        <div key={account.id} onClick={() => handleAccountClick(account)} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-700 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
                            <div className="relative z-10 flex justify-between items-start mb-8"><div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">{getIcon(account.type)}</div><button className="text-slate-300 dark:text-slate-500 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-5 h-5" /></button></div>
                            <div className="relative z-10"><h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{account.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-4">{account.type}</p><p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></p></div>
                        </div>
                    ))}
                    <button onClick={() => setIsFormOpen(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[200px]"><div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Conta</span></button>
                </div>
            )}

            {activeTab === 'CARDS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {creditCards.map(account => {
                        const { invoiceTotal } = getInvoiceData(account, transactions, currentDate);
                        const limit = account.limit || 0;
                        const committedBalance = Math.abs(account.balance);
                        const percentageUsed = limit > 0 ? Math.min((committedBalance / limit) * 100, 100) : 0;
                        return (
                            <div key={account.id} onClick={() => handleAccountClick(account)} className="group relative w-full aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden text-white p-6 flex flex-col justify-between">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                                <div className="relative z-10 flex justify-between items-start"><h3 className="font-bold text-lg tracking-wider uppercase opacity-90">{account.name}</h3><CreditCard className="w-6 h-6 opacity-60" /></div>
                                <div className="relative z-10 flex justify-between items-end"><div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Fatura Atual</p><p className="font-mono font-bold text-lg tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur></p></div><div className="flex flex-col items-end"><span className="text-[10px] font-bold opacity-60">{percentageUsed.toFixed(0)}% Limite</span></div></div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50"><div className={`h-full transition-all duration-1000 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-emerald-400'}`} style={{ width: `${percentageUsed}%` }}></div></div>
                            </div>
                        );
                    })}
                    <button onClick={() => setIsFormOpen(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[200px]"><div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Cartão</span></button>
                </div>
            )}

            {activeTab === 'INTERNATIONAL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {internationalAccounts.length === 0 && !isFormOpen && (
                         <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                            <Globe className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                            <p>Nenhuma conta internacional (Nomad, Wise, etc.) cadastrada.</p>
                            <Button variant="ghost" onClick={() => setIsFormOpen(true)} className="mt-2">Criar Conta Global</Button>
                         </div>
                    )}
                    {internationalAccounts.map(account => (
                        <div key={account.id} onClick={() => handleAccountClick(account)} className="group bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
                             <div className="relative z-10 flex justify-between items-start mb-8"><div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-700 dark:text-blue-400 group-hover:bg-blue-200 transition-colors">{getIcon(account.type)}</div><button className="text-slate-300 dark:text-slate-500 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-5 h-5" /></button></div>
                             <div className="relative z-10"><h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{account.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-4">{account.type === AccountType.CHECKING ? 'Conta Global' : account.type}</p><p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></p></div>
                        </div>
                    ))}
                    {internationalAccounts.length > 0 && (
                        <button onClick={() => setIsFormOpen(true)} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all group min-h-[200px]"><div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Conta Global</span></button>
                    )}
                </div>
            )}
        </div>
    );
};