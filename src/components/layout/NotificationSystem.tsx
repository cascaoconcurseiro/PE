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

    // Merge: Prefer DB notifications, fallback to legacy if DB is empty? 
    // Or display both? 
    // Legacy comes from useNotifications (local reminders).
    // DB comes from server.
    // Let's combine them for the list.

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
    const totalUnread = unreadCount + legacyNotifications.length; // Approximate

    const handleDismiss = (id: string, isDb: boolean) => {
        if (isDb) {
            deleteNotification(id);
        } else {
            onNotificationDismiss(id);
        }
    };

    const handleClick = (id: string, isDb: boolean) => {
        // Always pass to parent for navigation logic
        onNotificationClick(id);

        // Also mark as read in background if DB
        if (isDb) {
            markAsRead(id);
        }
        setIsOpen(false);
    };

    return (
        // ... (omitted) ...
        <div className="flex gap-2 mt-2">
            {isSystem ? (
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
                                                </div >
                                            </div >
                                        );
                                    })}
                                </div >
                            )}
                        </div >
                    </div >
                </>
            )}
        </div >
    );
};
