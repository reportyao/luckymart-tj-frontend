import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Bell, X, Check } from 'lucide-react'

interface BotFollowModalProps {
  onClose: () => void
  onSuccess?: () => void
}

// 检查用户是否已经授权过
const hasGrantedWriteAccess = (): boolean => {
  try {
    return localStorage.getItem('bot_write_access_granted') === 'true'
  } catch {
    return false
  }
}

// 记录用户已授权
const setWriteAccessGranted = (granted: boolean): void => {
  try {
    localStorage.setItem('bot_write_access_granted', granted ? 'true' : 'false')
  } catch {
    // localStorage 不可用时忽略
  }
}

// 检查是否已经显示过弹窗（本次会话）
const hasShownModalThisSession = (): boolean => {
  try {
    return sessionStorage.getItem('bot_follow_modal_shown') === 'true'
  } catch {
    return false
  }
}

// 标记已显示过弹窗
const setModalShownThisSession = (): void => {
  try {
    sessionStorage.setItem('bot_follow_modal_shown', 'true')
  } catch {
    // sessionStorage 不可用时忽略
  }
}

/**
 * Bot关注引导弹窗组件
 * 引导用户授权Bot发送消息，使Bot出现在用户的聊天列表中
 */
export const BotFollowModal: React.FC<BotFollowModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation()
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestResult, setRequestResult] = useState<'success' | 'denied' | null>(null)

  // 请求写入权限
  const handleRequestAccess = useCallback(() => {
    const tg = (window as any).Telegram?.WebApp
    
    if (!tg?.requestWriteAccess) {
      console.warn('[BotFollowModal] requestWriteAccess not available')
      // 如果API不可用，直接关闭弹窗
      onClose()
      return
    }

    setIsRequesting(true)

    tg.requestWriteAccess((allowed: boolean) => {
      console.log('[BotFollowModal] Write access result:', allowed)
      setIsRequesting(false)
      
      if (allowed) {
        setWriteAccessGranted(true)
        setRequestResult('success')
        // 延迟关闭，让用户看到成功状态
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 1500)
      } else {
        setRequestResult('denied')
        // 用户拒绝后，记录本次会话已显示过
        setModalShownThisSession()
        // 延迟关闭
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    })
  }, [onClose, onSuccess])

  // 跳过（稍后再说）
  const handleSkip = useCallback(() => {
    setModalShownThisSession()
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isRequesting) {
            handleSkip()
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* 关闭按钮 */}
          {!isRequesting && requestResult === null && (
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}

          {/* 头部装饰 */}
          <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-6 pt-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                {requestResult === 'success' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                  >
                    <Check className="w-10 h-10 text-green-500" />
                  </motion.div>
                ) : (
                  <MessageCircle className="w-10 h-10 text-blue-500" />
                )}
              </div>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-6 text-center">
            {requestResult === 'success' ? (
              <>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {t('botFollow.successTitle')}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('botFollow.successMessage')}
                </p>
              </>
            ) : requestResult === 'denied' ? (
              <>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {t('botFollow.deniedTitle')}
                </h3>
                <p className="text-gray-600 text-sm">
                  {t('botFollow.deniedMessage')}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {t('botFollow.title')}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {t('botFollow.description')}
                </p>

                {/* 功能列表 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {t('botFollow.benefit1Title')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('botFollow.benefit1Desc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {t('botFollow.benefit2Title')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('botFollow.benefit2Desc')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 按钮区域 */}
                <div className="space-y-3">
                  <button
                    onClick={handleRequestAccess}
                    disabled={isRequesting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRequesting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-5 h-5" />
                        {t('botFollow.confirmButton')}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={isRequesting}
                    className="w-full py-2 px-4 text-gray-500 text-sm hover:text-gray-700 transition-colors disabled:opacity-50"
                  >
                    {t('botFollow.skipButton')}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Hook: 检查是否需要显示Bot关注弹窗
 */
export const useBotFollowModal = () => {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // 检查是否在Telegram环境中
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      console.log('[useBotFollowModal] Not in Telegram environment')
      return
    }

    // 检查是否已经授权过
    if (hasGrantedWriteAccess()) {
      console.log('[useBotFollowModal] Already granted write access')
      return
    }

    // 检查本次会话是否已经显示过
    if (hasShownModalThisSession()) {
      console.log('[useBotFollowModal] Already shown modal this session')
      return
    }

    // 检查API是否可用
    if (!tg.requestWriteAccess) {
      console.log('[useBotFollowModal] requestWriteAccess API not available')
      return
    }

    // 延迟显示弹窗，让用户先看到主界面
    const timer = setTimeout(() => {
      console.log('[useBotFollowModal] Showing bot follow modal')
      setShowModal(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleSuccess = useCallback(() => {
    console.log('[useBotFollowModal] User granted write access')
  }, [])

  return {
    showModal,
    closeModal,
    handleSuccess,
  }
}

export default BotFollowModal
