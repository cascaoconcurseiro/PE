import React, { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Upload, FileJson, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface ImportData {
    version?: string;
    exportedAt?: string;
    accounts?: import('../../types').Account[];
    transactions?: import('../../types').Transaction[];
    trips?: import('../../types').Trip[];
    budgets?: import('../../types').Budget[];
    goals?: import('../../types').Goal[];
    familyMembers?: import('../../types').FamilyMember[];
    assets?: import('../../types').Asset[];
    snapshots?: import('../../types').Snapshot[];
    customCategories?: import('../../types').CustomCategory[];
}

interface DataImportProps {
    onImportComplete: (data: ImportData, mergeMode: boolean) => void;
}

export const DataImport: React.FC<DataImportProps> = ({ onImportComplete }) => {
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [mergeMode, setMergeMode] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            addToast('Por favor, selecione um arquivo JSON válido!', 'error');
            return;
        }

        setSelectedFile(file);
        setIsValidating(true);
        setValidationErrors([]);

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate structure
            const errors: string[] = [];

            if (!data.version) {
                errors.push('Arquivo não contém informação de versão');
            }

            if (!data.exportedAt) {
                errors.push('Arquivo não contém data de exportação');
            }

            // Check for at least one data type
            const hasData = ['accounts', 'transactions', 'trips', 'budgets', 'goals', 'familyMembers', 'assets', 'snapshots', 'customCategories']
                .some(key => Array.isArray(data[key]) && data[key].length > 0);

            if (!hasData) {
                errors.push('Arquivo não contém dados válidos para importar');
            }

            setValidationErrors(errors);

            if (errors.length === 0) {
                setImportData(data);
                addToast('Arquivo validado com sucesso!', 'success');
            } else {
                addToast('Arquivo contém erros de validação', 'error');
            }
        } catch (error) {
            setValidationErrors(['Erro ao ler arquivo: formato JSON inválido']);
            addToast('Erro ao ler arquivo JSON!', 'error');
        } finally {
            setIsValidating(false);
        }
    };

    const handleImport = async () => {
        if (!importData) return;

        setIsImporting(true);
        try {
            await onImportComplete(importData, mergeMode);
            addToast('Dados importados com sucesso!', 'success');

            // Reset state
            setSelectedFile(null);
            setImportData(null);
            setValidationErrors([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error: any) {
            addToast(error.message || 'Erro ao importar dados', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const getDataSummary = () => {
        if (!importData) return null;

        const summary = [];
        if (importData.accounts?.length) summary.push(`${importData.accounts.length} contas`);
        if (importData.transactions?.length) summary.push(`${importData.transactions.length} transações`);
        if (importData.trips?.length) summary.push(`${importData.trips.length} viagens`);
        if (importData.budgets?.length) summary.push(`${importData.budgets.length} orçamentos`);
        if (importData.goals?.length) summary.push(`${importData.goals.length} metas`);
        if (importData.familyMembers?.length) summary.push(`${importData.familyMembers.length} membros`);
        if (importData.assets?.length) summary.push(`${importData.assets.length} ativos`);
        if (importData.snapshots?.length) summary.push(`${importData.snapshots.length} snapshots`);
        if (importData.customCategories?.length) summary.push(`${importData.customCategories.length} categorias`);

        return summary.join(', ');
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <Upload className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Importar Dados</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Restaure seus dados de um backup JSON.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* File Upload */}
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="import-file"
                        />
                        <label
                            htmlFor="import-file"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        >
                            <FileJson className="w-10 h-10 text-slate-400 mb-2" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {selectedFile ? selectedFile.name : 'Clique para selecionar um arquivo JSON'}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                Apenas arquivos .json são aceitos
                            </span>
                        </label>
                    </div>

                    {/* Validation Status */}
                    {isValidating && (
                        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                            <Loader className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                Validando arquivo...
                            </span>
                        </div>
                    )}

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                                        Erros de Validação:
                                    </p>
                                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                        {validationErrors.map((error, index) => (
                                            <li key={index}>• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success & Data Summary */}
                    {importData && validationErrors.length === 0 && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                            <div className="flex items-start gap-3 mb-4">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">
                                        Arquivo Válido!
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        {getDataSummary()}
                                    </p>
                                    {importData.exportedAt && (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                            Exportado em: {new Date(importData.exportedAt).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Import Mode Selection */}
                            <div className="space-y-3 mb-4">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Modo de Importação:
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setMergeMode(true)}
                                        className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${mergeMode
                                                ? 'bg-emerald-600 text-white shadow-lg'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        Mesclar
                                        <span className="block text-xs opacity-75 mt-1">
                                            Adicionar aos dados existentes
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setMergeMode(false)}
                                        className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${!mergeMode
                                                ? 'bg-red-600 text-white shadow-lg'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        Substituir
                                        <span className="block text-xs opacity-75 mt-1">
                                            Apagar dados atuais
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Import Button */}
                            <Button
                                onClick={handleImport}
                                disabled={isImporting}
                                className="w-full gap-2"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Importar Dados
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            <strong>⚠️ Atenção:</strong> Certifique-se de fazer um backup dos seus dados atuais antes
                            de importar, especialmente se escolher o modo "Substituir".
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
