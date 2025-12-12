import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Carregando...</p>
            </div>
        </div>
    );
};
