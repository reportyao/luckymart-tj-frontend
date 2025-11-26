import React, { useState, useEffect } from 'react';
import { XMarkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useUser } from '../contexts/UserContext';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// 从 package.json 导入版本号
const APP_VERSION = '1.0.0';
const BUILD_TIME = new Date().toISOString(); // 构建时间会在构建时注入

interface DebugInfo {
  version: string;
  buildTime: string;
  page: {
    path: string;
    title: string;
    timestamp: string;
  };
  user: {
    id: string | null;
    telegramId: string | null;
    username: string | null;
  };
  telegram: {
    isInTelegram: boolean;
    initDataAvailable: boolean;
    webAppVersion: string;
  };
  auth: {
    hasUser: boolean;
    hasSession: boolean;
    lastCheck: string;
  };
  system: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    platform: string;
    language: string;
  };
  network: {
    online: boolean;
    effectiveType: string;
  };
  styles: {
    tailwindVersion: string;
    colorMode: string;
  };
  logs: Array<{
    time: string;
    level: string;
    message: string;
    data?: any;
  }>;
  requests: Array<{
    time: string;
    method: string;
    url: string;
    status: number;
    statusText: string;
    error?: string;
    duration: number;
  }>;
  routes: string[];
  authChecks: Array<{
    time: string;
    method: string;
    success: boolean;
    sessionExists: boolean;
    userId: string | null;
  }>;
}

interface DebugPanelProps {
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const { user, telegramUser } = useUser();
  const location = useLocation();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    const collectDebugInfo = (): DebugInfo => {
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0];

      // 从 window 对象获取 Telegram WebApp 信息
      const tg = (window as any).Telegram?.WebApp;

      return {
        version: APP_VERSION,
        buildTime: BUILD_TIME,
        page: {
          path: location.pathname,
          title: document.title,
          timestamp: now.toISOString(),
        },
        user: {
          id: user?.id || null,
          telegramId: telegramUser?.id?.toString() || null,
          username: telegramUser?.username || null,
        },
        telegram: {
          isInTelegram: !!tg,
          initDataAvailable: !!tg?.initData,
          webAppVersion: tg?.version || 'N/A',
        },
        auth: {
          hasUser: !!user,
          hasSession: !!user,
          lastCheck: timeString,
        },
        system: {
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          platform: navigator.platform,
          language: navigator.language,
        },
        network: {
          online: navigator.onLine,
          effectiveType: (navigator as any).connection?.effectiveType || 'unknown',
        },
        styles: {
          tailwindVersion: '4.0',
          colorMode: 'light',
        },
        logs: [],
        requests: [],
        routes: [],
        authChecks: [],
      };
    };

    setDebugInfo(collectDebugInfo());
  }, [user, telegramUser, location]);

  const handleCopy = () => {
    if (!debugInfo) return;

    const text = JSON.stringify(debugInfo, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('调试信息已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  if (!debugInfo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <h3 className="text-white font-semibold">调试面板</h3>
            <span className="text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded">
              v{debugInfo.version}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="复制调试信息"
            >
              <ClipboardDocumentIcon className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-3">
            {/* Version Info */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">版本信息</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">应用版本:</span>
                  <span className="font-mono text-purple-600">{debugInfo.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">构建时间:</span>
                  <span className="font-mono text-gray-900">{new Date(debugInfo.buildTime).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>

            {/* Page Info */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">页面信息</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">路径:</span>
                  <span className="font-mono text-blue-600">{debugInfo.page.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">标题:</span>
                  <span className="text-gray-900">{debugInfo.page.title}</span>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">用户信息</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">用户ID:</span>
                  <span className="font-mono text-gray-900 truncate max-w-[200px]">{debugInfo.user.id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Telegram ID:</span>
                  <span className="font-mono text-gray-900">{debugInfo.user.telegramId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">用户名:</span>
                  <span className="text-gray-900">{debugInfo.user.username || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Telegram Info */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Telegram 环境</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">在 Telegram 中:</span>
                  <span className={debugInfo.telegram.isInTelegram ? 'text-green-600' : 'text-red-600'}>
                    {debugInfo.telegram.isInTelegram ? '是' : '否'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">InitData 可用:</span>
                  <span className={debugInfo.telegram.initDataAvailable ? 'text-green-600' : 'text-red-600'}>
                    {debugInfo.telegram.initDataAvailable ? '是' : '否'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">WebApp 版本:</span>
                  <span className="font-mono text-gray-900">{debugInfo.telegram.webAppVersion}</span>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">系统信息</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">视口:</span>
                  <span className="font-mono text-gray-900">
                    {debugInfo.system.viewport.width} × {debugInfo.system.viewport.height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">平台:</span>
                  <span className="text-gray-900">{debugInfo.system.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">语言:</span>
                  <span className="text-gray-900">{debugInfo.system.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">网络:</span>
                  <span className={debugInfo.network.online ? 'text-green-600' : 'text-red-600'}>
                    {debugInfo.network.online ? '在线' : '离线'} ({debugInfo.network.effectiveType})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            点击复制按钮可将完整调试信息复制到剪贴板
          </p>
        </div>
      </div>
    </div>
  );
};
