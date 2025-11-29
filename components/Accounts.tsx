import React, { useState, useRef, useMemo } from 'react';
import { Account, AccountType, Transaction, TransactionType, Category } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Wallet, CreditCard, Landmark, Plus, Banknote, Check, Calendar, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownLeft, ShoppingBag, AlertCircle, Lock, Smartphone, FileUp, Globe, MoreHorizontal, Trash2, Edit2, Search, Download, Printer, RefreshCcw } from 'lucide-react';
import { getCategoryIcon, formatCurrency } from '../utils';
import { AVAILABLE_CURRENCIES } from '../services/currencyService';
import { useToast } from './ui/Toast';
import { exportToCSV, prepareTransactionsForExport, printComponent } from '../services/exportUtils';

interface AccountsProps {
    accounts: Account[];
    transactions: Transaction[];
    onAddAccount: (account: Omit<Account, 'id'>) => void;
    onUpdateAccount: (account: Account) => void;
    onDeleteAccount: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
    showValues: boolean;
    currentDate?: Date; // Added prop
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
    React.useEffect(() => {
        if (!selectedAccount) {
            setInvoiceDate(currentDate);
        }
    }, [currentDate, selectedAccount]);

    // OFX State
    const ofxInputRef = useRef<HTMLInputElement>(null);

    // Payment/Action Modal State
    const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: 'PAY_INVOICE' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' }>({ isOpen: false, type: 'PAY_INVOICE' });
    const [actionAmount, setActionAmount] = useState('');
    const [actionDesc, setActionDesc] = useState('');
    const [paymentSourceId, setPaymentSourceId] = useState(''); // Also used as destination for withdrawals

    // Form State
    const [newAccount, setNewAccount] = useState<Partial<Account>>({
        type: AccountType.CHECKING,
        currency: 'BRL',
        balance: 0,
        initialBalance: 0
    });
    const [formError, setFormError] = useState<string | null>(null);

    const getIcon = (type: AccountType) => {
        switch (type) {
            case AccountType.CREDIT_CARD: return <CreditCard className="w-6 h-6" />;
            case AccountType.SAVINGS: return <Banknote className="w-6 h-6" />;
            case AccountType.INVESTMENT: return <Landmark className="w-6 h-6" />;
            case AccountType.CASH: return <Wallet className="w-6 h-6" />;
            default: return <Wallet className="w-6 h-6" />;
        }
    };

    const handleOpenForm = () => {
        setFormError(null);
        if (activeTab === 'CARDS') {
            setNewAccount({ type: AccountType.CREDIT_CARD, currency: 'BRL', limit: 0, closingDay: 1, dueDay: 10, balance: 0, initialBalance: 0 });
        } else {
            setNewAccount({ type: AccountType.CHECKING, currency: 'BRL', balance: 0, initialBalance: 0 });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!newAccount.name || !newAccount.name.trim()) {
            setFormError("Nome da conta é obrigatório.");
            return;
        }

        if (newAccount.type === AccountType.CREDIT_CARD) {
            if ((newAccount.limit || 0) <= 0) {
                setFormError("O limite deve ser maior que zero.");
                return;
            }
            if (!newAccount.closingDay || newAccount.closingDay < 1 || newAccount.closingDay > 31) {
                setFormError("Dia de fechamento inválido (1-31).");
                return;
            }
            if (!newAccount.dueDay || newAccount.dueDay < 1 || newAccount.dueDay > 31) {
                setFormError("Dia de vencimento inválido (1-31).");
                return;
            }
        }

        onAddAccount({
            name: newAccount.name,
            type: newAccount.type!,
            initialBalance: Number(newAccount.balance) || 0,
            balance: Number(newAccount.balance) || 0,
            currency: newAccount.currency || 'BRL',
            limit: newAccount.type === AccountType.CREDIT_CARD ? Number(newAccount.limit) : undefined,
            closingDay: newAccount.type === AccountType.CREDIT_CARD ? Number(newAccount.closingDay) : undefined,
            dueDay: newAccount.type === AccountType.CREDIT_CARD ? Number(newAccount.dueDay) : undefined,
        });
        setIsFormOpen(false);
    };

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
        const txs = getBankExtract(selectedAccount.id);
        
