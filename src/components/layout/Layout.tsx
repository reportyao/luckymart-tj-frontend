import React from "react"
import { motion } from "framer-motion"
import { useUser } from "../../contexts/UserContext"
import { cn } from "../../lib/utils"
import { BottomNavigation } from "../navigation/BottomNavigation"
import { useTranslation } from 'react-i18next'

interface LayoutProps {
  children: React.ReactNode
  className?: string
  showHeader?: boolean
  showBottomNav?: boolean
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  className,
  showHeader = true,
  showBottomNav = true
}) => {
  const { user, telegramUser } = useUser()
  const { t } = useTranslation()

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50",
      className
    )}>
      {showHeader && (
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50"
        >
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src="/tezbarakat-logo.png" 
                  alt="TezBarakat Logo"
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <h1 className="text-lg font-bold text-gray-900">TezBarakat</h1>
                  <p className="text-xs text-gray-500">{t('home.tagline')}</p>
                </div>
              </div>
              
              {user && telegramUser?.photo_url && (
                <img 
                  src={telegramUser.photo_url} 
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
              )}
            </div>
          </div>
        </motion.header>
      )}
      
      <main className={cn(
        "max-w-md mx-auto",
        showBottomNav && "pb-20"
      )}>
        {children}
      </main>

      {showBottomNav && <BottomNavigation />}
    </div>
  )
}
