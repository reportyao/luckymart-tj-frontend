import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';

interface LogEntry {
  type: 'info' | 'warn' | 'error';
  message: string;
  time: string;
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { user } = useUser();

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      type,
      message,
      time: new Date().toLocaleTimeString()
    }]);
  };

  useEffect(() => {
    addLog('info', '调试页面已加载');
    
    // 检测样式
    const bodyStyles = getComputedStyle(document.body);
    const rootStyles = getComputedStyle(document.getElementById('root') || document.body);
    const htmlStyles = getComputedStyle(document.documentElement);
    
    addLog('info', `HTML 背景色: ${htmlStyles.backgroundColor}`);
    addLog('info', `Body 背景色: ${bodyStyles.backgroundColor}`);
    addLog('info', `Root 背景色: ${rootStyles.backgroundColor}`);
    addLog('info', `Body 字体: ${bodyStyles.fontFamily}`);
    
    // 检测所有样式表
    const styleSheets = Array.from(document.styleSheets);
    addLog('info', `找到 ${styleSheets.length} 个样式表`);
    
    styleSheets.forEach((sheet, i) => {
      try {
        addLog('info', `样式表 ${i + 1}: ${sheet.href || '内联样式'} (${sheet.cssRules?.length || 0} 条规则)`);
      } catch (e) {
        addLog('warn', `样式表 ${i + 1}: 无法访问 (CORS)`);
      }
    });
    
    // 检测 CSS 链接
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    addLog('info', `找到 ${cssLinks.length} 个 CSS 链接`);
    
    cssLinks.forEach((link, i) => {
      const href = (link as HTMLLinkElement).href;
      const loaded = (link as HTMLLinkElement).sheet !== null;
      addLog(loaded ? 'info' : 'error', `CSS ${i + 1}: ${href} ${loaded ? '✅ 已加载' : '❌ 未加载'}`);
    });

    // 检测 Telegram
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      addLog('info', `Telegram 版本: ${tg.version}`);
      addLog('info', `Telegram 平台: ${tg.platform}`);
      addLog('info', `Telegram 主题: ${tg.colorScheme}`);
      addLog('info', `Telegram 已展开: ${tg.isExpanded}`);
      
      // 检测 Telegram 主题参数
      const themeParams = tg.themeParams;
      if (themeParams) {
        addLog('info', `Telegram bg_color: ${themeParams.bg_color}`);
        addLog('info', `Telegram text_color: ${themeParams.text_color}`);
      }
    } else {
      addLog('warn', 'Telegram WebApp 未初始化');
    }
    
    // 用户登录状态
    if (user) {
      addLog('info', `用户已登录: ID=${user.id}, UID=${(user as any).uid || 'N/A'}`);
    } else {
      addLog('warn', '用户未登录');
    }
    
    // 检测特定元素的样式
    setTimeout(() => {
      const testElements = [
        { selector: '.bg-gray-50', name: '灰色背景元素' },
        { selector: '.bg-white', name: '白色背景元素' },
        { selector: '.text-2xl', name: '大标题元素' },
        { selector: '.p-4', name: 'padding元素' }
      ];
      
      testElements.forEach(({ selector, name }) => {
        const el = document.querySelector(selector);
        if (el) {
          const styles = getComputedStyle(el);
          addLog('info', `${name} (${selector}): bg=${styles.backgroundColor}, padding=${styles.padding}`);
        } else {
          addLog('warn', `未找到 ${name} (${selector})`);
        }
      });
    }, 500);
    
  }, [user]);

  const testElementStyles = () => {
    const testDiv = document.createElement('div');
    testDiv.className = 'bg-blue-500 text-white p-4 rounded';
    testDiv.textContent = 'Tailwind 测试元素';
    testDiv.style.position = 'fixed';
    testDiv.style.top = '50%';
    testDiv.style.left = '50%';
    testDiv.style.transform = 'translate(-50%, -50%)';
    testDiv.style.zIndex = '9999';
    document.body.appendChild(testDiv);
    
    setTimeout(() => {
      const styles = getComputedStyle(testDiv);
      addLog('info', `测试元素背景: ${styles.backgroundColor}`);
      addLog('info', `测试元素颜色: ${styles.color}`);
      addLog('info', `测试元素padding: ${styles.padding}`);
      addLog('info', `测试元素圆角: ${styles.borderRadius}`);
      
      setTimeout(() => testDiv.remove(), 2000);
    }, 100);
  };

  const copyLogs = () => {
    const text = logs.map(log => `[${log.time}] ${log.type.toUpperCase()}: ${log.message}`).join('\n');
    
    // 尝试使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('日志已复制到剪贴板！');
      }).catch((err) => {
        console.error('复制失败:', err);
        fallbackCopy(text);
      });
    } else {
      // 降级方案：使用传统方法
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('日志已复制到剪贴板！');
      } else {
        alert('复制失败，请手动复制日志内容');
      }
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制日志内容');
    }
    document.body.removeChild(textArea);
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>🔍 增强调试信息</h1>
      
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>URL 信息</h2>
        <p style={{ fontSize: '14px' }}>完整 URL: {window.location.href}</p>
        <p style={{ fontSize: '14px' }}>协议: {window.location.protocol}</p>
        <p style={{ fontSize: '14px' }}>域名: {window.location.hostname}</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>用户状态</h2>
        {user ? (
          <>
            <p style={{ fontSize: '14px' }}>✅ 已登录</p>
            <p style={{ fontSize: '14px' }}>ID: {user.id}</p>
            <p style={{ fontSize: '14px' }}>UID: {(user as any).uid || 'N/A'}</p>
            <p style={{ fontSize: '14px' }}>用户名: {user.telegram_username || 'N/A'}</p>
          </>
        ) : (
          <p style={{ fontSize: '14px', color: '#f59e0b' }}>⚠️ 未登录</p>
        )}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>浏览器信息</h2>
        <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{navigator.userAgent}</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>详细日志</h2>
        <div style={{ 
          backgroundColor: '#1e1e1e', 
          color: '#d4d4d4', 
          padding: '12px', 
          borderRadius: '6px', 
          maxHeight: '400px', 
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          {logs.map((log, i) => (
            <div 
              key={i} 
              style={{ 
                marginBottom: '4px',
                color: log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#4ade80'
              }}
            >
              [{log.time}] {log.message}
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>操作</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={testElementStyles}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#2563eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            测试 Tailwind 样式
          </button>
          <button 
            onClick={copyLogs}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#16a34a', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            复制日志
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#6b7280', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
