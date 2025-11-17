import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react()],
    
    server: {
      port: 5173,
      host: true,
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:5176',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          ws: true
        }
      }
    },
    
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js', '@supabase/ssr'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-select']
          }
        }
      },
      target: 'es2020'
    },
    
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
