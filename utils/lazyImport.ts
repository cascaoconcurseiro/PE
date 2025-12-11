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
                // Prevent infinite reload loop using URL Search Params
                // This is safer than sessionStorage which might be blocked in incognito/iframes
                const url = new URL(window.location.href);
                const hasRetried = url.searchParams.get('lazy_retry');

                if (!hasRetried) {
                    console.warn('Chunk missing. Reloading page to get fresh version...');
                    url.searchParams.set('lazy_retry', 'true');
                    window.location.replace(url.toString());

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
