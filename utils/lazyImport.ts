import { lazy, ComponentType } from 'react';

// This utility wraps React.lazy to handle ChunkLoadErrors automatically.
// If a new deployment happens, old chunks (filename hashes) disappear.
// This wrapper catches the error and reloads the page to fetch the new index.html.

export const lazyImport = <T extends ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>
) => {
    return lazy(async () => {
        try {
            return await importFunction();
        } catch (error: any) {
            console.error('Lazy import failed:', error);

            // Check if it's a chunk load error
            if (error.message && (
                error.message.includes('Failed to fetch dynamically imported module') ||
                error.message.includes('Importing a module script failed') ||
                error.message.includes('missing') ||
                error.name === 'ChunkLoadError'
            )) {
                // Prevent infinite reload loop using sessionStorage
                const storageKey = `lazy_reload_${window.location.pathname}`;
                const reloadCount = parseInt(sessionStorage.getItem(storageKey) || '0');

                if (reloadCount < 1) {
                    console.warn('Chunk missing. Reloading page to get fresh version...');
                    sessionStorage.setItem(storageKey, '1');
                    window.location.reload();
                    // Return a never-resolving promise to wait for reload
                    return new Promise(() => { });
                } else {
                    console.error('Reloaded once but still failed. Giving up.');
                }
            }

            throw error;
        }
    });
};
