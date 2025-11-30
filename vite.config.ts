import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      }
    },
    // Security Note:
    // DO NOT use the 'define' plugin to inject sensitive API keys (like GEMINI_API_KEY) here.
    // Doing so would bundle the key into the client-side code, exposing it to anyone.
    // Keys should be handled via user input in the UI (saved to localStorage) or via a secure backend proxy.
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/auth-ui-react', '@supabase/auth-ui-shared']
    },
    build: {
      chunkSizeWarningLimit: 1600,
    }
  };
});