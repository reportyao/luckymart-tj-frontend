/**
 * Telegram WebApp 初始化脚本
 * 必须在应用加载前执行
 */

(function() {
  'use strict';
  
  console.log('[Telegram Init] Starting initialization...');
  
  // 标记初始化已开始
  window.__TELEGRAM_INIT_STARTED__ = true;
  
  // 等待 Telegram WebApp SDK 加载 - 减少等待时间
  function waitForTelegram(callback, maxAttempts = 15) {
    let attempts = 0;
    
    const checkTelegram = setInterval(() => {
      attempts++;
      
      if (window.Telegram && window.Telegram.WebApp) {
        clearInterval(checkTelegram);
        console.log('[Telegram Init] SDK loaded successfully');
        window.__TELEGRAM_SDK_LOADED__ = true;
        callback(window.Telegram.WebApp);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkTelegram);
        console.warn('[Telegram Init] SDK not available (not in Telegram environment)');
        window.__TELEGRAM_SDK_LOADED__ = false;
        callback(null);
      }
    }, 100);
  }
  
  // 捕获全局错误，忽略 assetCache TIMEOUT 错误
  const originalError = window.console.error;
  window.console.error = function(...args) {
    // 忽略 assetCache.ts 的 TIMEOUT 错误
    if (args.length > 0 && args[0] && args[0].message === 'TIMEOUT') {
      console.warn('[Telegram Init] Asset cache timeout ignored (non-critical)');
      return;
    }
    originalError.apply(console, args);
  };
  
  // 初始化 Telegram WebApp
  waitForTelegram(function(WebApp) {
    // 标记初始化完成
    window.__TELEGRAM_INIT_COMPLETE__ = true;
    
    if (!WebApp) {
      console.log('[Telegram Init] Running in browser mode');
      return;
    }
    
    try {
      WebApp.ready();
      WebApp.expand();
      
      if (WebApp.setHeaderColor) {
        WebApp.setHeaderColor('bg_color');
      }
      
      if (WebApp.setBottomBarColor) {
        WebApp.setBottomBarColor('#ffffff');
      }
      
      window.__TELEGRAM_WEB_APP__ = WebApp;
      console.log('[Telegram Init] Initialization complete');
      
    } catch (error) {
      console.error('[Telegram Init] Initialization error:', error);
    }
  });
  
})();
