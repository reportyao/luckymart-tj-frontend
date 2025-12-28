import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext'
import { useInviteStats } from '../hooks/useInviteStats'
import { Lottery } from '../lib/supabase'
import { PurchaseModal } from '../components/lottery/PurchaseModal'
import { useSupabase } from '../contexts/SupabaseContext'
import { LotteryCard } from '../components/lottery/LotteryCard'
import { SafeMotion } from '../components/SafeMotion'
import { ArrowRightIcon, StarIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline'
import ReferralBanner from '../components/ReferralBanner'
import BannerCarousel from '../components/BannerCarousel'
import toast from 'react-hot-toast'

const HomePage: React.FC = () => {
  const { t } = useTranslation()
	  const { user, profile, wallets, isLoading: userLoading, refreshWallets } = useUser()
  const { lotteryService } = useSupabase()
  const { stats: inviteStats } = useInviteStats()
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
      {/* Banner广告位 */}
      <div className="px-4 mt-4">
        <BannerCarousel />
      </div>

      {/* 拼团和积分商城入口 */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/group-buy"
            className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <UsersIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-1">{t('home.groupBuy')}</h3>
              <p className="text-xs text-white/80 text-center">{t('home.groupBuyDesc')}</p>
            </div>
          </Link>

          <Link
            to="/lottery"
            className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <TrophyIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-1">{t('home.lottery')}</h3>
              <p className="text-xs text-white/80 text-center">{t('home.lotteryDesc')}</p>
            </div>
          </Link>
        </div>
      </div>

	

	      {/* 热门积分商城 */}
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