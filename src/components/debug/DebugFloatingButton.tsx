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

interface NetworkRequest {
  time: string
  method: string
  url: string
  status?: number
  statusText?: string
  error?: string
  duration?: number
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
    balance?: number
    lucky_coins?: number
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
  // 网络请求记录
  requests: NetworkRequest[]
}

export const DebugFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [requests, setRequests] = useState<NetworkRequest[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const { user, telegramUser } = useUser()
  const location = useLocation()

  // 监听自定义事件：点击"我的"5次触发
  useEffect(() => {
    const handleShowDebugPanel = () => {
      setIsVisible(true)
      setIsOpen(true)
    }

    window.addEventListener('showDebugPanel', handleShowDebugPanel as EventListener)

    return () => {
      window.removeEventListener('showDebugPanel', handleShowDebugPanel as EventListener)
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

  // 拦截 fetch 请求
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const startTime = Date.now()
      const [url, options] = args
      const method = options?.method || 'GET'
      const urlString = typeof url === 'string' ? url : url.toString()

      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime

        // 克隆响应以便读取
        const clonedResponse = response.clone()
        let errorDetail = ''

        // 如果是错误响应，尝试读取错误信息
        if (!response.ok) {
          try {
            const contentType = response.headers.get('content-type')
            if (contentType?.includes('application/json')) {
              const errorData = await clonedResponse.json()
              errorDetail = JSON.stringify(errorData, null, 2)
            } else {
              errorDetail = await clonedResponse.text()
            }
          } catch (e) {
            errorDetail = '无法读取错误详情'
          }
        }

        setRequests(prev => [
          {
            time: new Date().toLocaleTimeString('zh-CN'),
            method,
            url: urlString,
            status: response.status,
            statusText: response.statusText,
            error: errorDetail || undefined,
            duration
          },
          ...prev.slice(0, 19) // 最多保留 20 条
        ])

        return response
      } catch (error: any) {
        const duration = Date.now() - startTime

        setRequests(prev => [
          {
            time: new Date().toLocaleTimeString('zh-CN'),
            method,
            url: urlString,
            error: error.message || String(error),
            duration
          },
          ...prev.slice(0, 19)
        ])

        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
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
        username: telegramUser?.username || user?.telegram_username || null,
        balance: (user as any)?.balance || 0,
        lucky_coins: (user as any)?.lucky_coins || 0
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
      logs: logs.slice(0, 10),
      requests: requests.slice(0, 10)
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
    setRequests([])
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
            style={{ maxHeight: isMinimized ? '48px' : '70vh' }}
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
                  onClick={clearLogs}
                  className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
                >
                  清空
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
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 48px)' }}>
                {/* 快速信息栏 */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 border-b border-gray-200 text-xs">
                  <div>
                    <div className="text-gray-500">用户ID</div>
                    <div className="font-mono text-gray-900 truncate text-[10px]">{user?.id || '未登录'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">余额</div>
                    <div className="font-mono text-gray-900">{(user as any)?.balance || 0} TJS</div>
                  </div>
                  <div>
                    <div className="text-gray-500">视口</div>
                    <div className="font-mono text-gray-900">{window.innerWidth}×{window.innerHeight}</div>
                  </div>
                </div>

                {/* 详细信息区域 */}
                <div className="p-3 space-y-3">
                  {/* 网络请求记录 */}
                  <div className="bg-orange-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-orange-900 mb-1 flex items-center gap-1 justify-between">
                      <div className="flex items-center gap-1">
                        <span>🌐</span>
                        <span>网络请求 ({requests.length})</span>
                      </div>
                      <span className="text-[10px] opacity-75">最近20条</span>
                    </div>
                    <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
                      {requests.length === 0 ? (
                        <div className="text-orange-600 text-center py-2">暂无请求记录</div>
                      ) : (
                        requests.map((req, idx) => (
                          <div key={idx} className="bg-white rounded p-2 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-semibold ${
                                req.status && req.status >= 200 && req.status < 300 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {req.method} {req.status || 'FAILED'}
                              </span>
                              <span className="text-gray-500 text-[10px]">{req.time}</span>
                            </div>
                            <div className="text-[10px] text-gray-700 break-all mb-1">
                              {req.url}
                            </div>
                            {req.statusText && (
                              <div className="text-[10px] text-gray-600">
                                状态: {req.statusText}
                              </div>
                            )}
                            {req.duration && (
                              <div className="text-[10px] text-gray-600">
                                耗时: {req.duration}ms
                              </div>
                            )}
                            {req.error && (
                              <div className="text-[10px] text-red-600 mt-1 bg-red-50 p-1 rounded">
                                <div className="font-semibold">错误详情:</div>
                                <pre className="whitespace-pre-wrap mt-1">{req.error}</pre>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 控制台日志 */}
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-gray-900 mb-1 flex items-center gap-1 justify-between">
                      <div className="flex items-center gap-1">
                        <span>📝</span>
                        <span>控制台日志 ({logs.length})</span>
                      </div>
                      <span className="text-[10px] opacity-75">最近50条</span>
                    </div>
                    <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                      {logs.length === 0 ? (
                        <div className="text-gray-600 text-center py-2">暂无日志</div>
                      ) : (
                        logs.map((log, idx) => (
                          <div key={idx} className={`p-1 rounded ${
                            log.level === 'error' ? 'bg-red-50 text-red-800' :
                            log.level === 'warn' ? 'bg-yellow-50 text-yellow-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] opacity-75">{log.time}</span>
                              <span className="font-semibold text-[10px]">[{log.level.toUpperCase()}]</span>
                            </div>
                            <pre className="text-[10px] whitespace-pre-wrap mt-1">{log.message}</pre>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 用户信息 */}
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-xs font-semibold text-green-900 mb-1 flex items-center gap-1">
                      <span>👤</span>
                      <span>用户信息</span>
                    </div>
                    <div className="text-xs space-y-1 text-green-800">
                      <div><span className="text-green-600">用户ID:</span> <span className="font-mono text-[10px]">{user?.id || '未登录'}</span></div>
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
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
