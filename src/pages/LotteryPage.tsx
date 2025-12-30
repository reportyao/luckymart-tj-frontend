import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Lottery } from '../lib/supabase'
import { getLocalizedText } from '../lib/utils'
import { useSupabase } from '../contexts/SupabaseContext'
import { LotteryCard } from '../components/lottery/LotteryCard'
import { PurchaseModal } from '../components/lottery/PurchaseModal'
import { AdjustmentsHorizontalIcon, ClockIcon, ClipboardDocumentListIcon, PlayIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
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
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)

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
      {/* 简洁的头部 - 四个按钮 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex justify-between items-center">
          {/* 规则说明按钮 - 左侧 */}
          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all"
          >
            <InformationCircleIcon className="w-4 h-4" />
            <span>{t('lottery.rulesButton')}</span>
          </button>

          {/* 右侧按钮组 */}
          <div className="flex items-center space-x-2">
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

      {/* 规则说明弹窗 */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-xl"
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <InformationCircleIcon className="w-6 h-6" />
                {t('lottery.rulesTitle')}
              </h3>
              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* 参与方式 */}
              <div className="mb-6">
                <h4 className="text-purple-600 font-bold text-base mb-2">
                  {t('lottery.rulesParticipation')}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('lottery.rulesParticipationDesc')}
                </p>
              </div>

              {/* 开奖机制 */}
              <div className="mb-6">
                <h4 className="text-purple-600 font-bold text-base mb-2">
                  {t('lottery.rulesDraw')}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('lottery.rulesDrawDesc')}
                </p>
              </div>

              {/* 领奖与核销 */}
              <div className="mb-6">
                <h4 className="text-purple-600 font-bold text-base mb-2">
                  {t('lottery.rulesClaim')}
                </h4>
                <div className="space-y-2">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="text-purple-500 font-medium">•</span> {t('lottery.rulesClaimPrize')}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="text-purple-500 font-medium">•</span> {t('lottery.rulesPickup')}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="text-purple-500 font-medium">•</span> {t('lottery.rulesExpiry')}
                  </p>
                </div>
              </div>

              {/* 关闭按钮 */}
              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default LotteryPage
