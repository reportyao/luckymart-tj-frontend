/**
 * Mock Telegram WebApp SDK
 * 用于在非 Telegram 环境中测试应用
 */

export interface MockTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface MockTelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: MockTelegramUser;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: Partial<{
      text: string;
      color: string;
      text_color: string;
      is_active: boolean;
      is_visible: boolean;
    }>) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: string; text: string }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: { text?: string }, callback?: (text: string) => boolean) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  shareToStory: (media_url: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

// 生成测试用户
const generateTestUser = (userId?: number): MockTelegramUser => {
  const id = userId || Math.floor(Math.random() * 1000000) + 1000000;
  return {
    id,
    first_name: `Test`,
    last_name: `User${id}`,
    username: `testuser${id}`,
    language_code: 'zh',
    is_premium: false,
    photo_url: `https://i.pravatar.cc/150?u=${id}`
  };
};

// 从 localStorage 获取或创建测试用户
const getOrCreateTestUser = (): MockTelegramUser => {
  const stored = localStorage.getItem('mock_telegram_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored user:', e);
    }
  }
  
  const newUser = generateTestUser();
  localStorage.setItem('mock_telegram_user', JSON.stringify(newUser));
  return newUser;
};

// 创建 Mock WebApp 对象
export const createMockTelegramWebApp = (): MockTelegramWebApp => {
  const user = getOrCreateTestUser();
  const authDate = Math.floor(Date.now() / 1000);
  
  // 生成简单的 hash (实际应该使用 HMAC-SHA256)
  const hash = btoa(`${user.id}_${authDate}`).substring(0, 64);
  
  const initDataUnsafe = {
    query_id: `mock_query_${Date.now()}`,
    user,
    auth_date: authDate,
    hash
  };
  
  const initData = new URLSearchParams({
    query_id: initDataUnsafe.query_id!,
    user: JSON.stringify(user),
    auth_date: authDate.toString(),
    hash
  }).toString();

  const mainButtonCallbacks: Array<() => void> = [];
  const backButtonCallbacks: Array<() => void> = [];

  return {
    initData,
    initDataUnsafe,
    version: '7.0',
    platform: 'web',
    colorScheme: 'light',
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#3390ec',
      button_color: '#3390ec',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f4f4f5'
    },
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    
    BackButton: {
      isVisible: false,
      onClick: (callback: () => void) => {
        backButtonCallbacks.push(callback);
      },
      offClick: (callback: () => void) => {
        const index = backButtonCallbacks.indexOf(callback);
        if (index > -1) {
          backButtonCallbacks.splice(index, 1);
        }
      },
      show: () => {
        console.log('[Mock] BackButton.show()');
      },
      hide: () => {
        console.log('[Mock] BackButton.hide()');
      }
    },
    
    MainButton: {
      text: '',
      color: '#3390ec',
      textColor: '#ffffff',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: (text: string) => {
        console.log('[Mock] MainButton.setText:', text);
      },
      onClick: (callback: () => void) => {
        mainButtonCallbacks.push(callback);
      },
      offClick: (callback: () => void) => {
        const index = mainButtonCallbacks.indexOf(callback);
        if (index > -1) {
          mainButtonCallbacks.splice(index, 1);
        }
      },
      show: () => {
        console.log('[Mock] MainButton.show()');
      },
      hide: () => {
        console.log('[Mock] MainButton.hide()');
      },
      enable: () => {
        console.log('[Mock] MainButton.enable()');
      },
      disable: () => {
        console.log('[Mock] MainButton.disable()');
      },
      showProgress: (leaveActive?: boolean) => {
        console.log('[Mock] MainButton.showProgress:', leaveActive);
      },
      hideProgress: () => {
        console.log('[Mock] MainButton.hideProgress()');
      },
      setParams: (params) => {
        console.log('[Mock] MainButton.setParams:', params);
      }
    },
    
    HapticFeedback: {
      impactOccurred: (style) => {
        console.log('[Mock] HapticFeedback.impactOccurred:', style);
      },
      notificationOccurred: (type) => {
        console.log('[Mock] HapticFeedback.notificationOccurred:', type);
      },
      selectionChanged: () => {
        console.log('[Mock] HapticFeedback.selectionChanged()');
      }
    },
    
    ready: () => {
      console.log('[Mock] Telegram WebApp ready');
    },
    
    expand: () => {
      console.log('[Mock] Telegram WebApp expand');
    },
    
    close: () => {
      console.log('[Mock] Telegram WebApp close');
      window.history.back();
    },
    
    enableClosingConfirmation: () => {
      console.log('[Mock] enableClosingConfirmation');
    },
    
    disableClosingConfirmation: () => {
      console.log('[Mock] disableClosingConfirmation');
    },
    
    showPopup: (params, callback) => {
      console.log('[Mock] showPopup:', params);
      const result = window.confirm(params.message);
      if (callback) {
        callback(result ? 'ok' : 'cancel');
      }
    },
    
    showAlert: (message, callback) => {
      console.log('[Mock] showAlert:', message);
      window.alert(message);
      if (callback) callback();
    },
    
    showConfirm: (message, callback) => {
      console.log('[Mock] showConfirm:', message);
      const result = window.confirm(message);
      if (callback) callback(result);
    },
    
    showScanQrPopup: (params, callback) => {
      console.log('[Mock] showScanQrPopup:', params);
      const text = window.prompt(params.text || 'Scan QR Code');
      if (callback && text) {
        callback(text);
      }
    },
    
    closeScanQrPopup: () => {
      console.log('[Mock] closeScanQrPopup');
    },
    
    readTextFromClipboard: async (callback) => {
      console.log('[Mock] readTextFromClipboard');
      try {
        const text = await navigator.clipboard.readText();
        if (callback) callback(text);
      } catch (e) {
        console.error('Failed to read clipboard:', e);
      }
    },
    
    openLink: (url, options) => {
      console.log('[Mock] openLink:', url, options);
      window.open(url, '_blank');
    },
    
    openTelegramLink: (url) => {
      console.log('[Mock] openTelegramLink:', url);
      window.open(url, '_blank');
    },
    
    openInvoice: (url, callback) => {
      console.log('[Mock] openInvoice:', url);
      window.open(url, '_blank');
      if (callback) {
        setTimeout(() => callback('paid'), 1000);
      }
    },
    
    shareToStory: (media_url, params) => {
      console.log('[Mock] shareToStory:', media_url, params);
      alert('Share to story: ' + media_url);
    },
    
    sendData: (data) => {
      console.log('[Mock] sendData:', data);
    },
    
    switchInlineQuery: (query, choose_chat_types) => {
      console.log('[Mock] switchInlineQuery:', query, choose_chat_types);
    },
    
    setHeaderColor: (color) => {
      console.log('[Mock] setHeaderColor:', color);
    },
    
    setBackgroundColor: (color) => {
      console.log('[Mock] setBackgroundColor:', color);
    }
  };
};

// 初始化 Mock Telegram WebApp
export const initMockTelegramWebApp = (): void => {
  if (typeof window !== 'undefined' && !window.Telegram) {
    console.log('[Mock] Initializing Mock Telegram WebApp');
    
    const mockWebApp = createMockTelegramWebApp();
    
    (window as any).Telegram = {
      WebApp: mockWebApp
    };
    
    console.log('[Mock] Mock Telegram WebApp initialized with user:', mockWebApp.initDataUnsafe.user);
  }
};

// 切换测试用户
export const switchTestUser = (userId?: number): void => {
  const newUser = generateTestUser(userId);
  localStorage.setItem('mock_telegram_user', JSON.stringify(newUser));
  console.log('[Mock] Switched to test user:', newUser);
  window.location.reload();
};

// 清除测试用户
export const clearTestUser = (): void => {
  localStorage.removeItem('mock_telegram_user');
  console.log('[Mock] Test user cleared');
  window.location.reload();
};
