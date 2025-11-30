import React, { useRef, useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Download, Upload, Trash2, ShieldCheck, Database, AlertTriangle, Tag, Plus, X, Key, Eye, EyeOff, CloudUpload } from 'lucide-react';
import { Account, Budget, CustomCategory, FamilyMember, Transaction, Trip, Asset, Goal, Snapshot } from '../types';
import { useToast } from './ui/Toast';
import { ConfirmModal } from './ui/ConfirmModal';
import { Modal } from './ui/Modal';

interface SettingsProps {
    onImport: (data: any) => void; // Reused for "Sync to Cloud"
    customCategories: CustomCategory[];
    onAddCategory: (name: string) => void;
    onDeleteCategory: (id: string) => void;
    // Props de dados para backup real
    accounts: Account[];
    transactions: Transaction[];
    trips: Trip[];
    budgets: Budget[];
    goals: Goal[];
    familyMembers: FamilyMember[];
    assets: Asset[];
    snapshots: Snapshot[];
    onUpdateAccount: (account: Account) => void;
    onDeleteAccount: (id: string) => void;
    onUpdateTrip: (trip: Trip) => void;
    onDeleteTrip: (id: string) => void;
    onResetSystem: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
    onImport, // This is actually handleImportData from useDataStore, which we modified to be Sync
    customCategories,
    onAddCategory,
    onDeleteCategory,
    accounts,
    trips,
    onUpdateAccount,
    onDeleteAccount,
    onUpdateTrip,
    onDeleteTrip,
    onResetSystem
}) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [globalCurrency, setGlobalCurrency] = useState('BRL');
    const { addToast } = useToast();

    // Modal States
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });
    const [inputModal, setInputModal] = useState<{ isOpen: boolean; title: string; value: string; onConfirm: (val: string) => void }>({
        isOpen: false, title: '', value: '', onConfirm: () => { }
    });

    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
        const storedKey = localStorage.getItem('pdm_api_key');
        if (storedKey) setApiKey(storedKey);
    }, []);

    const handleSaveApiKey = () => {
        localStorage.setItem('pdm_api_key', apiKey);
        addToast('Chave API salva com segurança no navegador!', 'success');
    };

    const handleAddCat = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newCategoryName.trim();
        if (trimmed) {
            if (customCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
                addToast('Categoria já existe!', 'warning');
                return;
            }
            onAddCategory(trimmed);
            setNewCategoryName('');
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações e Sistema</h2>

            {/* Cloud Migration */}
            <Card className="p-6 border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <CloudUpload className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Migração para Nuvem</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Envie seus dados locais para o Supabase.</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Se você já usava o app antes da atualização para nuvem, clique abaixo para sincronizar seus dados antigos. 
                        Isso garantirá que você não perca nada ao trocar de dispositivo.
                    </p>
                    <Button onClick={() => onImport(null)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <CloudUpload className="w-4 h-4 mr-2" /> Sincronizar Dados Locais Agora
                    </Button>
                </div>
            </Card>

            {/* Global Preferences */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Preferências Globais</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Definições gerais do sistema.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Moeda Padrão</label>
                        <select
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white font-medium"
                            value={globalCurrency}
                            onChange={(e) => setGlobalCurrency(e.target.value)}
                        >
                            <option value="BRL">Real Brasileiro (BRL)</option>
                            <option value="USD">Dólar Americano (USD)</option>
                            <option value="EUR">Euro (EUR)</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* AI Integration */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl">
                        <Key className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Integração com IA (Gemini)</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure sua chave de API pessoal.</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Gemini API Key</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white font-mono"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Cole sua chave aqui..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <Button onClick={handleSaveApiKey} className="bg-violet-600 hover:bg-violet-700 text-white">Salvar</Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Custom Categories Section */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Categorias Personalizadas</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Adicione categorias extras para suas transações.</p>
                    </div>
                </div>

                <form onSubmit={handleAddCat} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nova categoria..."
                        className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <Button type="submit" disabled={!newCategoryName.trim()} className="w-12 h-10 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                    </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {customCategories.length === 0 && (
                        <p className="text-sm text-slate-400 italic w-full text-center py-4">Nenhuma categoria personalizada.</p>
                    )}
                    {customCategories.map(cat => (
                        <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium group">
                            {cat.name}
                            <button
                                onClick={() => onDeleteCategory(cat.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </Card>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                title={confirmModal.title}
                message={confirmModal.message}
            />

            <Modal
                isOpen={inputModal.isOpen}
                onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
                title={inputModal.title}
            >
                <form onSubmit={(e) => {
                    e.preventDefault();
                    inputModal.onConfirm(inputModal.value);
                    setInputModal(prev => ({ ...prev, isOpen: false }));
                }}>
                    <input
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold mb-4 text-slate-900 dark:text-white"
                        value={inputModal.value}
                        onChange={e => setInputModal(prev => ({ ...prev, value: e.target.value }))}
                    />
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setInputModal(prev => ({ ...prev, isOpen: false }))} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1">Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};