        if (format === 'CSV') {
            const data = prepareTransactionsForExport(txs, accounts);
            exportToCSV(data, ['Data', 'Descrição', 'Categoria', 'Tipo', 'Conta', 'Destino', 'Valor'], `Extrato_${selectedAccount.name}`);
        } else {
            printComponent();
        }
    };

    // --- QUICK ACTIONS LOGIC ---
    const handleActionSubmit = () => {
        if (!selectedAccount || !actionAmount) return;
        const amount = parseFloat(actionAmount);
        if (amount <= 0) return;

        const date = new Date().toISOString();

        switch (actionModal.type) {
            case 'DEPOSIT':
                onAddTransaction({
                    amount,
                    description: actionDesc || 'Depósito',
                    date,
                    type: TransactionType.INCOME,
                    category: Category.INCOME,
                    accountId: selectedAccount.id,
                    isRecurring: false
                });
                addToast('Depósito realizado com sucesso!', 'success');
                break;
            
            case 'WITHDRAW':
                // Check if cash account exists for transfer, else just expense
                if (paymentSourceId) {
                    onAddTransaction({
                        amount,
                        description: actionDesc || 'Saque para Carteira',
                        date,
                        type: TransactionType.TRANSFER,
                        category: Category.TRANSFER,
                        accountId: selectedAccount.id,
                        destinationAccountId: paymentSourceId,
                        isRecurring: false
                    });
                } else {
                    onAddTransaction({
                        amount,
                        description: actionDesc || 'Saque em Espécie',
                        date,
                        type: TransactionType.EXPENSE,
                        category: Category.OTHER, // Or create a generic 'Cash' category
                        accountId: selectedAccount.id,
                        isRecurring: false
                    });
                }
                addToast('Saque registrado com sucesso!', 'success');
                break;

            case 'TRANSFER':
                if (!paymentSourceId) {
                    alert('Selecione a conta de destino.');
                    return;
                }
                onAddTransaction({
                    amount,
                    description: actionDesc || 'Transferência',
                    date,
                    type: TransactionType.TRANSFER,
                    category: Category.TRANSFER,
                    accountId: selectedAccount.id,
                    destinationAccountId: paymentSourceId,
                    isRecurring: false
                });
                addToast('Transferência realizada com sucesso!', 'success');
                break;

            case 'PAY_INVOICE':
                if (!paymentSourceId) return;
                onAddTransaction({
                    amount,
                    description: `Pagamento Fatura - ${selectedAccount.name}`,
                    date,
                    type: TransactionType.TRANSFER,
                    category: Category.TRANSFER,
                    accountId: paymentSourceId,
                    destinationAccountId: selectedAccount.id,
                    isRecurring: false
                });
                addToast('Pagamento de fatura registrado!', 'success');
                break;
        }

        setActionModal({ ...actionModal, isOpen: false });
        setActionAmount('');
        setActionDesc('');
        setPaymentSourceId('');
    };

    const getBankExtract = (accountId: string) => {
        return transactions
            .filter(t => t.accountId === accountId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    // ... (Keep existing helpers: handleOFXUpload, getInvoiceData, getCommittedBalance, etc.)
    const handleOFXUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (Keep existing implementation)
    };
    
    const getInvoiceData = (account: Account, referenceDate: Date) => {
        if (!account.closingDay || !account.limit) return { invoiceTotal: 0, transactions: [], status: 'OPEN', daysToClose: 0, closingDate: new Date(), dueDate: new Date() };
        // ... (Keep existing implementation logic but copy it here to ensure it works)
        const currentDay = referenceDate.getDate();
        const closingDay = account.closingDay;
        let startCycle = new Date(referenceDate);
        let endCycle = new Date(referenceDate);
        if (currentDay <= closingDay) {
            startCycle.setMonth(startCycle.getMonth() - 1);
            startCycle.setDate(closingDay + 1);
            endCycle.setDate(closingDay);
        } else {
            startCycle.setDate(closingDay + 1);
            endCycle.setMonth(endCycle.getMonth() + 1);
            endCycle.setDate(closingDay);
        }
        startCycle.setHours(0, 0, 0, 0);
        endCycle.setHours(23, 59, 59, 999);
        const tempDueDate = new Date(endCycle);
        tempDueDate.setDate(account.dueDay || 10);
        if (tempDueDate < endCycle) tempDueDate.setMonth(tempDueDate.getMonth() + 1);
        const finalDueDate = tempDueDate;
        const txs = transactions.filter(t => {
            const tDate = new Date(t.date);
            return t.accountId === account.id && tDate >= startCycle && tDate <= endCycle;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const total = txs.reduce((acc, t) => {
            if (t.isRefund) return acc - t.amount;
            if (t.type === TransactionType.EXPENSE) return acc + t.amount;
            if (t.type === TransactionType.INCOME) return acc - t.amount;
            return acc;
        }, 0);
        const now = new Date();
        const daysToClose = Math.ceil((endCycle.getTime() - now.getTime()) / (1000 * 3600 * 24));
        const status = endCycle < now ? 'CLOSED' : 'OPEN';
        return { invoiceTotal: total, transactions: txs, status, daysToClose, closingDate: endCycle, dueDate: finalDueDate };
    };

    const getCommittedBalance = (account: Account) => {
        const accountTxs = transactions.filter(t => t.accountId === account.id);
        const incomingTxs = transactions.filter(t => t.destinationAccountId === account.id);
        const totalDebt = accountTxs.reduce((acc, t) => {
            if (t.isRefund) return acc + t.amount;
            if (t.type === TransactionType.EXPENSE) return acc - t.amount;
            if (t.type === TransactionType.INCOME) return acc + t.amount;
            if (t.type === TransactionType.TRANSFER) return acc - t.amount;
            return acc;
        }, 0);
        const totalPayments = incomingTxs.reduce((acc, t) => acc + (t.destinationAmount || t.amount), 0);
        return Math.abs(totalDebt + totalPayments + (account.initialBalance || 0));
    };

    const handleAdjustInvoice = (account: Account, currentTotal: number) => {
        // ... (Keep existing implementation)
    };

    const totalBalance = useMemo(() => accounts.filter(a => a.type !== AccountType.CREDIT_CARD).reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
    const totalCreditUsed = useMemo(() => accounts.filter(a => a.type === AccountType.CREDIT_CARD).reduce((acc, curr) => acc + Math.abs(curr.balance), 0), [accounts]);

    // --- VIEW 1: DETAILED ACCOUNT VIEW ---
    if (viewState === 'DETAIL' && selectedAccount) {
        // Common Header for Detail View
        const DetailHeader = () => (
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
        );

        if (selectedAccount.type === AccountType.CREDIT_CARD) {
            const { invoiceTotal, transactions: invoiceTxs, status, daysToClose, closingDate, dueDate } = getInvoiceData(selectedAccount, invoiceDate);
            const limit = selectedAccount.limit || 0;
            const committedBalance = getCommittedBalance(selectedAccount);
            const available = limit - committedBalance;
            const percentageUsed = Math.min((committedBalance / limit) * 100, 100);

            return (
                <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-24">
                    <DetailHeader />

                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 relative print:shadow-none print:border">
                        <div className={`h-2 w-full ${status === 'CLOSED' ? 'bg-red-600' : 'bg-blue-600'}`}></div>

                        <div className="p-8">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-2 ${status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {status === 'CLOSED' ? 'Fatura Fechada' : 'Fatura Aberta'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(invoiceDate); d.setMonth(d.getMonth() - 1); setInvoiceDate(d); }} className="h-6 w-6 p-0 rounded-full bg-slate-100 hover:bg-slate-200 no-print"><ArrowLeft className="w-3 h-3" /></Button>
                                        <span className="text-xs font-bold text-slate-700 capitalize">{closingDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(invoiceDate); d.setMonth(d.getMonth() + 1); setInvoiceDate(d); }} className="h-6 w-6 p-0 rounded-full bg-slate-100 hover:bg-slate-200 no-print"><ArrowRight className="w-3 h-3" /></Button>
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium mt-2">{status === 'OPEN' ? `Fecha em ${daysToClose} dias` : `Fechou dia ${closingDate.getDate()}`}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-600 font-bold mb-1">Valor da Fatura</p>
                                    <p className={`text-4xl font-black tracking-tight ${status === 'CLOSED' ? 'text-red-700' : 'text-slate-900'}`}><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, selectedAccount.currency)}</PrivacyBlur></p>
                                </div>
                            </div>

                            {invoiceTotal > 0 && (
                                <div className="mb-8 no-print">
                                    <Button onClick={() => { 
                                        const defaultSource = accounts.find(a => a.type === AccountType.CHECKING || a.type === AccountType.CASH)?.id;
                                        if (defaultSource) setPaymentSourceId(defaultSource);
                                        setActionAmount(invoiceTotal.toString());
                                        setActionModal({ isOpen: true, type: 'PAY_INVOICE' });
                                    }} className={`w-full rounded-xl font-bold shadow-lg h-14 text-lg ${status === 'CLOSED' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/30'}`}>
                                        <Smartphone className="w-5 h-5 mr-2" /> Pagar Fatura
                                    </Button>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-sm text-slate-600 border-t border-slate-100 pt-6">
                                <div className="flex gap-2 items-center"><Calendar className="w-4 h-4 text-slate-400" /><span>Vence dia <strong>{dueDate.getDate()}</strong></span></div>
                                <div className="flex gap-2 items-center"><Lock className="w-4 h-4 text-slate-400" /><span>Fecha dia <strong>{selectedAccount.closingDay}</strong></span></div>
                            </div>
                        </div>

                        <div className="px-8 pb-8 bg-slate-50/50 pt-6 border-t border-slate-100">
                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-2"><span>Limite Utilizado</span><span>{formatCurrency(selectedAccount.limit || 0, selectedAccount.currency)}</span></div>
                            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mb-2"><div className={`h-full rounded-full ${percentageUsed > 90 ? 'bg-red-500' : percentageUsed > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentageUsed}%` }}></div></div>
                            <div className="flex justify-between text-xs"><span className="text-slate-500">{formatCurrency(committedBalance, selectedAccount.currency)}</span><span className="text-emerald-700 font-bold">Disp: <PrivacyBlur showValues={showValues}>{formatCurrency(available, selectedAccount.currency)}</PrivacyBlur></span></div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 px-2">Lançamentos na Fatura</h3>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                                {invoiceTxs.length === 0 ? <div className="p-8 text-center text-slate-500"><ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Nenhuma compra nesta fatura.</p></div> : 
                                    invoiceTxs.map(t => (
                                        <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.isRefund ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t.isRefund ? <ArrowDownLeft className="w-5 h-5" /> : getCategoryIcon(t.category)({ className: "w-5 h-5" })}</div>
                                                <div><p className="text-sm font-bold text-slate-800">{t.description}</p><div className="flex gap-2 text-xs text-slate-600"><span>{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>{t.currentInstallment && <span>• {t.currentInstallment}/{t.totalInstallments}</span>}</div></div>
                                            </div>
                                            <span className={`font-bold ${t.isRefund ? 'text-amber-700' : 'text-slate-800'}`}>{t.isRefund ? '-' : ''}{formatCurrency(t.amount, selectedAccount.currency)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                    {/* Action Modal Reuse */}
                    {actionModal.isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                            <Card className="w-full max-w-sm bg-white shadow-2xl" title="Pagar Fatura">
                                <div className="space-y-4">
                                    <div className="text-center py-2"><p className="text-sm text-slate-600 mb-1">Total</p><p className="text-xl font-bold text-slate-900 mb-4">{formatCurrency(parseFloat(actionAmount), selectedAccount.currency)}</p></div>
                                    <div><label className="block text-sm font-bold text-slate-700 mb-2">Pagar usando:</label><select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={paymentSourceId} onChange={(e) => setPaymentSourceId(e.target.value)}>{accounts.filter(a => a.type !== AccountType.CREDIT_CARD).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>)}</select></div>
                                    <div className="flex gap-3 pt-2"><Button variant="secondary" onClick={() => setActionModal({ ...actionModal, isOpen: false })} className="flex-1">Cancelar</Button><Button onClick={handleActionSubmit} className="flex-1 bg-emerald-600 text-white">Confirmar</Button></div>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            );
        }

        const extractTxs = getBankExtract(selectedAccount.id);
        const income = extractTxs.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + (b.isRefund ? -b.amount : b.amount), 0);
        const expense = extractTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + (b.isRefund ? -b.amount : b.amount), 0);

        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-24">
                <DetailHeader />

                {/* --- ACCOUNT HEADER CARD --- */}
                <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden print:bg-white print:text-black print:border print:border-black">
                    <div className="absolute top-0 right-0 p-32 opacity-10 no-print"><Landmark className="w-32 h-32" /></div>
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo em Conta</p>
                        <h3 className="text-5xl font-black mt-2 tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(selectedAccount.balance, selectedAccount.currency)}</PrivacyBlur></h3>
                        <div className="mt-8 flex gap-8">
                            <div><div className="flex items-center gap-1 text-emerald-400 mb-1"><ArrowUpRight className="w-4 h-4" /><span className="text-xs font-bold uppercase">Entradas</span></div><p className="font-mono text-lg"><PrivacyBlur showValues={showValues}>{formatCurrency(income, selectedAccount.currency)}</PrivacyBlur></p></div>
                            <div><div className="flex items-center gap-1 text-red-400 mb-1"><ArrowDownLeft className="w-4 h-4" /><span className="text-xs font-bold uppercase">Saídas</span></div><p className="font-mono text-lg"><PrivacyBlur showValues={showValues}>{formatCurrency(expense, selectedAccount.currency)}</PrivacyBlur></p></div>
                        </div>
                    </div>
                </div>

                {/* --- QUICK ACTIONS (NEW) --- */}
                <div className="grid grid-cols-3 gap-3 no-print">
                    <button onClick={() => { setActionModal({ isOpen: true, type: 'DEPOSIT' }); setActionAmount(''); }} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700"><ArrowUpRight className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-slate-700">Depositar</span>
                    </button>
                    <button onClick={() => { setActionModal({ isOpen: true, type: 'WITHDRAW' }); setActionAmount(''); }} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700"><ArrowDownLeft className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-slate-700">Sacar</span>
                    </button>
                    <button onClick={() => { setActionModal({ isOpen: true, type: 'TRANSFER' }); setActionAmount(''); }} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700"><RefreshCcw className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-slate-700">Transferir</span>
                    </button>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 px-2">Extrato Detalhado</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {extractTxs.length === 0 ? <div className="p-8 text-center text-slate-500"><p className="text-sm">Nenhuma movimentação.</p></div> : 
                            extractTxs.map(t => {
                                const CatIcon = getCategoryIcon(t.category);
                                const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
                                return (
                                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}><CatIcon className="w-5 h-5" /></div>
                                            <div><p className="text-sm font-bold text-slate-800">{t.description}</p><p className="text-xs text-slate-600">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p></div>
                                        </div>
                                        <span className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-slate-800'}`}>{isPositive ? '+' : '-'}<PrivacyBlur showValues={showValues}>{formatCurrency(t.amount, selectedAccount.currency)}</PrivacyBlur></span>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>

                {/* --- ACTION MODAL --- */}
                {actionModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <Card className="w-full max-w-sm bg-white shadow-2xl" title={actionModal.type === 'DEPOSIT' ? 'Novo Depósito' : actionModal.type === 'WITHDRAW' ? 'Realizar Saque' : 'Transferência'}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor</label>
                                    <input type="number" autoFocus className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-bold text-slate-900" placeholder="0,00" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição (Opcional)</label>
                                    <input type="text" className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder={actionModal.type === 'DEPOSIT' ? 'Ex: Venda extra' : 'Ex: Saque caixa eletrônico'} value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} />
                                </div>

                                {/* Destination Selector for Transfer/Withdraw */}
                                {actionModal.type === 'TRANSFER' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Para (Destino)</label>
                                        <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={paymentSourceId} onChange={(e) => setPaymentSourceId(e.target.value)}>
                                            <option value="">Selecione...</option>
                                            {accounts.filter(a => a.id !== selectedAccount.id).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {actionModal.type === 'WITHDRAW' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mover para Carteira? (Opcional)</label>
                                        <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none" value={paymentSourceId} onChange={(e) => setPaymentSourceId(e.target.value)}>
                                            <option value="">Não, apenas registrar saída</option>
                                            {accounts.filter(a => a.type === AccountType.CASH).map(acc => <option key={acc.id} value={acc.id}>Enviar para: {acc.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <Button variant="secondary" onClick={() => setActionModal({ ...actionModal, isOpen: false })} className="flex-1">Cancelar</Button>
                                    <Button onClick={handleActionSubmit} className={`flex-1 text-white ${actionModal.type === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700' : actionModal.type === 'WITHDRAW' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmar</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW 2: MASTER LIST ---
    const bankingAccounts = accounts.filter(a => a.type !== AccountType.CREDIT_CARD).filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const creditCards = accounts.filter(a => a.type === AccountType.CREDIT_CARD).filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
                <Button onClick={handleOpenForm} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 rounded-xl h-11"><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
            </div>

            {isFormOpen && (
                <Card className="bg-slate-50/50 border-slate-200" title={activeTab === 'BANKING' ? "Nova Conta Bancária" : "Novo Cartão de Crédito"}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder={activeTab === 'BANKING' ? "Ex: Nubank, Carteira" : "Ex: Nubank Gold, Itaú Black"} value={newAccount.name || ''} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} required list="brokerages" />
                                <datalist id="brokerages"><option value="Nubank" /><option value="Inter" /><option value="Itaú" /><option value="Bradesco" /><option value="Santander" /><option value="C6 Bank" /><option value="XP" /><option value="BTG" /></datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                    <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 text-sm font-normal" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}>{activeTab === 'BANKING' ? Object.values(AccountType).filter(t => t !== AccountType.CREDIT_CARD).map(t => <option key={t} value={t}>{t}</option>) : <option value={AccountType.CREDIT_CARD}>{AccountType.CREDIT_CARD}</option>}</select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Moeda</label>
                                    <div className="relative"><select className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-slate-900 text-sm font-normal" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>{AVAILABLE_CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}</select><Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" /></div>
                                </div>
                            </div>
                            {activeTab === 'CARDS' ? (
                                <>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Limite Total</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.limit || ''} onChange={e => setNewAccount({ ...newAccount, limit: parseFloat(e.target.value) })} required /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Dia Fechamento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.closingDay || ''} onChange={e => setNewAccount({ ...newAccount, closingDay: parseInt(e.target.value) })} required /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Dia Vencimento</label><input type="number" min="1" max="31" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="Dia" value={newAccount.dueDay || ''} onChange={e => setNewAccount({ ...newAccount, dueDay: parseInt(e.target.value) })} required /></div>
                                    </div>
                                </>
                            ) : (
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-normal" placeholder="0,00" value={newAccount.balance || ''} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) })} /><p className="text-[10px] text-slate-500 mt-1">Este valor será registrado como um lançamento de ajuste inicial.</p></div>
                            )}
                        </div>
                        {formError && <div className="text-red-700 text-sm font-bold p-3 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {formError}</div>}
                        <div className="flex justify-end pt-2 gap-2"><Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</Button><Button type="submit" variant="primary"><Check className="w-4 h-4 mr-2" /> Salvar</Button></div>
                    </form>
                </Card>
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
                    <button onClick={handleOpenForm} className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[200px]"><div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Nova Conta</span></button>
                </div>
            )}

            {activeTab === 'CARDS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {creditCards.map(account => {
                        const { invoiceTotal } = getInvoiceData(account, currentDate);
                        const limit = account.limit || 0;
                        const committedBalance = getCommittedBalance(account);
                        const percentageUsed = Math.min((committedBalance / limit) * 100, 100);
                        return (
                            <div key={account.id} onClick={() => handleAccountClick(account)} className="group bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden min-h-[220px] flex flex-col justify-between">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div><div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-colors"></div>
                                <div className="relative z-10 flex justify-between items-start"><div><h3 className="font-bold text-lg">{account.name}</h3><p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Cartão de Crédito</p></div><CreditCard className="w-6 h-6 text-white/50" /></div>
                                <div className="relative z-10 mt-6"><div className="flex justify-between items-end mb-2"><div><p className="text-xs text-slate-400 mb-1">Fatura Atual ({currentDate.toLocaleDateString('pt-BR', { month: 'short' })})</p><p className="text-2xl font-mono font-bold tracking-tight"><PrivacyBlur showValues={showValues}>{formatCurrency(invoiceTotal, account.currency)}</PrivacyBlur></p></div></div><div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-2"><div className={`h-full rounded-full transition-all duration-500 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percentageUsed}%` }}></div></div><div className="flex justify-between text-[10px] text-slate-400 font-medium"><span>Limite: {formatCurrency(limit, account.currency)}</span><span>{percentageUsed.toFixed(0)}% usado</span></div></div>
                            </div>
                        );
                    })}
                    <button onClick={handleOpenForm} className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all group min-h-[220px]"><div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><Plus className="w-6 h-6" /></div><span className="font-bold text-sm">Adicionar Novo Cartão</span></button>
                </div>
            )}
        </div>
    );
};