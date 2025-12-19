import React, { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Upload, FileJson, CheckCircle, AlertCircle, Loader, ShieldAlert } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { BackupSchema } from '../../services/schemas';
import { z } from 'zod';

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

// Security: Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Security: Maximum number of records per entity type
const MAX_RECORDS = {
    accounts: 100,
    transactions: 50000,
    trips: 500,
    budgets: 100,
    goals: 100,
    familyMembers: 50,
    assets: 1000,
    snapshots: 365,
    customCategories: 100,
};

/**
 * Sanitize string to prevent XSS and injection attacks
 */
const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim()
        .slice(0, 1000); // Limit string length
};

/**
 * Sanitize an object recursively
 */
const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'number') {
            // Validate number is finite and within reasonable bounds
            sanitized[key] = Number.isFinite(value) ? Math.max(-1e12, Math.min(1e12, value)) : 0;
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item => 
                typeof item === 'object' && item !== null 
                    ? sanitizeObject(item as Record<string, unknown>)
                    : typeof item === 'string' 
                        ? sanitizeString(item)
                        : item
            );
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized as T;
};

/**
 * Validate UUID format
 */
const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

/**
 * Validate date format (ISO 8601)
 */
const isValidDate = (date: string): boolean => {
    const parsed = Date.parse(date);
    return !isNaN(parsed) && parsed > 0 && parsed < Date.now() + 365 * 24 * 60 * 60 * 1000 * 10; // Max 10 years in future
};

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

        // Security: Validate file extension
        if (!file.name.endsWith('.json')) {
            addToast('Por favor, selecione um arquivo JSON válido!', 'error');
            return;
        }

        // Security: Validate file size
        if (file.size > MAX_FILE_SIZE) {
            addToast(`Arquivo muito grande! Máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
            return;
        }

        // Security: Validate MIME type
        if (file.type && !['application/json', 'text/json', 'text/plain'].includes(file.type)) {
            addToast('Tipo de arquivo inválido!', 'error');
            return;
        }

        setSelectedFile(file);
        setIsValidating(true);
        setValidationErrors([]);

        try {
            const text = await file.text();
            
            // Security: Basic JSON structure validation before parsing
            if (!text.trim().startsWith('{') || !text.trim().endsWith('}')) {
                throw new Error('Formato JSON inválido');
            }

            let data: unknown;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('JSON malformado - verifique a sintaxe do arquivo');
            }

            // Security: Ensure it's an object
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new Error('Formato de backup inválido - esperado um objeto');
            }

            const errors: string[] = [];
            const warnings: string[] = [];

            // Validate with Zod schema (type-safe validation)
            const schemaResult = BackupSchema.safeParse(data);
            
            if (!schemaResult.success) {
                // Extract meaningful error messages from Zod
                const zodIssues = schemaResult.error.issues;
                const zodErrors = zodIssues.slice(0, 5).map((issue: z.ZodIssue) => 
                    `${issue.path.join('.')}: ${issue.message}`
                );
                errors.push(...zodErrors);
                
                if (zodIssues.length > 5) {
                    errors.push(`... e mais ${zodIssues.length - 5} erros`);
                }
            }

            const typedData = data as Record<string, unknown>;

            // Security: Validate record counts
            const entityKeys = ['accounts', 'transactions', 'trips', 'budgets', 'goals', 'familyMembers', 'assets', 'snapshots', 'customCategories'] as const;
            
            for (const key of entityKeys) {
                const records = typedData[key];
                if (Array.isArray(records)) {
                    const maxAllowed = MAX_RECORDS[key];
                    if (records.length > maxAllowed) {
                        errors.push(`${key}: máximo de ${maxAllowed} registros permitidos (encontrado: ${records.length})`);
                    }
                    
                    // Security: Validate IDs are proper UUIDs
                    const invalidIds = records.filter((r: unknown) => {
                        const record = r as Record<string, unknown>;
                        return record.id && typeof record.id === 'string' && !isValidUUID(record.id);
                    });
                    
                    if (invalidIds.length > 0) {
                        warnings.push(`${key}: ${invalidIds.length} registro(s) com ID inválido serão regenerados`);
                    }
                }
            }

            // Validate version and export date
            if (!typedData.version) {
                warnings.push('Arquivo não contém informação de versão');
            }

            if (!typedData.exportedAt) {
                warnings.push('Arquivo não contém data de exportação');
            } else if (typeof typedData.exportedAt === 'string' && !isValidDate(typedData.exportedAt)) {
                warnings.push('Data de exportação inválida');
            }

            // Check for at least one data type
            const hasData = entityKeys.some(key => {
                const records = typedData[key];
                return Array.isArray(records) && records.length > 0;
            });

            if (!hasData) {
                errors.push('Arquivo não contém dados válidos para importar');
            }

            setValidationErrors(errors);

            if (errors.length === 0) {
                // Security: Sanitize all data before storing
                const sanitizedData = sanitizeObject(typedData as Record<string, unknown>) as ImportData;
                
                // Regenerate invalid UUIDs
                for (const key of entityKeys) {
                    const records = sanitizedData[key as keyof ImportData];
                    if (Array.isArray(records)) {
                        records.forEach((record: { id?: string }) => {
                            if (!record.id || !isValidUUID(record.id)) {
                                record.id = crypto.randomUUID();
                            }
                        });
                    }
                }
                
                setImportData(sanitizedData);
                
                if (warnings.length > 0) {
                    addToast(`Arquivo validado com ${warnings.length} aviso(s)`, 'warning');
                } else {
                    addToast('Arquivo validado com sucesso!', 'success');
                }
            } else {
                addToast('Arquivo contém erros de validação', 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            setValidationErrors([`Erro ao processar arquivo: ${message}`]);
            addToast('Erro ao processar arquivo!', 'error');
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

                    {/* Security Warning */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                <p className="font-bold mb-1">Segurança da Importação:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Apenas arquivos JSON de até 10MB são aceitos</li>
                                    <li>Todos os dados são validados e sanitizados</li>
                                    <li>IDs inválidos são regenerados automaticamente</li>
                                    <li>Importe apenas arquivos de fontes confiáveis</li>
                                </ul>
                            </div>
                        </div>
                    </div>

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
