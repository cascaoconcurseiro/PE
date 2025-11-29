import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    isDanger = false,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onCancel} />
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${isDanger ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>

                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onCancel} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent">
                        {cancelLabel}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className={`flex-1 ${isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'} text-white shadow-lg`}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};
