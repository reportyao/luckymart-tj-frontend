import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext'
import { 
  UserCircleIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { formatDateTime, copyToClipboard, shareToTelegram } from '../lib/utils'
import toast from 'react-hot-toast'

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const { user, telegramUser, logout } = useUser()
  const navigate = useNavigate()

  const handleCopyReferralCode = async () => {
    if (user?.referral_code) {
      const success = await copyToClipboard(user.referral_code)
      if (success) {
        toast.success(t('profile.copyReferralCode'))
      } else {
        toast.error(t('error.unknownError'))
      }
    }
  }

  const handleShareReferral = () => {
    if (user?.referral_code) {
      const shareText = `🎉 ${t('auth.welcome')}! ${t('home.referralCode')}: ${user.referral_code}`
      const shareUrl = `https://t.me/your_bot_username?start=ref_${user.referral_code}`
      shareToTelegram(shareText, shareUrl)
    }
  }

  const menuItems = [
    {
      icon: UserCircleIcon,
      title: t('profile.accountInfo'),
      subtitle: t('common.edit'),
      action: () => navigate('/profile/edit'),
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: t('nav.bot'),
      subtitle: 'Telegram Bot',
      action: () => navigate('/bot'),
    },
    // 系统监控入口（所有用户可见）
    {
      icon: ChartBarIcon,
      title: t('nav.monitoring'),
      subtitle: 'System Status',
      action: () => navigate('/monitoring'),
    },
    {
      icon: ShieldCheckIcon,
      title: t('wallet.security'),
      subtitle: t('wallet.paymentPassword'),
      action: () => toast(t('common.loading')),
    },
    {
      icon: CogIcon,
      title: t('profile.settings'),
      subtitle: t('profile.language'),
      action: () => navigate('/settings'),
    },
    {
      icon: QuestionMarkCircleIcon,
      title: t('common.help') || 'Help',
      subtitle: 'FAQ',
      action: () => toast(t('common.loading')),
    },
  ]

  const getKycLevelText = (level: string) => {
    switch (level) {
      case 'BASIC': return t('wallet.basicVerification')
      case 'INTERMEDIATE': return t('wallet.authentication')
      case 'ADVANCED': return t('wallet.authentication')
      default: return t('wallet.notSet')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-50'
      case 'SUSPENDED': return 'text-orange-600 bg-orange-50'
      case 'BANNED': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="pb-20">
      {/* 用户信息卡片 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white mx-4 mt-4 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-4">
          {/* 头像 */}
          <div className="relative">
            {telegramUser?.photo_url ? (
              <img 
                src={telegramUser.photo_url} 
                alt="Avatar"
                className="w-16 h-16 rounded-full border-4 border-white/20"
              />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {user?.first_name?.[0] || 'U'}
                </span>
              </div>
            )}
            
            {user?.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* 用户信息 */}
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-white/80 text-sm">
              @{user?.telegram_username || 'username'}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                user ? getStatusColor(user.status) : 'text-gray-600 bg-gray-50'
              }`}>
                {user?.status === 'ACTIVE' ? t('invite.active') : user?.status}
              </span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/20">
                {user ? getKycLevelText(user.kyc_level) : t('wallet.notSet')}
              </span>
            </div>
          </div>
        </div>

        {/* 用户ID和加入时间 */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-white/60">{t('invite.username')}</p>
              <p className="font-medium">{user?.referral_code}</p>
            </div>
            <div className="text-right">
              <p className="text-white/60">{t('invite.joinTime')}</p>
              <p className="font-medium">
                {user?.created_at ? formatDateTime(user.created_at) : '--'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 推荐码卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl mx-4 mt-4 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('invite.myInviteCode')}</h3>
          <ShareIcon className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-2xl font-bold text-center text-gray-900 font-mono">
            {user?.referral_code || '------'}
          </p>
        </div>

        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyReferralCode}
            className="flex-1 bg-blue-50 text-blue-600 py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-1"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
            <span>{t('common.copy') || t('invite.copyCode')}</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShareReferral}
            className="flex-1 bg-green-50 text-green-600 py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-1"
          >
            <ShareIcon className="w-4 h-4" />
            <span>{t('common.share') || t('invite.shareInvite')}</span>
          </motion.button>
        </div>
      </motion.div>

      {/* 菜单列表 */}
      <div className="mx-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {menuItems.map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              onClick={item.action}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* 退出登录 */}
      <div className="mx-4 mt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={logout}
          className="w-full bg-white border border-red-200 text-red-600 py-4 rounded-2xl font-semibold flex items-center justify-center space-x-2 hover:bg-red-50 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
          <span>{t('profile.logout')}</span>
        </motion.button>
      </div>

      {/* 版本信息 */}
      <div className="text-center mt-8 px-4">
        <p className="text-xs text-gray-400">
          LuckyMart v1.0.0
        </p>
        <p className="text-xs text-gray-400 mt-1">
          © 2024 LuckyMart. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default ProfilePage