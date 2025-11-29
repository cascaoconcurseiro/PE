import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Account, AccountType, Transaction, TransactionType, Category } from '../types';
import { Button } from './ui/Button';
import { Wallet, CreditCard, Plus, ArrowLeft, Search, Download, Printer, FileUp, MoreHorizontal, Landmark, Banknote } from 'lucide-react';
import { formatCurrency } from '../utils';
import { useToast } from './ui/Toast';
import { exportToCSV, prepareTransactionsForExport, printComponent } from '../services/exportUtils';
import { getInvoiceData, getBankExtract } from '../services/accountUtils';

// Sub-components
import { AccountForm } from './accounts/AccountForm';
import { ActionModal, ActionType } from './accounts/ActionModal';
import { CreditCardDetail } from './accounts/CreditCardDetail';
import { BankingDetail } from './accounts/BankingDetail';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    onAddAccount: (account: Omit<Account, 'id'>) => void;
    onUpdateAccount: (account: Account) => void;
    onDeleteAccount: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    showValues: boolean;
    currentDate?: Date;
}

const PrivacyBlur = ({ children, showValues }: { children?: React.ReactNode, showValues: boolean }) => {
    if (showValues) return <>{children}</>;
    return <span className="blur-sm select-none opacity-60">••••</span>;
};

