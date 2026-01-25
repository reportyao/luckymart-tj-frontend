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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
createRoot(rootElement).render(<AppWrapper />);
