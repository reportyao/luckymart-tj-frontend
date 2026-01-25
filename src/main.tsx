import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupGlobalErrorHandlers, suppressKnownWarnings } from './utils/errorHandlers';
import { errorMonitor } from './services/ErrorMonitorService';

import i18n from './i18n/config';
import './index.css';
import App from './App';
import { UserProvider } from './contexts/UserContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分钟内数据被认为是新鲜的
      gcTime: 1000 * 60 * 30, // 30分钟后清除缓存
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// 设置全局错误处理和警告抑制
setupGlobalErrorHandlers();
suppressKnownWarnings();

// 初始化错误监控服务（仅在生产环境启用）
if (import.meta.env.PROD) {
  errorMonitor.init('1.0.1');
}


function AppWrapper() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ErrorBoundary>
            <SupabaseProvider>
              <UserProvider>
                <App />
              </UserProvider>
            </SupabaseProvider>
          </ErrorBoundary>
        </I18nextProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

// 全局加载超时检测
let appMounted = false;
const loadingTimeout = setTimeout(() => {
  if (!appMounted) {
    console.error('[App] Loading timeout detected, showing fallback UI');
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; background-color: #f9fafb;">
          <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">Loading Failed</h2>
          <p style="color: #6b7280; margin-bottom: 20px;">The application failed to load. This might be due to network issues.</p>
          <button 
            onclick="window.location.reload()" 
            style="background-color: #2B5D3A; color: white; padding: 12px 24px; border-radius: 8px; border: none; font-size: 16px; cursor: pointer;"
          >
            Retry
          </button>
        </div>
      `;
    }
  }
}, 12000); // 12秒超时

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(<AppWrapper />);
  appMounted = true;
  clearTimeout(loadingTimeout);
} catch (error) {
  console.error('[App] Failed to mount React app:', error);
  clearTimeout(loadingTimeout);
  rootElement.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; background-color: #f9fafb;">
      <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">Application Error</h2>
      <p style="color: #6b7280; margin-bottom: 20px;">Failed to initialize the application.</p>
      <button 
        onclick="window.location.reload()" 
        style="background-color: #2B5D3A; color: white; padding: 12px 24px; border-radius: 8px; border: none; font-size: 16px; cursor: pointer;"
      >
        Reload
      </button>
    </div>
  `;
}