export const Accounts: React.FC<AccountsProps> = ({ accounts, transactions, onAddAccount, onUpdateAccount, onDeleteAccount, onAddTransaction, showValues, currentDate = new Date() }) => {
    const [viewState, setViewState] = useState<'LIST' | 'DETAIL'>('LIST');
    const [activeTab, setActiveTab] = useState<'BANKING' | 'CARDS'>('BANKING');
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();

    // Invoice Navigation State
    const [invoiceDate, setInvoiceDate] = useState(currentDate);

    // Sync local invoice date when global date changes
    useEffect(() => {
        if (!selectedAccount) {
            setInvoiceDate(currentDate);
        }
    }, [currentDate, selectedAccount]);

    // OFX State
    const ofxInputRef = useRef<HTMLInputElement>(null);

    // Payment/Action Modal State
    const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: ActionType, amount?: string }>({ isOpen: false, type: 'PAY_INVOICE' });

    const handleAccountClick = (account: Account) => {
        setSelectedAccount(account);
        setViewState('DETAIL');
    };

    const handleBack = () => {
        setViewState('LIST');
        setSelectedAccount(null);
        setActionModal({ isOpen: false, type: 'PAY_INVOICE' });
    };

    const handleExport = (format: 'CSV' | 'PDF') => {
        if (!selectedAccount) return;
        const txs = getBankExtract(selectedAccount.id, transactions);
        
        if (format === 'CSV') {
            const data = prepareTransactionsForExport(txs, accounts);
            exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Tipo', 'Conta', 'Destino', 'Valor'], `Extrato_${selectedAccount.name}`);
        } else {
            printComponent();
        }
    };

    // --- QUICK ACTIONS LOGIC ---
    const handleActionSubmit = (amount: number, description: string, sourceId: string) => {
        if (!selectedAccount) return;
        const date = new Date().toISOString();

        switch (actionModal.type) {
            case 'DEPOSIT':
                onAddTransaction({
                    amount,
                    description: description || 'Depósito',
                    date,
                    type: TransactionType.INCOME,
                    category: Category.INCOME,
                    accountId: selectedAccount.id,
                    isRecurring: false
                });
                addToast('Depósito realizado com sucesso!', 'success');
                break;
            
            case 'WITHDRAW':
                if (sourceId) {
                    onAddTransaction({
                        amount,
                        description: description || 'Saque para Carteira',
                        date,
                        type: TransactionType.TRANSFER,
                        category: Category.TRANSFER,
                        accountId: selectedAccount.id,
                        destinationAccountId: sourceId,
                        isRecurring: false
                    });
                } else {
                    onAddTransaction({
                        amount,
                        description: description || 'Saque em Espécie',
                        date,
                        type: TransactionType.EXPENSE,
                        category: Category.OTHER,
                        accountId: selectedAccount.id,
                        isRecurring: false
                    });
                }
                addToast('Saque registrado com sucesso!', 'success');
                break;

            case 'TRANSFER':
                onAddTransaction({
                    amount,
                    description: description || 'Transferência',
                    date,
                    type: TransactionType.TRANSFER,
                    category: Category.TRANSFER,
                    accountId: selectedAccount.id,
                    destinationAccountId: sourceId,
                    isRecurring: false
                });
                addToast('Transferência realizada com sucesso!', 'success');
                break;

            case 'PAY_INVOICE':
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

        setActionModal({ ...actionModal, isOpen: false });
    };

    const handleOFXUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Placeholder for future OFX implementation
        alert("Upload de OFX será implementado em breve.");
    };

    const totalBalance = useMemo(() => accounts.filter(a => a.type !== AccountType.CREDIT_CARD).reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
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

    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD).filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const creditCards = accounts.filter(a => a.type === AccountType.CREDIT_CARD).filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // --- RENDER DETAIL VIEW ---
    if (viewState === 'DETAIL' && selectedAccount) {
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-24">
                {/* Detail Header */}
                <div className="flex items-center justify-between no-print">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={handleBack} className="p-0 hover:bg-transparent">
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </Button>
                        <h2 className="text-xl font-bold text-slate-800">{selectedAccount.name}</h2>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold">{selectedAccount.currency}</span>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button onClick={() => handleExport('CSV')} variant="secondary" size="sm" className="gap-2 hidden sm:flex">
                            <Download className="w-4 h-4" /> Excel
                        </Button>
                        <Button onClick={() => handleExport('PDF')} variant="secondary" size="sm" className="gap-2 hidden sm:flex">
                            <Printer className="w-4 h-4" /> Imprimir
                        </Button>
                        
                        <div className="relative">
                            <Button onClick={() => ofxInputRef.current?.click()} variant="secondary" size="sm" className="gap-2 text-slate-700 border-slate-200 shadow-sm hover:bg-slate-50">
                                <FileUp className="w-4 h-4" /> OFX
                            </Button>
                            <input type="file" ref={ofxInputRef} accept=".ofx" className="hidden" onChange={handleOFXUpload} />
                        </div>
                    </div>
                </div>

                {selectedAccount.type === AccountType.CREDIT_CARD ? (
                    <CreditCardDetail 
                        account={selectedAccount} 
                        transactions={transactions} 
                        currentDate={invoiceDate} 
                        showValues={showValues} 
                        onInvoiceDateChange={setInvoiceDate}
                        onAction={(type, amount) => setActionModal({ isOpen: true, type, amount })}
                    />
                ) : (
                    <BankingDetail 
                        account={selectedAccount} 
                        transactions={transactions} 
                        showValues={showValues}
                        onAction={(type) => setActionModal({ isOpen: true, type })}
                    />
                )}

                {/* Shared Action Modal */}
                <ActionModal 
                    isOpen={actionModal.isOpen}
                    type={actionModal.type}
                    account={selectedAccount}
                    accounts={accounts}
                    initialAmount={actionModal.amount}
                    onClose={() => setActionModal({ ...actionModal, isOpen: false })}
                    onConfirm={handleActionSubmit}
                />
            </div>
        );
    }

    // --- RENDER LIST VIEW ---
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-32 h-32" /></div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Saldo Total em Contas</p>
                    <h2 className="text-3xl font-black tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(totalBalance)}</PrivacyBlur></h2>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard className="w-32 h-32" /></div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Fatura Total Cartões</p>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900"><PrivacyBlur showValues={showValues}>{formatCurrency(totalCreditUsed)}</PrivacyBlur></h2>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 w-full sm:w-auto">
                    <button onClick={() => setActiveTab('BANKING')} className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'BANKING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Contas Bancárias</button>
                    <button onClick={() => setActiveTab('CARDS')} className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'CARDS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cartões de Crédito</button>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Buscar conta..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 placeholder:text-slate-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 rounded-xl h-11"><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
            </div>

            {isFormOpen && (
                <AccountForm 
                    type={activeTab} 
                    onSave={(acc) => { onAddAccount(acc as any); setIsFormOpen(false); }} 
                    onCancel={() => setIsFormOpen(false)} 
                />
            )}

            {activeTab === 'BANKING' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bankingAccounts.map(account => (
                        <div key={account.id} onClick={() => handleAccountClick(account)} className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
                            <div className="relative z-10 flex justify-between items-start mb-8"><div className="p-3 bg-slate-100 rounded-2xl text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">{getIcon(account.type)}</div><button className="text-slate-300 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-5 h-5" /></button></div>
                            <div className="relative z-10"><h3 className="font-bold text-slate-900 text-lg mb-1">{account.name}</h3><p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-4">{account.type}</p><p className="text-2xl font-black text-slate-900 tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(account.balance, account.currency)}</PrivacyBlur></p></div>
                        </div>
                    ))}
                    <button onClick={() => setIsFormOpen(true)} className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[200px]"><div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Nova Conta</span></button>
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
                            <div key={account.id} onClick={() => handleAccountClick(account)} className="group bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden min-h-[220px] flex flex-col justify-between">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div><div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-colors"></div>
                                <div className="relative z-10 flex justify-between items-start"><div><h3 className="font-bold text-lg">{account.name}</h3><p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Cartão de Crédito</p></div><CreditCard className="w-6 h-6 text-white/50" /></div>
                                <div className="relative z-10 mt-6"><div className="flex justify-between items-end mb-2"><div><p className="text-xs text-slate-400 mb-1">Fatura Atual ({currentDate.toLocaleDateString('pt-BR', { month: 'short' })})</p><p className="text-2xl font-mono font-bold tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur></p></div></div><div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-2"><div className={`h-full rounded-full transition-all duration-500 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percentageUsed}%` }}></div></div><div className="flex justify-between text-[10px] text-slate-400 font-medium"><span>Limite: {formatCurrency(limit, account.currency)}</span><span>{percentageUsed.toFixed(0)}% usado</span></div></div>
                            </div>
                        );
                    })}
                    <button onClick={() => setIsFormOpen(true)} className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[220px]"><div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Novo Cartão</span></button>
                </div>
            )}
        </div>
    );
};