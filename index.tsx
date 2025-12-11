import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { SettingsProvider } from './hooks/useSettings';
import { ErrorTrackerProvider } from './hooks/useErrorTracker';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Root mounting logic
const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element not found (index.tsx)');
}

// IMPORTANT: Clear any existing content (like the loading spinner)
// before React takes control. This prevents hydration mismatches.
container.innerHTML = '';

// 🚨 FORCE UNREGISTER SERVICE WORKERS 🚨
// Previous versions might have installed a SW that is now blocked by storage policies
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            console.log('🗑️ Desregistrando Service Worker obsoleto:', registration);
            registration.unregister();
        }
    }).catch(function (err) {
        console.error('Erro ao limpar Service Workers:', err);
    });
}

const root = createRoot(container);
root.render(
    <ErrorTrackerProvider>
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <SettingsProvider>
                        <App />
                    </SettingsProvider>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </ErrorTrackerProvider>
);
