import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    envPrefix: ['VITE_', 'SUPABASE_'],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react({
        // Performance: Optimize JSX runtime
        jsxRuntime: 'automatic',
      }),
      VitePWA({
        injectRegister: 'auto', // Auto injection
        registerType: 'autoUpdate', // Explicitly auto update
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Pé de Meia - Finanças Pessoais',
          short_name: 'Pé de Meia',
          description: 'Sistema completo de gestão financeira pessoal',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'], // Exclude HTML from precache to ensure fresh index
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                expiration: {
                  maxEntries: 1,
                  maxAgeSeconds: 0 // Do not cache index.html
                }
              }
            }
          ]
        }
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024, // Only compress files larger than 1KB
        deleteOriginFile: false
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/auth-ui-react', '@supabase/auth-ui-shared'],
      // Performance: Force pre-bundling of large dependencies
      force: true
    },
    build: {
      // Performance: Reduce chunk size warnings
      chunkSizeWarningLimit: 1000,

      // Performance: Enable minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.logs in production
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: true,
        format: {
          comments: false, // Remove comments
        },
      },

      // Performance: Optimize CSS
      cssMinify: true,
      cssCodeSplit: true,

      // Performance: Manual chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'supabase-vendor': ['@supabase/supabase-js', '@supabase/auth-ui-react', '@supabase/auth-ui-shared'],
            'charts-vendor': ['recharts'],
            'icons-vendor': ['lucide-react'],

            // Feature chunks
            'components-dashboard': [
              './src/features/dashboard/Dashboard.tsx',
              // './src/components/dashboard/FinancialProjectionCard.tsx', // If these were moved, update them too. Or just remove strict chunking for now to be safe.
            ],
            'components-transactions': [
              './src/features/transactions/Transactions.tsx',
            ],
            'components-trips': [
              './src/features/trips/Trips.tsx'
            ],

          },
          // Performance: Optimize chunk file names
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },

      // Performance: Source maps only for errors
      sourcemap: mode === 'production' ? false : true,

      // Performance: Target modern browsers
      target: 'es2020',

      // Performance: Enable tree shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },

    // Performance: Enable esbuild for faster builds
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      legalComments: 'none',
    },
  };
});