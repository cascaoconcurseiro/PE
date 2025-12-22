import { useState, useEffect } from 'react';
import { useToast } from '../components/ui/Toast';

/**
 * Hook para gerenciamento de status de rede
 * Extraído do useDataStore para reduzir complexidade
 */
export const useNetworkStatus = () => {
    const { addToast } = useToast();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addToast('Você está online.', 'success');
        };
        
        const handleOffline = () => {
            setIsOnline(false);
            addToast('Você está offline. Funcionalidades limitadas.', 'warning');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [addToast]);

    return { isOnline };
};