/**
 * Telegram WebApp 初始化脚本
 * 必须在应用加载前执行
 */

(function() {
  'use strict';
  
  console.log('[Telegram Init] Starting initialization...');
  
  // 等待 Telegram WebApp SDK 加载
  function waitForTelegram(callback, maxAttempts = 50) {
    let attempts = 0;
    
    const checkTelegram = setInterval(() => {
      attempts++;
      
      if (window.Telegram && window.Telegram.WebApp) {
        clearInterval(checkTelegram);
        console.log('[Telegram Init] SDK loaded successfully');
        callback(window.Telegram.WebApp);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkTelegram);
        console.error('[Telegram Init] SDK failed to load after', maxAttempts, 'attempts');
        callback(null);
      }
    }, 100);
  }
  
  // 初始化 Telegram WebApp
  waitForTelegram(function(WebApp) {
    if (!WebApp) {
      console.error('[Telegram Init] Telegram WebApp not available');
      return;
    }
    
    try {
      // 调用 ready() 通知 Telegram 应用已准备好
      WebApp.ready();
      console.log('[Telegram Init] WebApp.ready() called');
      
      // 展开应用到全屏
      WebApp.expand();
      console.log('[Telegram Init] WebApp.expand() called');
      
      // 设置头部颜色
      if (WebApp.setHeaderColor) {
        WebApp.setHeaderColor('bg_color');
        console.log('[Telegram Init] Header color set');
      }
      
      // 设置底部栏颜色
      if (WebApp.setBottomBarColor) {
        WebApp.setBottomBarColor('#ffffff');
        console.log('[Telegram Init] Bottom bar color set');
      }
      
      // 打印调试信息
      console.log('[Telegram Init] Platform:', WebApp.platform);
      console.log('[Telegram Init] Version:', WebApp.version);
      console.log('[Telegram Init] initData available:', !!WebApp.initData);
      console.log('[Telegram Init] initData length:', WebApp.initData ? WebApp.initData.length : 0);
      
      if (WebApp.initDataUnsafe) {
        console.log('[Telegram Init] User:', WebApp.initDataUnsafe.user);
        console.log('[Telegram Init] Start param:', WebApp.initDataUnsafe.start_param);
      }
      
      // 存储到全局变量供调试使用
      window.__TELEGRAM_WEB_APP__ = WebApp;
      
      console.log('[Telegram Init] Initialization complete');
      
    } catch (error) {
      console.error('[Telegram Init] Initialization error:', error);
    }
  });
  
})();
