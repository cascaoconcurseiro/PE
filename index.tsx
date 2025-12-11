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

// VERSION MARKER - DEBUGGING
console.log('🚀 APP VERSION: v2.0 (STRICT FILTERING + PWA ENABLED) - Loaded at ' + new Date().toLocaleTimeString());

// NOTE: PWA Auto-Update is handled by vite-plugin-pwa. Do not manually unregister workers here,
// as it conflicts with the auto-update strategy.
if ('serviceWorker' in navigator) {
    // Just log for debugging
    navigator.serviceWorker.getRegistrations().then(regs => {
        console.log('📱 Active Service Workers:', regs.length);
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
