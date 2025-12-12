import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-6 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
