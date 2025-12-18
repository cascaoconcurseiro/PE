import { lazy, ComponentType } from 'react';
import { logger } from '../services/logger';

// This utility wraps React.lazy to handle ChunkLoadErrors automatically.
// If a new deployment happens, old chunks (filename hashes) disappear.
// This wrapper catches the error and reloads the page to fetch the new index.html.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyImport = <T extends ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>
) => {
    return lazy(async () => {
        try {
            return await importFunction();
        } catch (error) {
            logger.error('Lazy import failed', error);
            const err = error as Error;

            // Check if it's a chunk load error
            if (err.message && (
                err.message.includes('Failed to fetch dynamically imported module') ||
                err.message.includes('Importing a module script failed') ||
                err.name === 'ChunkLoadError'
            )) {
                // Prevent infinite reload loop using URL Search Params
                // This is safer than sessionStorage which might be blocked in incognito/iframes
                const url = new URL(window.location.href);
                const hasRetried = url.searchParams.get('lazy_retry');

                if (!hasRetried) {
                    logger.warn('Chunk missing. Reloading page to get fresh version...');
                    url.searchParams.set('lazy_retry', 'true');
                    window.location.replace(url.toString());

                    // Return a never-resolving promise to wait for reload
                    return new Promise(() => { });
                } else {
                    logger.error('Reloaded once but still failed. Giving up.');
                }
            }

            throw error;
        }
    });
};
