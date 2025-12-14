import React, { useState } from 'react';
import { Bell, BellRing, Sparkles, AlertTriangle, CheckCheck } from 'lucide-react';
import { useSystemNotifications } from '../../hooks/useSystemNotifications';

interface NotificationItem {
    id: string;
    title?: string;
    description: string;
    date: string;
    amount?: number;
    type: string;
    enableNotification?: boolean;
    notificationDate?: string;
}

interface NotificationSystemProps {
    notifications?: NotificationItem[];
    onNotificationClick: (id: string) => void;
    onNotificationDismiss: (id: string) => void;
    onNotificationPay?: (id: string) => void;
    userId?: string;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications: legacyNotifications = [], onNotificationClick, onNotificationDismiss, onNotificationPay, userId }) => {
    const { notifications: dbNotifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useSystemNotifications(userId);
    const [isOpen, setIsOpen] = useState(false);

    const dbItems = dbNotifications.map(n => ({
        id: n.id,
        title: n.title,
        description: n.message,
        date: n.created_at,
        type: n.type,
        read: n.is_read,
        isDb: true
    }));

    // Legacy transformation
    const legacyItems = legacyNotifications.map(n => ({
        id: n.id,
        title: n.title || 'Lembrete',
        description: n.description,
        date: n.date,
        type: n.type || 'REMINDER',
        read: false,
        isDb: false
    }));

    const displayList = [...dbItems, ...legacyItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalUnread = unreadCount + legacyNotifications.length;

    const handleDismiss = (id: string, isDb: boolean) => {
        if (isDb) {
            deleteNotification(id);
        } else {
            onNotificationDismiss(id);
        }
    };

    const handleClick = (id: string, isDb: boolean) => {
        // 1. Navigation Logic (Parent)
        onNotificationClick(id);

        // 2. Mark as Read (DB)
        if (isDb) {
            markAsRead(id);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative shadow-sm active:scale-95"
            >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {totalUnread > 0 && (
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
                            <div className="flex gap-2">
                                <button onClick={() => markAllAsRead()} className="text-[10px] text-indigo-600 hover:underline">Ler todas</button>
                                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                    {totalUnread}
                                </span>
                            </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {displayList.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-xs">Tudo tranquilo.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {displayList.map(n => {
                                        const isSystem = type => type === 'TRANSACTION' || type === 'TRIP';
                                        const systemItem = isSystem(n.type);

                                        return (
                                            <div key={n.id} className={`p-3 transition-colors flex gap-3 ${n.read ? 'opacity-60 bg-white' : 'bg-indigo-50/30 hover:bg-indigo-50/50'}`}>
                                                <div className={`mt-1 p-1.5 rounded-lg h-fit ${systemItem ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {systemItem ? <BellRing className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{n.title}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{n.description}</p>
                                                    <p className="text-[10px] mt-1 text-slate-400">
                                                        {new Date(n.date).toLocaleDateString()} {new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>

                                                    <div className="flex gap-2 mt-2">
                                                        {systemItem ? (
                                                            <button
                                                                onClick={() => handleClick(n.id, n.isDb)}
                                                                className="text-[10px] font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50"
                                                            >
                                                                {n.type === 'TRANSACTION' ? 'Ver Despesa' : (n.type === 'TRIP' ? 'Ver Viagem' : 'Ver')}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleClick(n.id, n.isDb)}
                                                                className="text-[10px] font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50"
                                                            >
                                                                Ver
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDismiss(n.id, n.isDb)}
                                                            className="text-[10px] text-slate-400 hover:text-slate-600"
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
