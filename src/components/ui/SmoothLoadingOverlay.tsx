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
            {/* Conteúdo principal - sempre visível, apenas com opacity reduzida durante loading */}
            <div className={`transition-opacity duration-300 ease-in-out ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                {children}
            </div>
            
            {/* Overlay de loading - fade in/out suave */}
            <div className={`absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-slate-900/10 backdrop-blur-[1px] rounded-2xl z-10 transition-all duration-300 ease-in-out ${isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 transition-all duration-300 ${isLoading ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {loadingText}
                    </span>
                </div>
            </div>
        </div>
    );
};