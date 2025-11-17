import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    
    // 覆盖率收集
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts'
      ]
    },
    
    // 测试文件匹配
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache']
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
