import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../components/ui/Toast';

export interface SystemNotification {
    id: string;
    title: string;
    message: string;
    type: 'SYSTEM' | 'INVITE' | 'TRANSACTION' | 'ALERT';
    read_at: string | null;
    created_at: string;
    metadata?: any;
}

export const useSystemNotifications = (userId: string | undefined) => {
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const { addToast } = useToast();

    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', userId)
            .is('read_at', null) // Only unread by default for the bell
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            return;
        }

        setNotifications(data || []);
    }, [userId]);

    // Real-time subscription
    useEffect(() => {
        if (!userId) return;

        fetchNotifications();

        const subscription = supabase
            .channel('public:user_notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotif = payload.new as SystemNotification;
                    setNotifications(prev => [newNotif, ...prev]);
                    addToast(newNotif.title, 'info'); // Pop-up toast for new items
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userId, fetchNotifications, addToast]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.filter(n => n.id !== id));

        const { error } = await supabase
            .from('user_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Error marking as read:', error);
            fetchNotifications(); // Revert on error
        }
    };

    const markAllAsRead = async () => {
        const ids = notifications.map(n => n.id);
        setNotifications([]);

        const { error } = await supabase
            .from('user_notifications')
            .update({ read_at: new Date().toISOString() })
            .in('id', ids);

        if (error) {
            console.error('Error marking all as read:', error);
            fetchNotifications();
        }
    };

    return {
        systemNotifications: notifications,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications
    };
};
