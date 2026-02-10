/**
 * 版本检测和强制刷新机制
 * 用于解决 Telegram 缓存旧版本的问题
 * 
 * 版本号统一从 public/version.json 读取，避免多处硬编码不同步
 */

const VERSION_KEY = 'app_version';
const LAST_CHECK_KEY = 'last_version_check';
const RELOAD_COUNT_KEY = 'version_reload_count';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次
const MAX_RELOAD_COUNT = 2; // 最大连续刷新次数，防止无限循环

// 从构建时注入的版本号（由 vite-plugin-timestamp 在 version.json 中维护）
let CURRENT_VERSION = '0.0.0';

/**
 * 初始化：从服务器获取当前版本号
 */
async function fetchCurrentVersion(): Promise<string> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.version || '0.0.0';
    }
  } catch (error) {
    console.warn('[Version] Failed to fetch version.json:', error);
  }
  return '0.0.0';
}

/**
 * 检查并处理版本更新
 */
export function checkVersion(): void {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    const now = Date.now();

    // 定期检查服务器版本（防止长时间运行的应用未更新）
    if (lastCheck) {
      const timeSinceLastCheck = now - parseInt(lastCheck);
      if (timeSinceLastCheck > CHECK_INTERVAL) {
        console.log('[Version] Periodic version check...');
        checkServerVersion();
        localStorage.setItem(LAST_CHECK_KEY, now.toString());
      }
    } else {
      localStorage.setItem(LAST_CHECK_KEY, now.toString());
    }
  } catch (error) {
    console.error('[Version] Error checking version:', error);
  }
}

/**
 * 检查服务器上的版本
 */
async function checkServerVersion(): Promise<void> {
  try {
    const serverVersion = await fetchCurrentVersion();
    if (serverVersion === '0.0.0') return;

    const storedVersion = localStorage.getItem(VERSION_KEY);

    // 首次访问，记录版本
    if (!storedVersion) {
      console.log('[Version] First visit, setting version:', serverVersion);
      localStorage.setItem(VERSION_KEY, serverVersion);
      return;
    }

    // 版本一致，无需操作
    if (storedVersion === serverVersion) {
      // 重置刷新计数
      localStorage.removeItem(RELOAD_COUNT_KEY);
      return;
    }

    // 版本不一致，检查是否已经刷新过多次（防止无限循环）
    const reloadCount = parseInt(localStorage.getItem(RELOAD_COUNT_KEY) || '0');
    if (reloadCount >= MAX_RELOAD_COUNT) {
      console.warn(`[Version] Already reloaded ${reloadCount} times, stopping to prevent infinite loop.`);
      console.warn(`[Version] Stored: ${storedVersion}, Server: ${serverVersion}`);
      // 接受当前版本，重置计数
      localStorage.setItem(VERSION_KEY, serverVersion);
      localStorage.removeItem(RELOAD_COUNT_KEY);
      return;
    }

    console.log('[Version] Server version different, reloading...');
    console.log(`[Version] Stored: ${storedVersion}, Server: ${serverVersion}`);

    // 更新版本号和刷新计数
    localStorage.setItem(VERSION_KEY, serverVersion);
    localStorage.setItem(RELOAD_COUNT_KEY, (reloadCount + 1).toString());

    // 强制刷新页面
    window.location.reload();
  } catch (error) {
    console.warn('[Version] Failed to check server version:', error);
  }
}

/**
 * 获取当前版本号
 */
export function getCurrentVersion(): string {
  return localStorage.getItem(VERSION_KEY) || '0.0.0';
}

/**
 * 强制清除所有缓存并重新加载
 */
export function forceClearCache(): void {
  console.log('[Version] Force clearing all caches...');
  
  // 清除 localStorage 中的版本信息
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(LAST_CHECK_KEY);
  localStorage.removeItem(RELOAD_COUNT_KEY);
  
  // 清除 Service Worker 缓存（如果有）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
  
  // 清除所有 Cache Storage
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
  }
  
  // 强制刷新
  window.location.reload();
}
