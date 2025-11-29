import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
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
          // Força todas as dependências a usarem a mesma cópia do React da pasta raiz
          react: path.resolve(__dirname, './node_modules/react'),
          'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        }
      },
      // Garante que o Supabase UI seja processado corretamente
      optimizeDeps: {
        include: ['react', 'react-dom', '@supabase/auth-ui-react', '@supabase/auth-ui-shared']
      }
    };
});