import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setupGlobalErrorHandlers, suppressKnownWarnings } from './utils/errorHandlers'
import i18n from './i18n/config'
import './index.css'
import App from './App'
import { UserProvider } from './contexts/UserContext'
import { SupabaseProvider } from './contexts/SupabaseContext'

// 设置全局错误处理和警告抑制
setupGlobalErrorHandlers()
suppressKnownWarnings()

// 确保 i18n 初始化完成
await i18n.init()

// 修复 FE-BUG-002: 移除生产环境禁用 StrictMode 的逻辑，强制使用 StrictMode 以暴露副作用
function AppWrapper() {
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
