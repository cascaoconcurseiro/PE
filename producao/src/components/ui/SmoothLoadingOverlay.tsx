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
            {/* Conteúdo principal - sempre visível, sem opacity reduzida */}
            <div className="transition-opacity duration-150 ease-out">
                {children}
            </div>
            
            {/* Overlay de loading minimalista - apenas um indicador discreto no canto */}
            {isLoading && (
                <div className="absolute top-2 right-2 z-10 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-500 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {loadingText}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};