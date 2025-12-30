import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Lottery } from '../lib/supabase'
import { getLocalizedText } from '../lib/utils'
import { useSupabase } from '../contexts/SupabaseContext'
import { LotteryCard } from '../components/lottery/LotteryCard'
import { PurchaseModal } from '../components/lottery/PurchaseModal'
import { AdjustmentsHorizontalIcon, ClockIcon, ClipboardDocumentListIcon, PlayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useUser } from '../contexts/UserContext'
import { useNavigate } from 'react-router-dom'

const LotteryPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const { lotteryService } = useSupabase()
  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  // 默认选择"进行中"
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'completed' | 'drawResult'>('active')
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null)
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)

  const loadLotteries = useCallback(async () => {
    try {
      setIsLoading(true)
      // 根据 filter 获取不同状态的积分商城
      let data: Lottery[] = []
      if (filter === 'all') {
        data = await lotteryService.getAllLotteries()
      } else if (filter === 'drawResult') {
        data = await lotteryService.getLotteriesByStatus('COMPLETED' as any)
      } else {
        data = await lotteryService.getLotteriesByStatus(filter.toUpperCase())
      }
      setLotteries(data)
    } catch (error: any) {
      console.error('Failed to load lotteries:', error)
      toast.error(t('error.networkError'))
    } finally {
      setIsLoading(false)
    }
  }, [t, filter, lotteryService])

  useEffect(() => {
    loadLotteries()
  }, [loadLotteries, filter])

  const filteredLotteries = lotteries.filter(lottery => {
    // 适配多语言内容展示
    const titleText = getLocalizedText(lottery.name_i18n as Record<string, string> | null, i18n.language) || lottery.title;
    
    const matchesSearch = titleText.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filter === 'all') return matchesSearch
    if (filter === 'drawResult') return matchesSearch && lottery.status === 'COMPLETED'
    return matchesSearch && lottery.status === filter.toUpperCase()
  })

  const { refreshWallets } = useUser()

  const handlePurchaseLottery = (lottery: Lottery) => {
    setSelectedLottery(lottery)
    setIsPurchaseModalOpen(true)
  }

  const handlePurchaseConfirm = async (lotteryId: string, quantity: number) => {
    // 实际购买逻辑
    try {
      await lotteryService.purchaseTickets(lotteryId, quantity)
      toast.success(t('lottery.purchaseSuccess'))
      // 刷新列表
      await loadLotteries()
      await refreshWallets()
    } catch (error: any) {
      toast.error(error.message || t('error.networkError'))
    } finally {
      // 关闭模态框
      setIsPurchaseModalOpen(false)
      setSelectedLottery(null)
    }
  }

  return (
    <div className="pb-20">
      {/* 简洁的头部 - 三个按钮 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex justify-end items-center space-x-2">
          {/* 进行中按钮 */}
          <button
            onClick={() => setFilter('active')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlayIcon className="w-4 h-4" />
            <span>{t('lottery.ongoing')}</span>
          </button>

          {/* 已结束按钮 */}
          <button
            onClick={() => setFilter('completed')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'completed'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            <span>{t('lottery.ended')}</span>
          </button>

          {/* 订单管理按钮 */}
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            <ClipboardDocumentListIcon className="w-4 h-4" />
            <span>{t('lottery.orderManagement')}</span>
          </button>
        </div>
      </div>

      {/* 彩票列表 */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-32 bg-gray-200 rounded-xl mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLotteries.map((lottery) => (
              <LotteryCard
                key={lottery.id}
                lottery={lottery}
                onPurchase={handlePurchaseLottery}
              />
            ))}

            {filteredLotteries.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl p-8 text-center"
              >
                <AdjustmentsHorizontalIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('home.noLotteries')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('home.stayTuned')}</p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 购买对话框 */}
      <PurchaseModal
        lottery={selectedLottery}
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onConfirm={handlePurchaseConfirm}
      />
    </div>
  )
}

export default LotteryPage
