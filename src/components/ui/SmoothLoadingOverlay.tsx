import React from 'react';
import { Loader2 } from 'lucide-react';

interface SmoothLoadingOverlayProps {
    isLoading: boolean;
    children: React.ReactNode;
    loadingText?: string;
    className?: string;
}

export const SmoothLoadingOverlay: React.FC<SmoothLoadingOverlayProps> = ({
    isLoading,
    children,
    loadingText = "Atualizando...",
    className = ""
}) => {
    return (
        <div className={`relative ${className}`}>
            {/* Conteúdo principal */}
            <div className={`transition-all duration-300 ${isLoading ? 'opacity-60 blur-[1px] pointer-events-none' : 'opacity-100 blur-0'}`}>
                {children}
            </div>
            
            {/* Overlay de loading */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/20 dark:bg-slate-900/20 backdrop-blur-[2px] rounded-2xl z-10 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {loadingText}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};