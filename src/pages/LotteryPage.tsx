import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../contexts/UserContext'
import { lotteryService, Lottery } from '../lib/supabase'
import { LotteryCard } from '../components/lottery/LotteryCard'
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const LotteryPage: React.FC = () => {
  const { user } = useUser()
  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all')

  useEffect(() => {
    loadLotteries()
  }, [])

  const loadLotteries = async () => {
    try {
      setIsLoading(true)
      const data = await lotteryService.getActiveLotteries()
      setLotteries(data)
    } catch (error: any) {
      console.error('Failed to load lotteries:', error)
      toast.error('加载彩票数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLotteries = lotteries.filter(lottery => {
    const matchesSearch = lottery.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lottery.period.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filter === 'all') return matchesSearch
    return matchesSearch && lottery.status === filter.toUpperCase()
  })

  const handlePurchaseLottery = (lottery: Lottery) => {
    toast.success(`即将购买 ${lottery.title}`)
  }

  return (
    <div className="pb-20">
      {/* 页面标题 */}
      <div className="bg-white border-b border-gray-100 px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">夺宝大厅</h1>
        
        {/* 搜索框 */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索夺宝活动..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* 筛选标签 */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex space-x-2 overflow-x-auto">
          {[
            { key: 'all', label: '全部' },
            { key: 'active', label: '进行中' },
            { key: 'upcoming', label: '即将开始' },
            { key: 'completed', label: '已完成' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
                <p className="text-gray-500">没有找到相关的夺宝活动</p>
                <p className="text-sm text-gray-400 mt-1">试试调整搜索条件</p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LotteryPage