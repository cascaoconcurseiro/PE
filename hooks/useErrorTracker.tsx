import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { X, AlertTriangle, Copy, Check, Bug } from 'lucide-react';

interface TrackedError {
    id: string;
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: Date;
    url: string;
    type: 'runtime' | 'promise' | 'react';
}

interface ErrorTrackerContextType {
    errors: TrackedError[];
    addError: (error: Error, type?: TrackedError['type'], componentStack?: string) => void;
    clearErrors: () => void;
    showPanel: boolean;
    setShowPanel: (show: boolean) => void;
}

const ErrorTrackerContext = createContext<ErrorTrackerContextType | null>(null);

export const useErrorTracker = () => {
    const ctx = useContext(ErrorTrackerContext);
    if (!ctx) throw new Error('useErrorTracker must be used within ErrorTrackerProvider');
    return ctx;
};

// Decode React minified error codes
const decodeReactError = (message: string): string => {
    const match = message.match(/Minified React error #(\d+)/);
    if (!match) return message;
    
    const errorCodes: Record<string, string> = {
        '310': 'Rendered more hooks than during the previous render. Hooks must be called in the same order every render.',
        '300': 'Invalid hook call. Hooks can only be called inside of the body of a function component.',
        '321': 'Too many re-renders. React limits the number of renders to prevent an infinite loop.',
        '185': 'Maximum update depth exceeded. This can happen when a component calls setState inside useEffect.',
        '423': 'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.',
        '31': 'Objects are not valid as a React child. Use an array or wrap the object using createFragment.',
    };
    
    const code = match[1];
    return errorCodes[code] || `React Error #${code} - Check https://reactjs.org/docs/error-decoder.html?invariant=${code}`;
};

// Extract component name from stack
const extractComponentFromStack = (stack?: string): string | null => {
    if (!stack) return null;
    
    // Look for component names in the stack
    const componentMatch = stack.match(/at (\w+) \(/);
    if (componentMatch) return componentMatch[1];
    
    // Look for file names
    const fileMatch = stack.match(/\/([A-Z][a-zA-Z]+)\.(tsx?|jsx?):/);
    if (fileMatch) return fileMatch[1];
    
    return null;
};

export const ErrorTrackerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [errors, setErrors] = useState<TrackedError[]>([]);
    const [showPanel, setShowPanel] = useState(false);

    const addError = useCallback((error: Error, type: TrackedError['type'] = 'runtime', componentStack?: string) => {
        const newError: TrackedError = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: decodeReactError(error.message),
            stack: error.stack,
            componentStack,
            timestamp: new Date(),
            url: window.location.href,
            type
        };
        
        setErrors(prev => {
            // Avoid duplicates
            if (prev.some(e => e.message === newError.message && Date.now() - e.timestamp.getTime() < 5000)) {
                return prev;
            }
            return [newError, ...prev].slice(0, 20); // Keep last 20 errors
        });
        
        // Auto-show panel on new error
        setShowPanel(true);
    }, []);

    const clearErrors = useCallback(() => {
        setErrors([]);
        setShowPanel(false);
    }, []);

    // Global error handlers
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            addError(event.error || new Error(event.message), 'runtime');
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason instanceof Error 
                ? event.reason 
                : new Error(String(event.reason));
            addError(error, 'promise');
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [addError]);

    return (
        <ErrorTrackerContext.Provider value={{ errors, addError, clearErrors, showPanel, setShowPanel }}>
            {children}
            {showPanel && errors.length > 0 && <ErrorPanel />}
        </ErrorTrackerContext.Provider>
    );
};

const ErrorPanel: React.FC = () => {
    const { errors, clearErrors, setShowPanel } = useErrorTracker();
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const copyAllErrors = async () => {
        const report = errors.map(e => `
[${e.type.toUpperCase()}] ${e.timestamp.toISOString()}
URL: ${e.url}
Message: ${e.message}
${e.componentStack ? `Component Stack: ${e.componentStack}` : ''}
Stack: ${e.stack || 'N/A'}
---`).join('\n');

        try {
            await navigator.clipboard.writeText(report);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-900/30 px-4 py-3 flex items-center justify-between border-b border-red-100 dark:border-red-900">
                <div className="flex items-center gap-2">
                    <Bug className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-red-700 dark:text-red-400">
                        {errors.length} Erro{errors.length > 1 ? 's' : ''} Detectado{errors.length > 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={copyAllErrors}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                        title="Copiar todos os erros"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-red-500" />}
                    </button>
                    <button
                        onClick={() => setShowPanel(false)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>

            {/* Error List */}
            <div className="max-h-80 overflow-y-auto">
                {errors.map((error) => {
                    const component = extractComponentFromStack(error.stack || error.componentStack);
                    const isExpanded = expanded === error.id;
                    
                    return (
                        <div 
                            key={error.id} 
                            className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                            <button
                                onClick={() => setExpanded(isExpanded ? null : error.id)}
                                className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                error.type === 'react' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                error.type === 'promise' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                                {error.type.toUpperCase()}
                                            </span>
                                            {component && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                                    {component}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-400 ml-auto">
                                                {error.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                                            {error.message}
                                        </p>
                                    </div>
                                </div>
                            </button>
                            
                            {isExpanded && (
                                <div className="px-3 pb-3 animate-in fade-in">
                                    {error.componentStack && (
                                        <div className="mb-2">
                                            <p className="text-[10px] font-bold text-slate-500 mb-1">Component Stack:</p>
                                            <pre className="text-[9px] bg-slate-100 dark:bg-slate-800 p-2 rounded-lg overflow-x-auto text-slate-600 dark:text-slate-400 font-mono">
                                                {error.componentStack}
                                            </pre>
                                        </div>
                                    )}
                                    {error.stack && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 mb-1">Stack Trace:</p>
                                            <pre className="text-[9px] bg-slate-100 dark:bg-slate-800 p-2 rounded-lg overflow-x-auto text-slate-600 dark:text-slate-400 font-mono max-h-32">
                                                {error.stack}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                <button
                    onClick={clearErrors}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-red-500 transition-colors"
                >
                    Limpar Todos os Erros
                </button>
            </div>
        </div>
    );
};
