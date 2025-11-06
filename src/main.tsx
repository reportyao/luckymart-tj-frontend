import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { setupGlobalErrorHandlers, suppressKnownWarnings } from './utils/errorHandlers.ts'
import './i18n/config'
import './index.css'
import App from './App.tsx'

// 设置全局错误处理
setupGlobalErrorHandlers()
suppressKnownWarnings()

// 在生产环境中禁用 StrictMode 以避免双重挂载导致的 DOM 操作问题
const AppWrapper = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (isProduction) {
    return (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
  }
  
  return (
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<AppWrapper />)