import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../ui/Toast';

export const ServiceWorkerUpdater: React.FC = () => {
    const { addToast } = useToast();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            console.log('🔄 Nova versão detectada! Atualizando...');
            addToast('Nova versão disponível! Atualizando...', 'info');
            updateServiceWorker(true);
        }
    }, [needRefresh, updateServiceWorker, addToast]);

    return null; // Headless component
};
