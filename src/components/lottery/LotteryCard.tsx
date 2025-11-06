import React from 'react'
import { motion } from 'framer-motion'
import { ClockIcon, UserGroupIcon, StarIcon } from '@heroicons/react/24/outline'
import { Lottery } from '../../lib/supabase'
import { 
  formatCurrency, 
  formatDateTime, 
  getLotteryStatusText, 
  getLotteryStatusColor,
  getTimeRemaining,
  cn 
} from '../../lib/utils'

interface LotteryCardProps {
  lottery: Lottery
  onPurchase?: (lottery: Lottery) => void
  className?: string
}

export const LotteryCard: React.FC<LotteryCardProps> = ({
  lottery,
  onPurchase,
  className
}) => {
  const [timeRemaining, setTimeRemaining] = React.useState(
    getTimeRemaining(lottery.end_time)
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getTimeRemaining(lottery.end_time))
    }, 1000)

    return () => clearInterval(timer)
  }, [lottery.end_time])

  const progress = (lottery.sold_tickets / lottery.total_tickets) * 100
  const isActive = lottery.status === 'ACTIVE'
  const isSoldOut = lottery.status === 'SOLD_OUT'
  const isUpcoming = lottery.status === 'UPCOMING'

  const handlePurchase = () => {
    if (onPurchase && isActive) {
      onPurchase(lottery)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "bg-white rounded-2xl shadow-lg overflow-hidden",
        className
      )}
    >
      {/* 彩票图片 */}
      <div className="relative h-32 bg-gradient-to-r from-purple-400 to-pink-400">
        {lottery.image_url ? (
          <img 
            src={lottery.image_url} 
            alt={lottery.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <StarIcon className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm font-medium">期号 {lottery.period}</p>
            </div>
          </div>
        )}
        
        {/* 状态标签 */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            getLotteryStatusColor(lottery.status)
          )}>
            {getLotteryStatusText(lottery.status)}
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* 彩票标题 */}
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          {lottery.title}
        </h3>
        
        {lottery.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {lottery.description}
          </p>
        )}

        {/* 彩票信息 */}
        <div className="space-y-3">
          {/* 价格和参与信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <p className="text-xs text-gray-500">单价</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(lottery.ticket_price, lottery.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">总数</p>
                <p className="text-sm font-semibold text-gray-900">
                  {lottery.total_tickets}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">限购</p>
                <p className="text-sm font-semibold text-gray-900">
                  {lottery.max_per_user}
                </p>
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center text-xs text-gray-500">
                <UserGroupIcon className="w-3 h-3 mr-1" />
                已售 {lottery.sold_tickets}/{lottery.total_tickets}
              </div>
              <span className="text-xs text-gray-500">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* 时间信息 */}
          {isActive && timeRemaining.total > 0 && (
            <div className="flex items-center text-xs text-gray-500">
              <ClockIcon className="w-3 h-3 mr-1" />
              剩余时间: {' '}
              {timeRemaining.days > 0 && `${timeRemaining.days}天 `}
              {timeRemaining.hours.toString().padStart(2, '0')}:
              {timeRemaining.minutes.toString().padStart(2, '0')}:
              {timeRemaining.seconds.toString().padStart(2, '0')}
            </div>
          )}

          {isUpcoming && (
            <div className="flex items-center text-xs text-gray-500">
              <ClockIcon className="w-3 h-3 mr-1" />
              开始时间: {formatDateTime(lottery.start_time)}
            </div>
          )}

          {lottery.status === 'COMPLETED' && lottery.actual_draw_time && (
            <div className="flex items-center text-xs text-gray-500">
              <ClockIcon className="w-3 h-3 mr-1" />
              开奖时间: {formatDateTime(lottery.actual_draw_time)}
            </div>
          )}

          {/* 中奖号码 */}
          {lottery.status === 'COMPLETED' && lottery.winning_numbers && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700 mb-1">中奖号码</p>
              <div className="flex flex-wrap gap-2">
                {lottery.winning_numbers.map((number, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-mono font-bold"
                  >
                    {number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="mt-4">
          {isActive && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePurchase}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              立即参与
            </motion.button>
          )}

          {isSoldOut && (
            <div className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-semibold text-center">
              已售完
            </div>
          )}

          {isUpcoming && (
            <div className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-semibold text-center">
              即将开始
            </div>
          )}

          {lottery.status === 'COMPLETED' && (
            <div className="w-full bg-green-50 text-green-600 py-3 rounded-xl font-semibold text-center">
              已开奖
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}