import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

export interface UserNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
    data?: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
}

export const useSystemNotifications = (userId: string | undefined) => {
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        if (!userId) return;
        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            const logger = (await import('../services/logger')).logger;
            logger.error('Error fetching notifications', error);
            return;
        }

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) {
            const logger = (await import('../utils/logger')).logger;
            logger.error('Error marking notification as read', error);
            // Revert if needed, but low impact
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);

        await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);
    };

    const deleteNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // If it was unread, decrement count
        const wasUnread = notifications.find(n => n.id === id && !n.is_read);
        if (wasUnread) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }

        const { error } = await supabase
            .from('user_notifications')
            .delete()
            .eq('id', id);

        if (error) {
            const logger = (await import('../utils/logger')).logger;
            logger.error('Error deleting notification', error);
        }
    };

    const clearAllNotifications = async () => {
        // Optimistic clear
        setNotifications([]);
        setUnreadCount(0);

        const { error } = await supabase
            .from('user_notifications')
            .delete()
            .eq('user_id', userId);

        if (error) {
            const logger = (await import('../utils/logger')).logger;
            logger.error('Error clearing notifications', error);
        }
    };

    // Initial Fetch
    useEffect(() => {
        fetchNotifications();
    }, [userId]);

    // Realtime Subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('public:user_notifications')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const newNotif = payload.new as UserNotification;
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // Optional: Native Browser Notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(newNotif.title, { body: newNotif.message });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        refresh: fetchNotifications
    };
};
