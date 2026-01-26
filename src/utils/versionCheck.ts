/**
 * 版本检测和强制刷新机制
 * 用于解决 Telegram 缓存旧版本的问题
 */

const CURRENT_VERSION = '2.0.0'; // 每次部署时更新此版本号
const VERSION_KEY = 'app_version';
const LAST_CHECK_KEY = 'last_version_check';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

/**
 * 检查并处理版本更新
 */
export function checkVersion(): void {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    const now = Date.now();

    // 如果是首次访问或版本不匹配，记录新版本
    if (!storedVersion) {
      console.log('[Version] First visit, setting version:', CURRENT_VERSION);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(LAST_CHECK_KEY, now.toString());
      return;
    }

    // 如果存储的版本与当前版本不同，说明加载了旧版本
    if (storedVersion !== CURRENT_VERSION) {
      console.log('[Version] Version mismatch detected!');
      console.log(`[Version] Stored: ${storedVersion}, Current: ${CURRENT_VERSION}`);
      console.log('[Version] Forcing reload to get latest version...');
      
      // 更新版本号
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(LAST_CHECK_KEY, now.toString());
      
      // 强制刷新页面，绕过缓存
      window.location.reload();
      return;
    }

    // 定期检查服务器版本（防止长时间运行的应用未更新）
    if (lastCheck) {
      const timeSinceLastCheck = now - parseInt(lastCheck);
      if (timeSinceLastCheck > CHECK_INTERVAL) {
        console.log('[Version] Periodic version check...');
        checkServerVersion();
        localStorage.setItem(LAST_CHECK_KEY, now.toString());
      }
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
    // 添加随机参数防止缓存
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.version && data.version !== CURRENT_VERSION) {
        console.log('[Version] Server version different, reloading...');
        console.log(`[Version] Current: ${CURRENT_VERSION}, Server: ${data.version}`);
        localStorage.setItem(VERSION_KEY, data.version);
        window.location.reload();
      }
    }
  } catch (error) {
    console.warn('[Version] Failed to check server version:', error);
  }
}

/**
 * 获取当前版本号
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

/**
 * 强制清除所有缓存并重新加载
 */
export function forceClearCache(): void {
  console.log('[Version] Force clearing all caches...');
  
  // 清除 localStorage 中的版本信息
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(LAST_CHECK_KEY);
  
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
