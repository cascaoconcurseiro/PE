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
        registerType: 'autoUpdate',
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
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
        '@': path.resolve(__dirname, './'),
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
              './components/Dashboard.tsx',
              './components/dashboard/FinancialProjectionCard.tsx',
              './components/dashboard/SummaryCards.tsx',
              './components/dashboard/CashFlowChart.tsx',
              './components/dashboard/UpcomingBills.tsx',
              './components/dashboard/CategorySpendingChart.tsx',
            ],
            'components-transactions': [
              './components/Transactions.tsx',
              './components/transactions/TransactionList.tsx',
              './components/transactions/TransactionForm.tsx',
              './components/transactions/TransactionSummary.tsx',
            ],
            'components-accounts': [
              './components/Accounts.tsx',
              './components/accounts/AccountForm.tsx',
              './components/accounts/CreditCardImportModal.tsx',
            ],
            'components-reports': [
              './components/Reports.tsx',
              './components/reports/SharedExpensesReport.tsx',
              './components/reports/TravelReport.tsx',
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