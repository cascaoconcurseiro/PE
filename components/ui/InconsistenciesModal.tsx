import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from './Button';

interface InconsistencyIssue {
    message: string;
    transactionId?: string;
    accountId?: string;
    type: 'orphan' | 'circular' | 'missing_account' | 'invalid_transfer' | 'other';
}

interface InconsistenciesModalProps {
    isOpen: boolean;
    onClose: () => void;
    issues: string[];
    onNavigateToTransaction?: (id: string) => void;
}

// Parse issue string to extract structured data
const parseIssue = (issue: string): InconsistencyIssue => {
    // Extract transaction ID if present
    const txIdMatch = issue.match(/transação[:\s]+([a-f0-9-]{36})/i);
    const accountIdMatch = issue.match(/conta ([a-f0-9-]{36})/i);

    let type: InconsistencyIssue['type'] = 'other';
    if (issue.includes('órfã') || issue.includes('não existe')) type = 'orphan';
    if (issue.includes('circular')) type = 'circular';
    if (issue.includes('conta') && issue.includes('não encontrada')) type = 'missing_account';
    if (issue.includes('transferência') && issue.includes('destino')) type = 'invalid_transfer';

    return {
        message: issue,
        transactionId: txIdMatch?.[1],
        accountId: accountIdMatch?.[1],
        type
    };
};

const getIssueIcon = (type: InconsistencyIssue['type']) => {
    const iconClass = "w-5 h-5";
    switch (type) {
        case 'orphan':
            return <AlertTriangle className={`${iconClass} text-red-600 dark:text-red-400`} />;
        case 'circular':
            return <AlertTriangle className={`${iconClass} text-orange-600 dark:text-orange-400`} />;
        case 'missing_account':
            return <AlertTriangle className={`${iconClass} text-amber-600 dark:text-amber-400`} />;
        case 'invalid_transfer':
            return <AlertTriangle className={`${iconClass} text-yellow-600 dark:text-yellow-400`} />;
        default:
            return <AlertTriangle className={`${iconClass} text-slate-600 dark:text-slate-400`} />;
    }
};

export const InconsistenciesModal: React.FC<InconsistenciesModalProps> = ({
    isOpen,
    onClose,
    issues,
    onNavigateToTransaction
}) => {
    const parsedIssues = issues.map(parseIssue);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inconsistências de Dados">
            <div className="space-y-4">
                {issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-full mb-4">
                            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                            Tudo Certo!
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nenhuma inconsistência detectada nos seus dados.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">
                                    {issues.length} Problema{issues.length !== 1 ? 's' : ''} Detectado{issues.length !== 1 ? 's' : ''}
                                </h4>
                                <p className="text-sm text-amber-800 dark:text-amber-400">
                                    As seguintes inconsistências foram encontradas nos seus dados:
                                </p>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
                            {parsedIssues.map((issue, index) => (
                                <div
                                    key={index}
                                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="shrink-0 mt-0.5">
                                            {getIssueIcon(issue.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                                {issue.message}
                                            </p>
                                            {issue.transactionId && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                        ID: {issue.transactionId.slice(0, 8)}...
                                                    </span>
                                                </div>
                                            )}
                                            {issue.transactionId && onNavigateToTransaction && (
                                                <button
                                                    onClick={() => {
                                                        onNavigateToTransaction(issue.transactionId!);
                                                        onClose();
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Ver Transação
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>💡 Dica:</strong> Essas inconsistências podem ter sido causadas por exclusão de contas ou dados corrompidos.
                                Clique em "Ver Transação" para localizar e corrigir cada problema.
                            </p>
                        </div>
                    </>
                )}

                <Button onClick={onClose} variant="primary" className="w-full">
                    Entendi
                </Button>
            </div>
        </Modal>
    );
};
