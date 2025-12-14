import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Tag, Plus, X, Key, Eye, EyeOff, Settings as SettingsIcon, Database, Globe, Moon, Sun, Monitor, Bell, Shield, Sliders, Lock, Palette, User, Edit2, Check } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { Account, Budget, CustomCategory, FamilyMember, Transaction, Trip, Asset, Goal, Snapshot } from '../types';
import { useToast } from './ui/Toast';
import { ConfirmModal } from './ui/ConfirmModal';
import { Modal } from './ui/Modal';
import { useTheme } from './ui/ThemeContext';
import { NotificationSettings } from './settings/NotificationSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { PreferenceSettings } from './settings/PreferenceSettings';
import { PrivacySettings } from './settings/PrivacySettings';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { DataManagement } from './settings/DataManagement';

interface SettingsProps {
    customCategories: CustomCategory[];
    onAddCategory: (name: string) => void;
    onDeleteCategory: (id: string) => void;
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
    onFactoryReset: () => void;
    currentUserName?: string;
    currentUserEmail?: string;
}

export const Settings: React.FC<SettingsProps> = ({
    customCategories,
    onAddCategory,
    onDeleteCategory,
    accounts,
    transactions,
    trips,
    budgets,
    goals,
    familyMembers,
    assets,
    snapshots,
    onFactoryReset,
    currentUserName,
    currentUserEmail
}) => {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'CATEGORIES' | 'DATA' | 'SYSTEM' | 'NOTIFICATIONS' | 'SECURITY' | 'PREFERENCES' | 'PRIVACY' | 'APPEARANCE'>('GENERAL');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [globalCurrency, setGlobalCurrency] = useState('BRL');
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(currentUserName || '');
    const { addToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    // Update newName when prop changes (if not editing)
    React.useEffect(() => {
        if (!isEditingName) {
            setNewName(currentUserName || '');
        }
    }, [currentUserName, isEditingName]);

    const handleUpdateName = async () => {
        if (!newName.trim()) return;
        try {
            const { error } = await supabase.auth.updateUser({
                data: { name: newName.trim() }
            });
            if (error) throw error;
            setIsEditingName(false);
            addToast('Nome atualizado com sucesso!', 'success');
        } catch (error: any) {
            addToast('Erro ao atualizar nome: ' + error.message, 'error');
        }
    };

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

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
            addToast('Categoria adicionada!', 'success');
        }
    };

    const handleImportData = async (importData: any, mergeMode: boolean) => {
        addToast(
            mergeMode
                ? 'Dados mesclados com sucesso!'
                : 'Dados substituídos com sucesso!',
            'success'
        );
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h2>
                <p className="text-slate-500 dark:text-slate-400">Gerencie suas preferências e dados do sistema.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('GENERAL')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'GENERAL' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <SettingsIcon className="w-4 h-4" /> Geral
                </button>
                <button
                    onClick={() => setActiveTab('NOTIFICATIONS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'NOTIFICATIONS' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Bell className="w-4 h-4" /> Notificações
                </button>
                <button
                    onClick={() => setActiveTab('SECURITY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'SECURITY' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Shield className="w-4 h-4" /> Segurança
                </button>
                <button
                    onClick={() => setActiveTab('PREFERENCES')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'PREFERENCES' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Sliders className="w-4 h-4" /> Preferências
                </button>
                <button
                    onClick={() => setActiveTab('PRIVACY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'PRIVACY' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Lock className="w-4 h-4" /> Privacidade
                </button>
                <button
                    onClick={() => setActiveTab('APPEARANCE')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'APPEARANCE' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Palette className="w-4 h-4" /> Aparência
                </button>
                <button
                    onClick={() => setActiveTab('CATEGORIES')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Tag className="w-4 h-4" /> Categorias
                </button>
                <button
                    onClick={() => setActiveTab('DATA')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'DATA' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Database className="w-4 h-4" /> Dados
                </button>
                <button
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'SYSTEM' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Monitor className="w-4 h-4" /> Sistema
                </button>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {activeTab === 'GENERAL' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                        {/* PROFILE CARD */}
                        <Card className="p-6 md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Perfil do Usuário</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie suas informações pessoais.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome de Exibição</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            disabled={!isEditingName}
                                            className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border ${isEditingName ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-xl focus:outline-none text-slate-900 dark:text-white font-medium transition-all`}
                                            placeholder="Seu nome"
                                        />
                                        {isEditingName ? (
                                            <>
                                                <Button onClick={handleUpdateName} className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700">
                                                    <Check className="w-5 h-5" />
                                                </Button>
                                                <Button onClick={() => { setIsEditingName(false); setNewName(currentUserName || ''); }} variant="secondary" className="w-12 h-12 flex items-center justify-center rounded-xl">
                                                    <X className="w-5 h-5" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Button onClick={() => setIsEditingName(true)} variant="secondary" className="w-12 h-12 flex items-center justify-center rounded-xl">
                                                <Edit2 className="w-5 h-5" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Esse nome será exibido em transações compartilhadas.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">E-mail</label>
                                    <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed">
                                        {currentUserEmail || 'Carregando...'}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">O e-mail não pode ser alterado.</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                                    <Globe className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Regionalização</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Moeda e formato de data.</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Moeda Padrão</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                                    value={globalCurrency}
                                    onChange={(e) => setGlobalCurrency(e.target.value)}
                                >
                                    <option value="BRL">Real Brasileiro (BRL)</option>
                                    <option value="USD">Dólar Americano (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                                    {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Aparência</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Personalize o tema do aplicativo.</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Modo Escuro</span>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'CATEGORIES' && (
                    <Card className="p-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                                <Tag className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Categorias Personalizadas</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie categorias adicionais para suas transações.</p>
                            </div>
                        </div>

                        <form onSubmit={handleAddCat} className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Nova categoria..."
                                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                            />
                            <Button type="submit" disabled={!newCategoryName.trim()} className="w-12 h-12 flex items-center justify-center rounded-xl">
                                <Plus className="w-5 h-5" />
                            </Button>
                        </form>

                        <div className="flex flex-wrap gap-2">
                            {customCategories.length === 0 && (
                                <div className="w-full text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-sm text-slate-400 italic">Nenhuma categoria personalizada.</p>
                                </div>
                            )}
                            {customCategories.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold group shadow-sm hover:shadow-md transition-all">
                                    {cat.name}
                                    <button
                                        onClick={() => onDeleteCategory(cat.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {activeTab === 'NOTIFICATIONS' && <NotificationSettings />}

                {activeTab === 'SECURITY' && <SecuritySettings />}

                {activeTab === 'PREFERENCES' && <PreferenceSettings />}

                {activeTab === 'PRIVACY' && <PrivacySettings />}

                {activeTab === 'APPEARANCE' && <AppearanceSettings />}

                {activeTab === 'DATA' && (
                    <DataManagement
                        accounts={accounts}
                        transactions={transactions}
                        trips={trips}
                        budgets={budgets}
                        goals={goals}
                        familyMembers={familyMembers}
                        assets={assets}
                        snapshots={snapshots}
                        customCategories={customCategories}
                        onFactoryReset={onFactoryReset}
                        handleImportData={handleImportData}
                    />
                )}

                {activeTab === 'SYSTEM' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                                    <Monitor className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Sobre o Sistema</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Informações da versão.</p>
                                </div>
                            </div>
                            import {APP_VERSION, BUILD_CODENAME} from '../config/appVersion';

                            // ... (inside the component return)

                            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Versão</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{APP_VERSION} ({BUILD_CODENAME})</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Ambiente</span>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Produção</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Banco de Dados</span>
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Supabase (Cloud)</span>
                            </div>
                    </div>
                        </Card>
        </div>
    )
}
            </div >

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
        </div >
    );
};