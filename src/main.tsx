import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupGlobalErrorHandlers, suppressKnownWarnings } from './utils/errorHandlers';
import { initMockTelegramWebApp } from './utils/mockTelegramWebApp';
import i18n from './i18n/config';
import './index.css';
import App from './App';
import { UserProvider } from './contexts/UserContext';
import { SupabaseProvider } from './contexts/SupabaseContext';

// 设置全局错误处理和警告抑制
setupGlobalErrorHandlers();
suppressKnownWarnings();

// 在非Telegram环境中或initData为空时初始化Mock SDK
if (!window.Telegram?.WebApp || !window.Telegram.WebApp.initData) {
  console.log('[Dev Mode] Initializing Mock Telegram WebApp for testing');
  console.log('[Dev Mode] Reason:', !window.Telegram?.WebApp ? 'No Telegram object' : 'Empty initData');
  initMockTelegramWebApp();
}

function AppWrapper() {
  return (
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <SupabaseProvider>
            <UserProvider>
              <App />
            </UserProvider>
          </SupabaseProvider>
        </ErrorBoundary>
      </I18nextProvider>
    </StrictMode>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
createRoot(rootElement).render(<AppWrapper />);
