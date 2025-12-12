import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        copied: false
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        // Enhanced logging
        console.group('🔴 ErrorBoundary Caught Error');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();

        // Store error in localStorage for persistence across reloads
        // try {
        //     const errorReport = {
        //         message: error.message,
        //         stack: error.stack,
        //         componentStack: errorInfo.componentStack,
        //         timestamp: new Date().toISOString(),
        //         url: window.location.href
        //     };
        //     const existingErrors = JSON.parse(localStorage.getItem('__app_errors__') || '[]');
        //     existingErrors.unshift(errorReport);
        //     localStorage.setItem('__app_errors__', JSON.stringify(existingErrors.slice(0, 10)));
        // } catch (e) {
        //     // Ignore storage errors
        // }
    }

    private getErrorReport = () => {
        const { error, errorInfo } = this.state;
        return `
=== ERROR REPORT ===
Time: ${new Date().toISOString()}
URL: ${window.location.href}
UserAgent: ${navigator.userAgent}

ERROR: ${error?.message}

STACK TRACE:
${error?.stack}

COMPONENT STACK:
${errorInfo?.componentStack}
==================
        `.trim();
    };

    private copyErrorReport = async () => {
        try {
            await navigator.clipboard.writeText(this.getErrorReport());
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ops! Algo deu errado.</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Ocorreu um erro inesperado. Tente recarregar a página.
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-left mb-4 overflow-auto max-h-24">
                                <code className="text-xs text-red-600 dark:text-red-400 font-mono block font-bold">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        {this.state.errorInfo && (
                            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-left mb-6 overflow-auto max-h-48">
                                <p className="text-xs font-bold text-slate-500 mb-2">Component Stack:</p>
                                <pre className="text-[10px] text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.copyErrorReport}
                                className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                {this.state.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {this.state.copied ? 'Copiado!' : 'Copiar Erro'}
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Recarregar
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
