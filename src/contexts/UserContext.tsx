import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import WebApp from '@twa-dev/sdk'
import { User, Wallet, authService, walletService } from '../lib/supabase'
import toast from 'react-hot-toast'

// 扩展 Window 接口以支持 Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: any
    }
  }
}

interface UserContextType {
  user: User | null
  wallets: Wallet[]
  isLoading: boolean
  isAuthenticated: boolean
  telegramUser: any
  authenticate: () => Promise<void>
  refreshWallets: () => Promise<void>
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: ReactNode
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [telegramUser, setTelegramUser] = useState<any>(null)
  const initializeRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // 防止重复初始化
    if (initializeRef.current) {
      return
    }
    initializeRef.current = true

    // 安全地初始化 Telegram Mini App
    const initializeTelegramApp = () => {
      try {
        // 检查是否在 Telegram 环境中
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
          console.log('Not in Telegram environment, skipping WebApp initialization')
          setIsLoading(false)
          return
        }

        const webApp = window.Telegram.WebApp || WebApp

        // 安全地调用 WebApp 方法，添加错误处理
        const safeWebAppCall = (fn: () => void, operation: string) => {
          try {
            fn()
          } catch (error) {
            console.warn(`Telegram WebApp ${operation} failed:`, error)
          }
        }

        // 延迟初始化，确保 DOM 稳定
        setTimeout(() => {
          safeWebAppCall(() => webApp.ready(), 'ready')
          safeWebAppCall(() => webApp.expand(), 'expand')
          
          // 设置主题，但要防止 DOM 操作错误
          safeWebAppCall(() => {
            if (webApp.setBackgroundColor) {
              webApp.setBackgroundColor('#f8fafc')
            }
          }, 'setBackgroundColor')
          
          safeWebAppCall(() => {
            if (webApp.setHeaderColor) {
              webApp.setHeaderColor('#ffffff')
            }
          }, 'setHeaderColor')

          // 获取 Telegram 用户数据
          if (webApp.initDataUnsafe?.user) {
            setTelegramUser(webApp.initDataUnsafe.user)
          }
          
          // 尝试认证
          if (webApp.initData) {
            authenticate().catch(error => {
              console.error('Authentication failed:', error)
              setIsLoading(false)
            })
          } else {
            setIsLoading(false)
          }
        }, 100) // 短暂延迟让 DOM 稳定

      } catch (error) {
        console.log('Telegram WebApp initialization failed:', error)
        // 开发/测试环境或非 Telegram 环境
        setIsLoading(false)
      }
    }

    // 使用 requestAnimationFrame 确保在下一个渲染周期初始化
    requestAnimationFrame(initializeTelegramApp)

    // 清理函数
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  const authenticate = async () => {
    try {
      setIsLoading(true)
      
      // 安全地访问 WebApp
      const webApp = window.Telegram?.WebApp || WebApp
      if (!webApp.initData) {
        throw new Error('No Telegram init data available')
      }

      // 获取启动参数
      const urlParams = new URLSearchParams(window.location.search)
      const startParam = urlParams.get('tgWebAppStartParam')

      const result = await authService.authenticateWithTelegram(
        webApp.initData,
        startParam
      )

      if (result.data.success) {
        setUser(result.data.user)
        setWallets(result.data.wallets || [])
        
        if (result.data.is_new_user) {
          toast.success('欢迎加入LuckyMart！', {
            duration: 3000,
            position: 'top-center',
          })
        } else {
          toast.success('登录成功！', {
            duration: 2000,
            position: 'top-center',
          })
        }
      }
    } catch (error: any) {
      console.error('Authentication failed:', error)
      toast.error(error.message || '登录失败，请重试', {
        duration: 3000,
        position: 'top-center',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const refreshWallets = async () => {
    if (!user) return
    
    try {
      const walletsData = await walletService.getWallets(user.id)
      setWallets(walletsData)
    } catch (error: any) {
      console.error('Failed to refresh wallets:', error)
      toast.error('钱包数据更新失败', {
        duration: 2000,
        position: 'top-center',
      })
    }
  }

  const logout = () => {
    setUser(null)
    setWallets([])
    setTelegramUser(null)
    toast.success('已退出登录', {
      duration: 2000,
      position: 'top-center',
    })
  }

  const value: UserContextType = {
    user,
    wallets,
    isLoading,
    isAuthenticated: !!user,
    telegramUser,
    authenticate,
    refreshWallets,
    logout
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}