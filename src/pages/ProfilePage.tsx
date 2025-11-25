import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext'
import { 
  UserCircleIcon,
  CogIcon,
  ShoppingBagIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  PhotoIcon,
  BellIcon,
  UsersIcon,
  TrophyIcon,
  LanguageIcon
} from '@heroicons/react/24/outline'
import { copyToClipboard, shareToTelegram } from '../lib/utils'
import toast from 'react-hot-toast'

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const { user, logout } = useUser()
  const navigate = useNavigate()

  const handleCopyReferralLink = async () => {
    if (user?.invite_code) {
      // 复制完整的邀请链接
      const inviteLink = `https://t.me/mybot2636_bot?start=ref_${user.invite_code}`
      const success = await copyToClipboard(inviteLink)
      if (success) {
        toast.success(t('profile.copyReferralCode'))
      } else {
        toast.error(t('error.unknownError'))
      }
    }
  }

  const handleShareReferral = () => {
    if (user?.invite_code) {
      const shareText = `🎉 ${t('auth.welcome')}! ${t('home.referralCode')}: ${user.invite_code}`
      const shareUrl = `https://t.me/mybot2636_bot?start=ref_${user.invite_code}`
      shareToTelegram(shareText, shareUrl)
    }
  }

  // 三个功能卡片
  const featureCards = [
    {
      icon: ShoppingBagIcon,
      title: t('market.resaleMarket') || '转售市场',
      subtitle: t('market.buyResaleItems') || '购买转售商品',
      color: 'from-blue-500 to-blue-600',
      action: () => navigate('/market'),
    },
    {
      icon: UsersIcon,
      title: t('invite.myTeam') || '我的团队',
      subtitle: t('invite.viewTeamInfo') || '查看团队信息',
      color: 'from-purple-500 to-purple-600',
      action: () => navigate('/invite'),
    },
    {
      icon: TrophyIcon,
      title: t('prize.prizeManagement') || '中奖管理',
      subtitle: t('prize.viewPrizes') || '查看中奖记录',
      color: 'from-orange-500 to-orange-600',
      action: () => navigate('/prizes'),
    },
  ]

  // 精简后的菜单项
  const menuItems = [
    {
      icon: UserCircleIcon,
      title: t('profile.accountInfo'),
      subtitle: t('common.edit'),
      action: () => navigate('/profile/edit'),
    },
    {
      icon: LanguageIcon,
      title: t('profile.language'),
      subtitle: t('profile.settings'),
      action: () => navigate('/settings'),
    },
    {
      icon: BellIcon,
      title: t('nav.notifications') || t('profile.notifications') || '我的消息',
      subtitle: t('profile.viewNotifications') || '查看消息通知',
      action: () => navigate('/notifications'),
    },
    {
      icon: ShoppingBagIcon,
      title: t('market.resaleRecords') || '转售记录',
      subtitle: t('market.viewResaleHistory') || '查看转售历史',
      action: () => navigate('/market/my-resales'),
    },
    {
      icon: PhotoIcon,
      title: t('showoff.myShowoffs') || '晒单记录',
      subtitle: t('showoff.viewMyShowoffs') || '查看我的晒单',
      action: () => navigate('/showoff/my'),
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

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* 用户信息卡片 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white mx-4 mt-4 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-4">
          {/* 头像 */}
          <div className="relative">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt="Avatar"
                className="w-16 h-16 rounded-full border-4 border-white/20"
              />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {user?.telegram_username?.[0] || user?.first_name?.[0] || 'U'}
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
              {user?.first_name || user?.telegram_username || 'User'}
            </h2>
            <div className="flex items-center space-x-2 mt-2">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/20">
                {user ? getKycLevelText('BASIC') : t('wallet.notSet')}
              </span>
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
            {user?.invite_code || '------'}
          </p>
        </div>

        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyReferralLink}
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

      {/* 三个功能卡片 */}
      <div className="mx-4 mt-6">
        <div className="grid grid-cols-3 gap-3">
          {featureCards.map((card, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={card.action}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mx-auto mb-2`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-semibold text-gray-900 text-center">{card.title}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="mx-4 mt-6">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {menuItems.map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              onClick={item.action}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
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
      <div className="mx-4 mt-6 mb-6">
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
    </div>
  )
}

export default ProfilePage
