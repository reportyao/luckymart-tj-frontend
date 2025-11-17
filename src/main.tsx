import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setupGlobalErrorHandlers, suppressKnownWarnings } from './utils/errorHandlers'
import './i18n/config'
import './index.css'
import App from './App'
import { UserProvider } from './contexts/UserContext'
import { SupabaseProvider } from './contexts/SupabaseContext'

// 设置全局错误处理和警告抑制
setupGlobalErrorHandlers()
suppressKnownWarnings()

// 在生产环境中禁用 StrictMode 以避免双重挂载导致的 DOM 操作问题
function AppWrapper() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (isProduction) {
    return (
      <ErrorBoundary>
        <SupabaseProvider>
          <UserProvider>
            <App />
          </UserProvider>
        </SupabaseProvider>
      </ErrorBoundary>
    )
  }
  
  return (
    <StrictMode>
      <ErrorBoundary>
        <SupabaseProvider>
          <UserProvider>
            <App />
          </UserProvider>
        </SupabaseProvider>
      </ErrorBoundary>
    </StrictMode>
  )
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
createRoot(rootElement).render(<AppWrapper />);
