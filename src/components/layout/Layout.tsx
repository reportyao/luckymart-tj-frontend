import React from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../../contexts/UserContext'
import { cn } from '../../lib/utils'

interface LayoutProps {
  children: React.ReactNode
  className?: string
  showHeader?: boolean
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  className,
  showHeader = true 
}) => {
  const { user, telegramUser } = useUser()

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
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LM</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">LuckyMart</h1>
                  <p className="text-xs text-gray-500">社交夺宝平台</p>
                </div>
              </div>
              
              {user && (
                <div className="flex items-center space-x-2">
                  {telegramUser?.photo_url ? (
                    <img 
                      src={telegramUser.photo_url} 
                      alt="Avatar"
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
	                      <span className="text-white text-xs font-medium">
		                        {(user as any).user_metadata?.first_name?.[0] || 'U'}
	                      </span>
                    </div>
                  )}
                  <div className="text-right">
		                    <p className="text-sm font-medium text-gray-900">
		                      {(user as any).user_metadata?.first_name} {(user as any).user_metadata?.last_name}
		                    </p>
		                    <p className="text-xs text-gray-500">
		                      ID: {(user as any).user_metadata?.referral_code}
		                    </p>
	                  </div>
	                </div>
	              )}
	            </div>
	          </div>
	        </motion.header>
      )}
      
      <main className="max-w-md mx-auto">
        {children}
      </main>
    </div>
  )
}