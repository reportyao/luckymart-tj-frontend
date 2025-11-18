import React from 'react'
import { motion } from 'framer-motion'
import { ClockIcon, UserGroupIcon, StarIcon } from '@heroicons/react/24/outline'
import { Lottery } from '../../lib/supabase'
import { useTranslation } from 'react-i18next'
import { 
  formatCurrency, 
  formatDateTime, 
  getLotteryStatusText, 
  getLotteryStatusColor,
  getTimeRemaining,
  cn,
  getLocalizedText
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
	  const { t, i18n } = useTranslation()
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
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center">
                    <div class="text-center text-white">
                      <svg class="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <p class="text-sm font-medium">${t('lottery.period')}: ${lottery.period}</p>
                    </div>
                  </div>
                `
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <StarIcon className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm font-medium">{t('lottery.period')}: {lottery.period}</p>
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
	          {getLocalizedText(lottery.name_i18n, i18n.language) || lottery.title}
	        </h3>
        
	        {lottery.description && (
	          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
	            {getLocalizedText(lottery.description_i18n, i18n.language) || lottery.description}
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
                  {formatCurrency(lottery.currency, lottery.ticket_price)}
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
	                {t('lottery.soldTickets')} {lottery.sold_tickets}/{lottery.total_tickets}
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
	              {t('lottery.remainingTime')}: {' '}
	              {timeRemaining.days > 0 && `${timeRemaining.days}天 `}
              {timeRemaining.hours.toString().padStart(2, '0')}:
              {timeRemaining.minutes.toString().padStart(2, '0')}:
              {timeRemaining.seconds.toString().padStart(2, '0')}
            </div>
          )}

          {isUpcoming && (
            <div className="flex items-center text-xs text-gray-500">
	              <ClockIcon className="w-3 h-3 mr-1" />
	              {t('lottery.startTime')}: {formatDateTime(lottery.start_time)}
	            </div>
          )}

          {lottery.status === 'COMPLETED' && lottery.actual_draw_time && (
            <div className="flex items-center text-xs text-gray-500">
	              <ClockIcon className="w-3 h-3 mr-1" />
	              {t('lottery.drawTime')}: {formatDateTime(lottery.actual_draw_time)}
	            </div>
          )}

          {/* 中奖号码 */}
          {lottery.status === 'COMPLETED' && lottery.winning_numbers && (
	            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
		              <p className="text-xs text-yellow-700 mb-1">{t('lottery.luckyNumber')}</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(lottery.winning_numbers) && (lottery.winning_numbers as string[]).map((number: string, index: number) => (
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
	              {t('lottery.participate')}
	            </motion.button>
          )}

          {isSoldOut && (
            <div className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-semibold text-center">
	              {t('lottery.soldOut')}
	            </div>
          )}

          {isUpcoming && (
            <div className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-semibold text-center">
	              {t('lottery.upcoming')}
	            </div>
          )}

          {lottery.status === 'COMPLETED' && (
            <div className="w-full bg-green-50 text-green-600 py-3 rounded-xl font-semibold text-center">
	              {t('lottery.completed')}
	            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}