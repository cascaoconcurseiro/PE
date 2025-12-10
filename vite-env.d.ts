/// <reference types="vite/client" />

// Virtual module for vite-plugin-pwa
declare module 'virtual:pwa-register/react' {
    import type { Dispatch, SetStateAction } from 'react';

    export interface RegisterSWOptions {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
        onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
        onRegisterError?: (error: any) => void;
    }

    export function useRegisterSW(options?: RegisterSWOptions): {
        needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
        offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
        updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
    };
}

// Virtual module for Capacitor (only needed for type checking)
declare module '@capacitor/cli' {
    export interface CapacitorConfig {
        appId: string;
        appName: string;
        webDir: string;
        bundledWebRuntime?: boolean;
        server?: {
            url?: string;
            cleartext?: boolean;
        };
    }
}
