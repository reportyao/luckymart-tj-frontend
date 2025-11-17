import React, { useState, useEffect, useCallback } from 'react'

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext'
import { Lottery } from '../lib/supabase'
import { PurchaseModal } from '../components/lottery/PurchaseModal'
import { useSupabase } from '../contexts/SupabaseContext'
import { WalletCard } from '../components/wallet/WalletCard'
import { LotteryCard } from '../components/lottery/LotteryCard'
import { SafeMotion } from '../components/SafeMotion'
import { ArrowRightIcon, StarIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const HomePage: React.FC = () => {
  const { t } = useTranslation()
  const { user, wallets, isLoading: userLoading, refreshWallets } = useUser()
  const { lotteryService } = useSupabase()
  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [isLoadingLotteries, setIsLoadingLotteries] = useState(true)

  const loadLotteries = useCallback(async () => {
    try {
      setIsLoadingLotteries(true)
      const data = await lotteryService.getActiveLotteries()
      setLotteries(data)
    } catch (error: any) {
      console.error('Failed to load lotteries:', error)
      toast.error(t('error.networkError'))
    } finally {
      setIsLoadingLotteries(false)
    }
  }, [t, lotteryService])

  useEffect(() => {
    loadLotteries()
  }, [loadLotteries])

  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null)
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)

  const handlePurchaseLottery = (lottery: Lottery) => {
    setSelectedLottery(lottery)
    setIsPurchaseModalOpen(true)
  }

  const handlePurchaseConfirm = async (lotteryId: string, quantity: number) => {
    try {
      await lotteryService.purchaseTickets(lotteryId, quantity)
      toast.success(t('lottery.purchaseSuccess'))
      // 购买成功后刷新列表和钱包
      await loadLotteries()
      await refreshWallets()
    } catch (error: any) {
      toast.error(error.message || t('error.networkError'))
    } finally {
      setIsPurchaseModalOpen(false)
      setSelectedLottery(null)
    }
  }

  const handleRefreshWallets = async () => {
    await refreshWallets()
    toast.success(t('wallet.balanceUpdated'))
  }

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SafeMotion
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <StarIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.welcome')}</h1>
          <p className="text-gray-600 mb-6">{t('auth.description')}</p>
          <p className="text-sm text-gray-500">{t('auth.pleaseLogin')}</p>
        </SafeMotion>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* 欢迎横幅 */}
      <SafeMotion
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 mx-4 mt-4 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">
              {t('home.welcome')}, {user.first_name}! 👋
            </h2>
            <p className="text-white/80 text-sm">
              {t('home.tryLuck')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">{t('home.referralCode')}</p>
            <p className="text-lg font-bold">{user.referral_code}</p>
          </div>
        </div>
      </SafeMotion>

      {/* 钱包卡片 */}
      <div className="px-4 mt-6">
        <WalletCard 
          wallets={wallets} 
          onRefresh={handleRefreshWallets}
        />
      </div>

      {/* 快速统计 */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-3 gap-4">
          <SafeMotion
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 text-center shadow-sm"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrophyIcon className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">{t('home.winCount')}</p>
          </SafeMotion>

          <SafeMotion
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 text-center shadow-sm"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <StarIcon className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">{t('home.participationCount')}</p>
          </SafeMotion>

          <SafeMotion
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 text-center shadow-sm"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <UsersIcon className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">{t('home.inviteFriends')}</p>
          </SafeMotion>
        </div>
      </div>

	      {/* 热门夺宝 */}
	      <div className="px-4 mt-8">
	        <div className="flex items-center justify-between mb-4">
	          <h3 className="text-lg font-bold text-gray-900">{t('home.hotLotteries')}</h3>
	          <Link to="/lottery" className="flex items-center text-blue-600 text-sm font-medium">
	            {t('home.viewAll')}
	            <ArrowRightIcon className="w-4 h-4 ml-1" />
	          </Link>
	        </div>
	
	        {isLoadingLotteries ? (
	          <div className="space-y-4">
	            {[1, 2].map((i) => (
	              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
	                <div className="h-32 bg-gray-200 rounded-xl mb-4"></div>
	                <div className="h-4 bg-gray-200 rounded mb-2"></div>
	                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
	              </div>
	            ))}
	          </div>
	        ) : (
	          <div className="space-y-4">
	            {lotteries.slice(0, 3).map((lottery) => (
	              <LotteryCard
	                key={lottery.id}
	                lottery={lottery}
	                onPurchase={handlePurchaseLottery}
	              />
	            ))}
	
	            {lotteries.length === 0 && (
	              <SafeMotion
	                initial={{ opacity: 0 }}
	                animate={{ opacity: 1 }}
	                className="bg-white rounded-2xl p-8 text-center"
	              >
	                <StarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
	                <p className="text-gray-500">{t('home.noLotteries')}</p>
	                <p className="text-sm text-gray-400 mt-1">{t('home.stayTuned')}</p>
	              </SafeMotion>
	            )}
	          </div>
	        )}
	      </div>
	      
	      {/* 购买模态框 */}
	      <PurchaseModal
	        lottery={selectedLottery}
	        isOpen={isPurchaseModalOpen}
	        onClose={() => setIsPurchaseModalOpen(false)}
	        onConfirm={handlePurchaseConfirm}
	      />
	    </div>
	  )
	}
	
	export default HomePage