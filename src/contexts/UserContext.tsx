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
    let mounted = true

    // 安全地初始化 Telegram Mini App
    const initializeTelegramApp = async () => {
      try {
        // 检查是否在 Telegram 环境中
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
          console.log('Not in Telegram environment, skipping WebApp initialization')
          if (mounted) {
            setIsLoading(false)
          }
          return
        }

        const webApp = window.Telegram.WebApp
        if (!webApp) {
          console.warn('Telegram WebApp is not available')
          if (mounted) {
            setIsLoading(false)
          }
          return
        }

        // 安全地调用 WebApp 方法，添加错误处理
        const safeWebAppCall = (fn: () => void, operation: string) => {
          try {
            fn()
          } catch (error) {
            console.warn(`Telegram WebApp ${operation} failed:`, error)
          }
        }

        // 初始化 WebApp
        safeWebAppCall(() => webApp.ready(), 'ready')
        safeWebAppCall(() => webApp.expand(), 'expand')
        
        // 设置主题
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
        if (webApp.initDataUnsafe?.user && mounted) {
          setTelegramUser(webApp.initDataUnsafe.user)
        }
        
        // 尝试认证
        if (webApp.initData && mounted) {
          await authenticate()
        } else if (mounted) {
          setIsLoading(false)
        }

      } catch (error) {
        console.error('Telegram WebApp initialization failed:', error)
        
        // 只在开发环境使用 mock 数据
        if (import.meta.env.DEV) {
          console.log('Using mock data for development')
          const mockUser: User = {
            id: 'b8156440-3bd2-4dfe-9edc-6ab2bffb6d19',
            telegram_id: '12345678',
            telegram_username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            language_code: 'zh',
            referral_code: 'LMBBBHMV',
            status: 'ACTIVE',
            is_verified: true,
            kyc_level: 'BASIC',
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }
          
          const mockWallets: Wallet[] = [
            {
              id: 'wallet1',
              user_id: mockUser.id,
              type: 'BALANCE',
              currency: 'TJS',
              balance: 1000,
              frozen_balance: 0,
              total_deposits: 2000,
              total_withdrawals: 1000,
              version: 1
            },
            {
              id: 'wallet2',
              user_id: mockUser.id,
              type: 'LUCKY_COIN',
              currency: 'TJS',
              balance: 500,
              frozen_balance: 0,
              total_deposits: 800,
              total_withdrawals: 300,
              version: 1
            }
          ]
          
          if (mounted) {
            setUser(mockUser)
            setWallets(mockWallets)
            setTelegramUser({
              id: 12345678,
              first_name: 'Test',
              last_name: 'User',
              username: 'testuser',
              photo_url: ''
            })
          }
        } else {
          // 生产环境显示错误提示
          console.error('Failed to initialize Telegram WebApp in production')
          toast.error('无法连接到 Telegram，请在 Telegram 中打开应用')
        }
        
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeTelegramApp()

    // 清理函数
    return () => {
      mounted = false
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