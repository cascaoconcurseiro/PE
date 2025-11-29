import React, { useRef, useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Download, Upload, Trash2, ShieldCheck, Database, AlertTriangle, Tag, Plus, X } from 'lucide-react';
import { Account, Budget, CustomCategory, FamilyMember, Transaction, Trip, Asset, Goal, Snapshot } from '../types';

interface SettingsProps {
    onImport: (data: any) => void;
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
}

export const Settings: React.FC<SettingsProps> = ({
    onImport,
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
    onUpdateAccount,
    onDeleteAccount,
    onUpdateTrip,
    onDeleteTrip
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [globalCurrency, setGlobalCurrency] = useState('BRL'); // Mock global currency state

    const handleExport = () => {
        const data = {
            accounts,
            transactions,
            trips,
            budgets,
            goals,
            familyMembers,
            customCategories,
            assets,
            snapshots,
            exportedAt: new Date().toISOString(),
            version: '3.1'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pede-meia_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (window.confirm('Isso substituirá todos os seus dados atuais. Tem certeza que deseja restaurar o backup?')) {
                    onImport(json);
                }
            } catch (err) {
                alert('Erro ao ler arquivo de backup. Certifique-se que é um JSON válido.');
            }
        };
        reader.readAsText(file);
    };

    const handleClearData = async () => {
        if (window.confirm('ATENÇÃO: Isso apagará TODOS os seus dados deste dispositivo. Se você não fez backup, eles serão perdidos. Deseja continuar?')) {
            try {
                // Clear localStorage
                localStorage.clear();

                // Clear IndexedDB
                // We need to dynamically import db to avoid circular dependency issues if any, 
                // or just assume it's available globally or passed down. 
                // Since we can't easily import 'db' here without changing imports, 
                // let's assume the user will reload and the migration might run again if we don't be careful.
                // But wait, if we delete the DB, the migration logic in index.tsx will see empty DB and try to migrate from localStorage.
                // But we just cleared localStorage. So it will be a fresh start.

                const { db } = await import('../services/db');
                await db.delete();
                await db.open(); // Re-open to recreate schema if needed, or just reload page

                window.location.reload();
            } catch (e) {
                console.error("Error clearing data:", e);
                alert("Erro ao limpar dados. Tente novamente.");
            }
        }
    };

    const handleAddCat = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newCategoryName.trim();
        if (trimmed) {
            if (customCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
                alert('Categoria já existe!');
                return;
            }
            onAddCategory(trimmed);
            setNewCategoryName('');
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <h2 className="text-2xl font-bold text-slate-800">Configurações e Sistema</h2>

            {/* Global Preferences */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Preferências Globais</h3>
                        <p className="text-sm text-slate-500">Definições gerais do sistema.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Moeda Padrão</label>
                        <select
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
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

            {/* Data Management */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Gerenciamento de Dados</h3>
                        <p className="text-sm text-slate-500">Edite ou remova itens criados.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Accounts List */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2">Contas e Cartões</h4>
                        <div className="space-y-2">
                            {accounts.map(acc => (
                                <div key={acc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="font-medium text-slate-800">{acc.name} ({acc.type})</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            const newName = prompt("Novo nome:", acc.name);
                                            if (newName) onUpdateAccount({ ...acc, name: newName });
                                        }} className="text-blue-600 text-xs font-bold hover:underline">Editar</button>
                                        <button onClick={() => {
                                            if (confirm("Excluir esta conta?")) onDeleteAccount(acc.id);
                                        }} className="text-red-600 text-xs font-bold hover:underline">Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trips List */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2">Viagens</h4>
                        <div className="space-y-2">
                            {trips.map(trip => (
                                <div key={trip.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="font-medium text-slate-800">{trip.name}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            const newName = prompt("Novo nome:", trip.name);
                                            if (newName) onUpdateTrip({ ...trip, name: newName });
                                        }} className="text-blue-600 text-xs font-bold hover:underline">Editar</button>
                                        <button onClick={() => {
                                            if (confirm("Excluir esta viagem?")) onDeleteTrip(trip.id);
                                        }} className="text-red-600 text-xs font-bold hover:underline">Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Backup Section */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Backup e Restauração</h3>
                        <p className="text-sm text-slate-500">Salve seus dados ou restaure de um arquivo.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="secondary" onClick={handleExport} className="h-12 flex items-center justify-center gap-2 border-slate-200 hover:bg-slate-50 text-slate-700">
                        <Download className="w-4 h-4" />
                        Exportar Backup (JSON)
                    </Button>
                    <Button variant="secondary" onClick={handleImportClick} className="h-12 flex items-center justify-center gap-2 border-slate-200 hover:bg-slate-50 text-slate-700">
                        <Upload className="w-4 h-4" />
                        Restaurar Backup
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json"
                        className="hidden"
                    />
                </div>
            </Card>

            {/* Custom Categories Section */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Categorias Personalizadas</h3>
                        <p className="text-sm text-slate-500">Adicione categorias extras para suas transações.</p>
                    </div>
                </div>

                <form onSubmit={handleAddCat} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nova categoria..."
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium group">
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

            {/* Danger Zone */}
            <Card className="p-6 border-red-100 bg-red-50/30">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-red-700">Zona de Perigo</h3>
                        <p className="text-sm text-red-500/80">Ações irreversíveis.</p>
                    </div>
                </div>

                <Button
                    variant="danger"
                    onClick={handleClearData}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-sm"
                >
                    <Trash2 className="w-4 h-4" />
                    Apagar Todos os Dados e Reiniciar
                </Button>
            </Card>

            <div className="text-center text-xs text-slate-400 mt-8">
                <p>Pé de Meia v3.0.0</p>
                <p className="mt-1">Desenvolvido com IA</p>
            </div>
        </div>
    );
};