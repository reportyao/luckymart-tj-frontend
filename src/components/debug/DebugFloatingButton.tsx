import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { useLocation } from 'react-router-dom'

interface LogEntry {
  time: string
  level: 'info' | 'warn' | 'error'
  message: string
  data?: any
}

interface DebugInfo {
  // 页面信息
  page: {
    path: string
    title: string
    timestamp: string
  }
  // 用户信息
  user: {
    id: string | null
    telegramId: number | null
    username: string | null
  }
  // 系统信息
  system: {
    userAgent: string
    viewport: {
      width: number
      height: number
    }
    platform: string
    language: string
  }
  // 网络信息
  network: {
    online: boolean
    effectiveType?: string
  }
  // 样式信息
  styles: {
    tailwindVersion: string
    colorMode: string
  }
  // 最近日志
  logs: LogEntry[]
}

export const DebugFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const { user, telegramUser } = useUser()
  const location = useLocation()

  // 监听自定义事件：点击“我的”5次触发
  useEffect(() => {
    const handleShowDebugPanel = () => {
      setIsVisible(true)
      setIsOpen(true)
    }

    window.addEventListener('showDebugPanel', handleShowDebugPanel)

    return () => {
      window.removeEventListener('showDebugPanel', handleShowDebugPanel)
    }
  }, [])

  // 长按右下角 3 次显示调试按钮（备用方法）
  useEffect(() => {
    let touchTimer: NodeJS.Timeout
    let touchCount = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      const isBottomRight = 
        touch.clientX > window.innerWidth - 100 &&
        touch.clientY > window.innerHeight - 100

      if (isBottomRight) {
        touchCount++
        if (touchCount >= 3) {
          setIsVisible(true)
          setIsOpen(true)
          touchCount = 0
        }
        
        touchTimer = setTimeout(() => {
          touchCount = 0
        }, 1000)
      }
    }

    const handleTouchEnd = () => {
      clearTimeout(touchTimer)
    }

    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      clearTimeout(touchTimer)
    }
  }, [])

  // 拦截 console 日志
  useEffect(() => {
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn
    const originalConsoleLog = console.log

    const addLog = (level: 'info' | 'warn' | 'error', ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      setLogs(prev => [
        {
          time: new Date().toLocaleTimeString('zh-CN'),
          level,
          message,
          data: args.length > 1 ? args : undefined
        },
        ...prev.slice(0, 49) // 最多保留 50 条
      ])
    }

    console.error = (...args) => {
      originalConsoleError(...args)
      addLog('error', ...args)
    }

    console.warn = (...args) => {
      originalConsoleWarn(...args)
      addLog('warn', ...args)
    }

    console.log = (...args) => {
      originalConsoleLog(...args)
      addLog('info', ...args)
    }

    return () => {
      console.error = originalConsoleError
      console.warn = originalConsoleWarn
      console.log = originalConsoleLog
    }
  }, [])

  // 收集调试信息
  const getDebugInfo = (): DebugInfo => {
    const nav = navigator as any
    
    return {
      page: {
        path: location.pathname,
        title: document.title,
        timestamp: new Date().toISOString()
      },
      user: {
        id: user?.id || null,
        telegramId: telegramUser?.id || null,
        username: telegramUser?.username || user?.telegram_username || null
      },
      system: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        platform: navigator.platform,
        language: navigator.language
      },
      network: {
        online: navigator.onLine,
        effectiveType: nav.connection?.effectiveType || 'unknown'
      },
      styles: {
        tailwindVersion: '4.0',
        colorMode: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      },
      logs: logs.slice(0, 10)
    }
  }

  // 复制调试信息
  const copyDebugInfo = () => {
    const debugInfo = getDebugInfo()
    const text = JSON.stringify(debugInfo, null, 2)
    
    navigator.clipboard.writeText(text).then(() => {
      alert('调试信息已复制到剪贴板')
    }).catch(err => {
      console.error('复制失败:', err)
      alert('复制失败，请手动复制')
    })
  }

  const clearLogs = () => {
    setLogs([])
  }

  if (!isVisible) return null

  return (
    <>
      {/* 置顶浮层调试面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200"
            style={{ maxHeight: isMinimized ? '48px' : '60vh' }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">🐛</span>
                <span className="text-sm font-semibold">调试面板</span>
                <span className="text-xs opacity-75">{location.pathname}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
                >
                  {isMinimized ? '展开' : '收起'}
                </button>
                <button
                  onClick={copyDebugInfo}
                  className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
                >
                  复制
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            {!isMinimized && (
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 48px)' }}>
                {/* 快速信息栏 */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 border-b border-gray-200 text-xs">
                  <div>
                    <div className="text-gray-500">用户ID</div>
                    <div className="font-mono text-gray-900 truncate">{user?.id || '未登录'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Telegram ID</div>
                    <div className="font-mono text-gray-900">{telegramUser?.id || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">视口</div>
                    <div className="font-mono text-gray-900">{window.innerWidth}×{window.innerHeight}</div>
                  </div>
                </div>

                {/* 详细信息区域 */}
                <div className="p-3 space-y-3">
                  {/* 页面信息 */}
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                      <span>📄</span>
                      <span>页面信息</span>
                    </div>
                    <div className="text-xs space-y-1 text-blue-800">
                      <div><span className="text-blue-600">路径:</span> {location.pathname}</div>
                      <div><span className="text-blue-600">标题:</span> {document.title}</div>
                      <div><span className="text-blue-600">时间:</span> {new Date().toLocaleString('zh-CN')}</div>
                    </div>
                  </div>

                  {/* 用户信息 */}
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-green-900 mb-1 flex items-center gap-1">
                      <span>👤</span>
                      <span>用户信息</span>
                    </div>
                    <div className="text-xs space-y-1 text-green-800">
                      <div><span className="text-green-600">用户ID:</span> {user?.id || '未登录'}</div>
                      <div><span className="text-green-600">Telegram ID:</span> {telegramUser?.id || 'N/A'}</div>
                      <div><span className="text-green-600">用户名:</span> {telegramUser?.username || user?.telegram_username || 'N/A'}</div>
                      <div><span className="text-green-600">余额:</span> {(user as any)?.balance || 0} TJS</div>
                      <div><span className="text-green-600">幸运币:</span> {(user as any)?.lucky_coins || 0}</div>
                    </div>
                  </div>

                  {/* 系统信息 */}
                  <div className="bg-purple-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-purple-900 mb-1 flex items-center gap-1">
                      <span>⚙️</span>
                      <span>系统信息</span>
                    </div>
                    <div className="text-xs space-y-1 text-purple-800">
                      <div><span className="text-purple-600">平台:</span> {navigator.platform}</div>
                      <div><span className="text-purple-600">语言:</span> {navigator.language}</div>
                      <div><span className="text-purple-600">在线:</span> {navigator.onLine ? '✅' : '❌'}</div>
                      <div><span className="text-purple-600">网络:</span> {(navigator as any).connection?.effectiveType || 'unknown'}</div>
                      <div className="text-purple-600">UA:</div>
                      <div className="font-mono text-[10px] break-all">{navigator.userAgent}</div>
                    </div>
                  </div>

                  {/* 样式信息 */}
                  <div className="bg-yellow-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-yellow-900 mb-1 flex items-center gap-1">
                      <span>🎨</span>
                      <span>样式信息</span>
                    </div>
                    <div className="text-xs space-y-1 text-yellow-800">
                      <div><span className="text-yellow-600">Tailwind:</span> v4.0</div>
                      <div><span className="text-yellow-600">色彩模式:</span> {window.matchMedia('(prefers-color-scheme: dark)').matches ? '深色' : '浅色'}</div>
                      <div><span className="text-yellow-600">像素比:</span> {window.devicePixelRatio}</div>
                    </div>
                  </div>

                  {/* 最近日志 */}
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-gray-900 mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span>📝</span>
                        <span>最近日志 ({logs.length})</span>
                      </div>
                      <button
                        onClick={clearLogs}
                        className="px-2 py-0.5 text-[10px] bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                      >
                        清空
                      </button>
                    </div>
                    {logs.length === 0 ? (
                      <div className="text-xs text-gray-500 text-center py-2">暂无日志</div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {logs.slice(0, 5).map((log, index) => (
                          <div
                            key={index}
                            className={`p-1.5 rounded text-[10px] ${
                              log.level === 'error'
                                ? 'bg-red-100 text-red-900'
                                : log.level === 'warn'
                                ? 'bg-yellow-100 text-yellow-900'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="font-mono text-gray-500">{log.time}</span>
                              <span className={`px-1 rounded text-[9px] font-semibold ${
                                log.level === 'error'
                                  ? 'bg-red-200 text-red-800'
                                  : log.level === 'warn'
                                  ? 'bg-yellow-200 text-yellow-800'
                                  : 'bg-blue-200 text-blue-800'
                              }`}>
                                {log.level.toUpperCase()}
                              </span>
                            </div>
                            <pre className="whitespace-pre-wrap break-words font-mono">
                              {log.message.length > 100 ? log.message.slice(0, 100) + '...' : log.message}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 小型浮动按钮（当面板关闭时显示） */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed top-4 right-4 z-[9999] w-10 h-10 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center text-lg"
          style={{ touchAction: 'none' }}
        >
          🐛
        </motion.button>
      )}
    </>
  )
}
