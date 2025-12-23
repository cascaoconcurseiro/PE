import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000); // Auto dismiss after 5s
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right duration-300 ${toast.type === 'success' ? 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400' :
                            toast.type === 'error' ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900 text-red-800 dark:text-red-400' :
                                toast.type === 'warning' ? 'bg-white dark:bg-slate-800 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-400' :
                                    'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900 text-blue-800 dark:text-blue-400'
                            }`}
                    >
                        <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                            toast.type === 'error' ? 'bg-red-100 text-red-600' :
                                toast.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                            }`}>
                            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
                            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
                            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                            {toast.type === 'info' && <Info className="w-4 h-4" />}
                        </div>
                        <p className="text-sm font-medium">{toast.message}</p>
                        <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
