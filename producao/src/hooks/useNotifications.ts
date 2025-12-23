import { useEffect, useRef } from 'react';
import { Transaction } from '../types';

export const useNotifications = (
    transactions: Transaction[] | undefined,
    isMigrating: boolean
) => {
    const hasCheckedReminders = useRef(false);

    useEffect(() => {
        // Feature check
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (isMigrating || !transactions?.length || hasCheckedReminders.current) return;

        const checkReminders = () => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const reminders = transactions.filter(t =>
                t.enableNotification &&
                t.notificationDate === todayStr &&
                !t.isSettled // Assuming we don't notify if already paid?
            );

            if (reminders.length > 0 && Notification.permission === 'granted') {
                reminders.forEach(t => {
                    new Notification('Lembrete de Pagamento', {
                        body: `${t.description} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}`,
                        icon: '/icon-192.png'
                    });
                });
            }
            hasCheckedReminders.current = true;
        };

        const timer = setTimeout(checkReminders, 3000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions?.length]);
};
