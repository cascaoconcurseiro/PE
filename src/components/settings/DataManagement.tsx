import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Download, Upload, AlertTriangle, Monitor } from 'lucide-react';
import { DataImport } from './DataImport';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Account, Budget, CustomCategory, FamilyMember, Transaction, Trip, Asset, Goal, Snapshot } from '../../types';

interface DataManagementProps {
    accounts: Account[];
    transactions: Transaction[];
    trips: Trip[];
    budgets: Budget[];
    goals: Goal[];
    familyMembers: FamilyMember[];
    assets: Asset[];
    snapshots: Snapshot[];
    customCategories: CustomCategory[];
    onFactoryReset: (unlinkFamily: boolean) => void;
    handleImportData: (importData: any, mergeMode: boolean) => Promise<void>;
}

export const DataManagement: React.FC<DataManagementProps> = ({
    accounts,
    transactions,
    trips,
    budgets,
    goals,
    familyMembers,
    assets,
    snapshots,
    customCategories,
    onFactoryReset,
    handleImportData
}) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'IMPORT'>('OVERVIEW');
    const [unlinkFamily, setUnlinkFamily] = useState(false);
    const [inputModal, setInputModal] = useState<{ isOpen: boolean; title: string; value: string; onConfirm: (val: string) => void }>({
        isOpen: false, title: '', value: '', onConfirm: () => { }
    });

    const handleExportJSON = () => {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            accounts,
            transactions,
            trips,
            budgets,
            goals,
            familyMembers,
            assets,
            snapshots,
            customCategories
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_pe_de_meia_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('Backup exportado com sucesso!', 'success');
    };

    if (activeTab === 'IMPORT') {
        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <button onClick={() => setActiveTab('OVERVIEW')} className="text-sm text-indigo-600 font-bold hover:underline mb-2">
                    &larr; Voltar para Visão Geral
                </button>
                <DataImport onImportComplete={handleImportData} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Download className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Exportar Dados</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Faça backup dos seus dados.</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                        Gere um arquivo JSON contendo todas as suas contas, transações, viagens e configurações.
                    </p>
                    <Button onClick={handleExportJSON} className="w-full gap-2">
                        <Download className="w-4 h-4" /> Exportar Backup (JSON)
                    </Button>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Importar Dados</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Restaure um backup anterior.</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                        Clique abaixo para acessar as opções de importação.
                    </p>
                    <Button onClick={() => setActiveTab('IMPORT')} className="w-full gap-2" variant="secondary">
                        <Upload className="w-4 h-4" /> Ver Opções de Importação
                    </Button>
                </Card>

                <Card className="p-6 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-red-700 dark:text-red-400">Zona de Perigo</h3>
                            <p className="text-sm text-red-600/80 dark:text-red-400/80">Ações irreversíveis.</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                        O reset de fábrica irá apagar permanentemente todas as suas transações, contas, metas e configurações. Esta ação não pode ser desfeita.
                    </p>
                    <Button
                        onClick={() => setInputModal({
                            isOpen: true,
                            title: 'Digite "CONFIRMAR" para apagar tudo',
                            value: '',
                            onConfirm: (val) => {
                                if (val === 'CONFIRMAR') {
                                    onFactoryReset(unlinkFamily);
                                } else {
                                    addToast('Código incorreto. Ação cancelada.', 'error');
                                }
                            }
                        })}
                        className="w-full bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                    >
                        Restaurar Padrão de Fábrica
                    </Button>
                </Card>
            </div>

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
            {/* Modal Injection for Checkbox */}
            <Modal isOpen={inputModal.isOpen} onClose={() => setInputModal({ ...inputModal, isOpen: false })} title={inputModal.title}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Esta ação irá apagar todas as suas <strong>transações, contas e metas</strong>.
                    </p>

                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={unlinkFamily}
                                onChange={e => setUnlinkFamily(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                            />
                            <div>
                                <span className="block font-bold text-slate-800 dark:text-white text-sm">Sair da Família e Excluir Viagens</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    Marque se deseja desfazer todos os vínculos e sair de viagens compartilhadas.
                                </span>
                            </div>
                        </label>
                    </div>

                    <p className="text-xs text-slate-500 pb-2">
                        Digite <strong>CONFIRMAR</strong> abaixo para prosseguir.
                    </p>

                    <input
                        type="text"
                        value={inputModal.value}
                        onChange={(e) => setInputModal({ ...inputModal, value: e.target.value })}
                        className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold tracking-widest text-center uppercase"
                        placeholder="CONFIRMAR"
                        autoFocus
                    />

                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="secondary" onClick={() => setInputModal({ ...inputModal, isOpen: false })}>Cancelar</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={inputModal.value !== 'CONFIRMAR'}
                            onClick={() => {
                                inputModal.onConfirm(inputModal.value);
                                setInputModal({ ...inputModal, isOpen: false });
                            }}
                        >
                            Resetar Tudo
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
