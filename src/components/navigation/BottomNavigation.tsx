import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { 
  HomeIcon, 
  SparklesIcon, 
  CreditCardIcon, 
  UserIcon 
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  SparklesIcon as SparklesIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  UserIcon as UserIconSolid
} from '@heroicons/react/24/solid'
import { cn } from '../../lib/utils'

export const BottomNavigation: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

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
      <div className="max-w-md mx-auto px-4 py-2">
        <div className="flex items-center justify-around">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = isActive ? item.activeIcon : item.icon

            return (
              <motion.button
                key={item.name}
                onClick={() => navigate(item.path)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "text-blue-600 bg-blue-50" 
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -inset-1 bg-blue-100 rounded-lg -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                      }}
                    />
                  )}
                </div>
                
                <span className={cn(
                  "text-xs font-medium mt-1",
                  isActive ? "text-blue-600" : "text-gray-600"
                )}>
                  {item.name}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}