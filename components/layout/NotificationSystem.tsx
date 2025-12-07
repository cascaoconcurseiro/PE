import React, { useState } from 'react';
import { Bell, BellRing, Sparkles, AlertTriangle } from 'lucide-react';
import { Transaction } from '../../types';

interface NotificationSystemProps {
    notifications: Transaction[];
    onNotificationClick: (id: string) => void;
    onNotificationDismiss: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onNotificationClick, onNotificationDismiss }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative shadow-sm active:scale-95"
            >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {notifications.length > 0 && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-12 w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Notificações
                            </h3>
                            <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                {notifications.length}
                            </span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-xs">Tudo tranquilo.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {notifications.map(n => {
                                        const isOverdue = !n.enableNotification;
                                        const dueDate = new Date(n.notificationDate || n.date);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        dueDate.setHours(0, 0, 0, 0);
                                        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

                                        return (
                                            <div key={n.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex gap-3">
                                                <div className={`mt-1 p-1.5 rounded-lg h-fit ${isOverdue
                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                    }`}>
                                                    <AlertTriangle className="w-3 h-3" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{n.description}</p>
                                                    <p className="text-[10px] mb-2">
                                                        {isOverdue ? (
                                                            <span className="text-red-600 dark:text-red-400 font-bold">
                                                                {daysOverdue === 0 ? 'Vence hoje!' : `Vencida há ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">
                                                                Vence: {dueDate.toLocaleDateString('pt-BR')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => { onNotificationClick(n.id); setIsOpen(false); }}
                                                            className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${isOverdue
                                                                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40'
                                                                : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                                                }`}
                                                        >
                                                            {isOverdue ? 'Pagar Agora' : 'Ver Detalhes'}
                                                        </button>
                                                        <button
                                                            onClick={() => onNotificationDismiss(n.id)}
                                                            className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                        >
                                                            Dispensar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
