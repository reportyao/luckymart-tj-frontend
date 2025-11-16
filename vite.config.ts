import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'

export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
          'vendor-supabase': [
            '@supabase/supabase-js',
            '@supabase/auth-helpers-react',
          ],
          'vendor-telegram': ['@twa-dev/sdk'],
          'i18n': [
            'i18next',
            'react-i18next',
          ],
        }
      },
    },
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: isProd,
        drop_debugger: isProd,
      },
    },
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    sourcemap: !isProd,
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_PORT || '5174'),
    strictPort: true,
    allowedHosts: process.env.ALLOWED_HOSTS
      ? process.env.ALLOWED_HOSTS.split(',')
      : ['localhost', '127.0.0.1', '.manusvm.computer'],
    hmr: {
      clientPort: parseInt(process.env.VITE_PORT || '5174'),
    },
  },
})

