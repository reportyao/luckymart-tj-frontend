import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

interface RouteChange {
  time: string
  from: string
  to: string
  trigger?: string
}

interface AuthCheck {
  time: string
  method: 'getUser' | 'getSession'
  success: boolean
  userId?: string | null
  sessionExists?: boolean
  error?: string
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
  // Telegram环境
  telegram: {
    isInTelegram: boolean
    initDataAvailable: boolean
    webAppVersion?: string
  }
  // 认证状态
  auth: {
    hasUser: boolean
    hasSession: boolean
    lastCheck?: string
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
  // 路由跳转记录
  routes: RouteChange[]
  // 认证检查记录
  authChecks: AuthCheck[]
}

export const DebugFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [requests, setRequests] = useState<NetworkRequest[]>([])
  const [routes, setRoutes] = useState<RouteChange[]>([])
  const [authChecks, setAuthChecks] = useState<AuthCheck[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const { user, telegramUser } = useUser()
  const location = useLocation()
  const navigate = useNavigate()

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

        clearTimeout(touchTimer)
        touchTimer = setTimeout(() => {
          touchCount = 0
        }, 1000)
      }
    }

    document.addEventListener('touchstart', handleTouchStart)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      clearTimeout(touchTimer)
    }
  }, [])

  // 拦截路由跳转
  useEffect(() => {
    const prevPath = sessionStorage.getItem('debug_prev_path') || '/'
    
    if (prevPath !== location.pathname) {
      const routeChange: RouteChange = {
        time: new Date().toLocaleTimeString('zh-CN'),
        from: prevPath,
        to: location.pathname
      }
      
      setRoutes(prev => [routeChange, ...prev.slice(0, 9)])
      sessionStorage.setItem('debug_prev_path', location.pathname)
    }
  }, [location.pathname])

  // 拦截 supabase.auth 方法
  useEffect(() => {
    const originalGetUser = supabase.auth.getUser.bind(supabase.auth)
    const originalGetSession = supabase.auth.getSession.bind(supabase.auth)

    // 拦截 getUser
    supabase.auth.getUser = async () => {
      const startTime = Date.now()
      const result = await originalGetUser()
      const duration = Date.now() - startTime

      const authCheck: AuthCheck = {
        time: new Date().toLocaleTimeString('zh-CN'),
        method: 'getUser',
        success: !result.error && !!result.data.user,
        userId: result.data.user?.id || null,
        error: result.error?.message
      }

      setAuthChecks(prev => [authCheck, ...prev.slice(0, 9)])
      
      return result
    }

    // 拦截 getSession
    supabase.auth.getSession = async () => {
      const startTime = Date.now()
      const result = await originalGetSession()
      const duration = Date.now() - startTime

      const authCheck: AuthCheck = {
        time: new Date().toLocaleTimeString('zh-CN'),
        method: 'getSession',
        success: !result.error && !!result.data.session,
        sessionExists: !!result.data.session,
        userId: result.data.session?.user?.id || null,
        error: result.error?.message
      }

      setAuthChecks(prev => [authCheck, ...prev.slice(0, 9)])
      
      return result
    }

    return () => {
      supabase.auth.getUser = originalGetUser
      supabase.auth.getSession = originalGetSession
    }
  }, [])

  // 拦截 fetch 请求
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args: Parameters<typeof fetch>) => {
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
          ...prev.slice(0, 19)
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

  // 拦截 console 方法
  useEffect(() => {
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    const addLog = (level: 'info' | 'warn' | 'error', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')

      setLogs(prev => [
        {
          time: new Date().toLocaleTimeString('zh-CN'),
          level,
          message,
          data: args
        },
        ...prev.slice(0, 49)
      ])
    }

    console.log = (...args: any[]) => {
      originalLog(...args)
      addLog('info', args)
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      addLog('warn', args)
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      addLog('error', args)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }
  }, [])

  const getDebugInfo = (): DebugInfo => {
    // 检测Telegram环境
    const isInTelegram = !!(window as any).Telegram?.WebApp
    const telegramWebApp = (window as any).Telegram?.WebApp
    
    return {
      page: {
        path: location.pathname,
        title: document.title,
        timestamp: new Date().toISOString()
      },
      user: {
        id: user?.id || null,
        telegramId: telegramUser?.id || null,
        username: user?.telegram_username || telegramUser?.username || null,
        balance: (user as any)?.balance,
        lucky_coins: (user as any)?.lucky_coins
      },
      telegram: {
        isInTelegram,
        initDataAvailable: !!telegramWebApp?.initData,
        webAppVersion: telegramWebApp?.version
      },
      auth: {
        hasUser: !!user,
        hasSession: false, // 将在拦截中更新
        lastCheck: authChecks[0]?.time
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
        effectiveType: (navigator as any).connection?.effectiveType
      },
      styles: {
        tailwindVersion: '4.0',
        colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      },
      logs,
      requests,
      routes,
      authChecks
    }
  }

  const copyDebugInfo = () => {
    const info = getDebugInfo()
    navigator.clipboard.writeText(JSON.stringify(info, null, 2))
    alert('调试信息已复制到剪贴板')
  }

  const clearLogs = () => {
    setLogs([])
    setRequests([])
    setRoutes([])
    setAuthChecks([])
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-black/95 text-white shadow-2xl"
          style={{ maxHeight: isMinimized ? '60px' : '80vh' }}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">🐛 调试面板</span>
              <span className="text-xs text-gray-400">v2.0</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
              >
                {isMinimized ? '展开' : '收起'}
              </button>
              <button
                onClick={copyDebugInfo}
                className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-700"
              >
                复制
              </button>
              <button
                onClick={clearLogs}
                className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-700"
              >
                清空
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsVisible(false)
                }}
                className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
              >
                关闭
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          {!isMinimized && (
            <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(80vh - 60px)' }}>
              {/* Telegram环境 */}
              <div className="bg-gray-800 rounded p-3">
                <h3 className="font-bold mb-2 text-purple-400">🤖 Telegram环境</h3>
                <div className="text-xs space-y-1">
                  <div>在Telegram中: <span className={getDebugInfo().telegram.isInTelegram ? 'text-green-400' : 'text-red-400'}>
                    {getDebugInfo().telegram.isInTelegram ? '是 ✅' : '否 ❌'}
                  </span></div>
                  <div>InitData可用: <span className={getDebugInfo().telegram.initDataAvailable ? 'text-green-400' : 'text-red-400'}>
                    {getDebugInfo().telegram.initDataAvailable ? '是 ✅' : '否 ❌'}
                  </span></div>
                  {getDebugInfo().telegram.webAppVersion && (
                    <div>WebApp版本: {getDebugInfo().telegram.webAppVersion}</div>
                  )}
                </div>
              </div>

              {/* 认证状态 */}
              <div className="bg-gray-800 rounded p-3">
                <h3 className="font-bold mb-2 text-blue-400">🔐 认证状态</h3>
                <div className="text-xs space-y-1">
                  <div>有用户: <span className={getDebugInfo().auth.hasUser ? 'text-green-400' : 'text-red-400'}>
                    {getDebugInfo().auth.hasUser ? '是 ✅' : '否 ❌'}
                  </span></div>
                  <div>用户ID: {user?.id || '无'}</div>
                  <div>Telegram ID: {telegramUser?.id || '无'}</div>
                </div>
              </div>

              {/* 认证检查记录 */}
              {authChecks.length > 0 && (
                <div className="bg-gray-800 rounded p-3">
                  <h3 className="font-bold mb-2 text-blue-400">🔍 认证检查记录 ({authChecks.length})</h3>
                  <div className="space-y-2 text-xs max-h-40 overflow-y-auto">
                    {authChecks.map((check, idx) => (
                      <div key={idx} className={`p-2 rounded ${check.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <div className="flex justify-between items-start">
                          <span className="font-mono">{check.time}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${check.success ? 'bg-green-600' : 'bg-red-600'}`}>
                            {check.method}
                          </span>
                        </div>
                        <div className="mt-1">
                          成功: {check.success ? '✅' : '❌'}
                          {check.userId && <div>用户ID: {check.userId}</div>}
                          {check.sessionExists !== undefined && <div>Session存在: {check.sessionExists ? '✅' : '❌'}</div>}
                          {check.error && <div className="text-red-400">错误: {check.error}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 路由跳转记录 */}
              {routes.length > 0 && (
                <div className="bg-gray-800 rounded p-3">
                  <h3 className="font-bold mb-2 text-yellow-400">🧭 路由跳转记录 ({routes.length})</h3>
                  <div className="space-y-2 text-xs max-h-40 overflow-y-auto">
                    {routes.map((route, idx) => (
                      <div key={idx} className="p-2 bg-gray-700 rounded">
                        <div className="font-mono text-gray-400">{route.time}</div>
                        <div className="mt-1">
                          <span className="text-red-400">{route.from}</span>
                          <span className="mx-2">→</span>
                          <span className="text-green-400">{route.to}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 网络请求记录 */}
              {requests.length > 0 && (
                <div className="bg-gray-800 rounded p-3">
                  <h3 className="font-bold mb-2 text-green-400">🌐 网络请求 ({requests.length})</h3>
                  <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                    {requests.map((req, idx) => (
                      <div key={idx} className={`p-2 rounded ${req.status && req.status >= 200 && req.status < 300 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <div className="flex justify-between items-start">
                          <span className="font-mono">{req.time}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${req.status && req.status >= 200 && req.status < 300 ? 'bg-green-600' : 'bg-red-600'}`}>
                            {req.method} {req.status || 'ERR'}
                          </span>
                        </div>
                        <div className="mt-1 break-all">{req.url}</div>
                        {req.statusText && <div className="text-gray-400">状态: {req.statusText}</div>}
                        {req.duration && <div className="text-gray-400">耗时: {req.duration}ms</div>}
                        {req.error && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-red-400">错误详情</summary>
                            <pre className="mt-1 p-2 bg-black/50 rounded overflow-x-auto text-xs">{req.error}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 控制台日志 */}
              {logs.length > 0 && (
                <div className="bg-gray-800 rounded p-3">
                  <h3 className="font-bold mb-2">📝 控制台日志 ({logs.length})</h3>
                  <div className="space-y-1 text-xs max-h-60 overflow-y-auto">
                    {logs.map((log, idx) => (
                      <div key={idx} className={`p-2 rounded ${
                        log.level === 'error' ? 'bg-red-900/30' : 
                        log.level === 'warn' ? 'bg-yellow-900/30' : 
                        'bg-gray-700'
                      }`}>
                        <span className="font-mono text-gray-400">{log.time}</span>
                        <span className={`ml-2 px-1 rounded text-xs ${
                          log.level === 'error' ? 'bg-red-600' : 
                          log.level === 'warn' ? 'bg-yellow-600' : 
                          'bg-blue-600'
                        }`}>{log.level}</span>
                        <div className="mt-1 break-all">{log.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 用户信息 */}
              <div className="bg-gray-800 rounded p-3">
                <h3 className="font-bold mb-2">👤 用户信息</h3>
                <div className="text-xs space-y-1">
                  <div>ID: {user?.id || '未登录'}</div>
                  <div>Telegram ID: {telegramUser?.id || '无'}</div>
                  <div>用户名: {user?.telegram_username || telegramUser?.username || '无'}</div>
                  <div>余额: {(user as any)?.balance || 0}</div>
                  <div>幸运币: {(user as any)?.lucky_coins || 0}</div>
                </div>
              </div>

              {/* 系统信息 */}
              <div className="bg-gray-800 rounded p-3">
                <h3 className="font-bold mb-2">⚙️ 系统信息</h3>
                <div className="text-xs space-y-1">
                  <div>平台: {navigator.platform}</div>
                  <div>语言: {navigator.language}</div>
                  <div>在线: {navigator.onLine ? '是' : '否'}</div>
                  <div>网络: {(navigator as any).connection?.effectiveType || '未知'}</div>
                  <div>视口: {window.innerWidth} x {window.innerHeight}</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
