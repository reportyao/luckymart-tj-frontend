import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { 
  HomeIcon, 
  SparklesIcon, 
  PhotoIcon,
  CreditCardIcon, 
  UserIcon 
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  SparklesIcon as SparklesIconSolid,
  PhotoIcon as PhotoIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  UserIcon as UserIconSolid
} from '@heroicons/react/24/solid'
import { cn } from '../../lib/utils'

export const BottomNavigation: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [profileClickCount, setProfileClickCount] = React.useState(0)
  const [clickTimer, setClickTimer] = React.useState<NodeJS.Timeout | null>(null)

  const navigation = [
    {
      name: t('nav.home'),
      path: '/',
      icon: HomeIcon,
      activeIcon: HomeIconSolid,
    },
    {
      name: t('nav.lottery'),
      path: '/lottery',
      icon: SparklesIcon,
      activeIcon: SparklesIconSolid,
    },
    {
      name: t('showoff.showoffGallery'),
      path: '/showoff',
      icon: PhotoIcon,
      activeIcon: PhotoIconSolid,
    },
    {
      name: t('nav.wallet'),
      path: '/wallet',
      icon: CreditCardIcon,
      activeIcon: CreditCardIconSolid,
    },
    {
      name: t('nav.profile'),
      path: '/profile',
      icon: UserIcon,
      activeIcon: UserIconSolid,
    },
  ]

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50"
    >
      <div className="max-w-md mx-auto px-2 py-2">
        <div className="flex items-center justify-around">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = isActive ? item.activeIcon : item.icon

            return (
              <motion.button
                key={item.name}
                onClick={() => {
                  // 如果点击的是"我的" tab
                  if (item.path === '/profile') {
                    // 增加点击计数
                    const newCount = profileClickCount + 1
                    setProfileClickCount(newCount)
                    
                    // 清除之前的定时器
                    if (clickTimer) {
                      clearTimeout(clickTimer)
                    }
                    
                    // 如果连续点击 5 次，触发浮层调试面板
                    if (newCount >= 5) {
                      setProfileClickCount(0)
                      // 触发浮层调试面板（通过自定义事件）
                      window.dispatchEvent(new CustomEvent('showDebugPanel'))
                      return
                    }
                    
                    // 设置 1 秒后重置计数
                    const timer = setTimeout(() => {
                      setProfileClickCount(0)
                    }, 1000)
                    setClickTimer(timer)
                  }
                  
                  navigate(item.path)
                }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center py-2 px-2 rounded-xl transition-all duration-200",
                  isActive 
                    ? "text-blue-600" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{item.name}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}
