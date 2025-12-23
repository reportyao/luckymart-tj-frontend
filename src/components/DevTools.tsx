import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { switchTestUser, clearTestUser } from '../utils/mockTelegramWebApp';

/**
 * 开发模式测试工具
 * 只在非 Telegram 环境中显示
 */
export const DevTools: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [customUserId, setCustomUserId] = useState('');

  // 只在非 Telegram 环境中显示
  if (window.Telegram?.WebApp && window.Telegram.WebApp.platform !== 'web') {
    return null;
  }

  const currentUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  const handleSwitchUser = () => {
    const userId = customUserId ? parseInt(customUserId) : undefined;
    switchTestUser(userId);
  };

  const handleRandomUser = () => {
    switchTestUser();
  };

  const handleClearUser = () => {
    if (window.confirm(t('dev.confirmClearUser'))) {
      clearTestUser();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
        title="开发工具"
      >
        🛠️
      </button>

      {/* Dev Tools Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 w-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">开发工具</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Current User Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">当前测试用户:</p>
            {currentUser ? (
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>ID:</strong> {currentUser.id}</p>
                <p><strong>姓名:</strong> {currentUser.first_name} {currentUser.last_name}</p>
                <p><strong>用户名:</strong> @{currentUser.username}</p>
                <p><strong>语言:</strong> {currentUser.language_code}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">无用户信息</p>
            )}
          </div>

          {/* Switch User */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              切换测试用户
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
                placeholder="用户ID (可选)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSwitchUser}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
              >
                切换
              </button>
            </div>
            <button
              onClick={handleRandomUser}
              className="mt-2 w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
            >
              随机用户
            </button>
          </div>

          {/* Clear User */}
          <button
            onClick={handleClearUser}
            className="w-full px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            清除用户
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>提示:</strong> 这是开发模式工具,仅在非 Telegram 环境中显示。切换用户后页面会自动刷新。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTools;
