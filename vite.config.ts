import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    base: 'https://seardao.org/',
    plugins: [react()],
    
    server: {
      port: 5173,
      host: true,
      allowedHosts: ["seardao.org", "www.seardao.org", '5173-iot3qdn4d99azf2yb5d5x-80fc91e3.manus-asia.computer', '5174-iot3qdn4d99azf2yb5d5x-80fc91e3.manus-asia.computer'],
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
          // 简化分块策略，避免模块加载顺序问题
          manualChunks: undefined,
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      // 优化 chunk 大小
      chunkSizeWarningLimit: 1000,
      target: 'es2020'
    },
    
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
