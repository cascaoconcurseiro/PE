/**
 * Setup file for Vitest
 * Configures test environment and global mocks
 */

import { vi } from 'vitest';

// Mock crypto.randomUUID for consistent test IDs
if (!globalThis.crypto) {
    globalThis.crypto = {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
    } as Crypto;
}

// Mock import.meta.env
vi.stubGlobal('import.meta', {
    env: {
        DEV: true,
        PROD: false,
        MODE: 'test'
    }
});

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
});

// Suppress console during tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});
