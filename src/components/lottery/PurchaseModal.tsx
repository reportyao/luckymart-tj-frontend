import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Lottery } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface PurchaseModalProps {
  lottery: Lottery | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (lotteryId: string, quantity: number) => Promise<void>
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  lottery,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [purchasedCodes, setPurchasedCodes] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)

  if (!lottery) return null

  const maxPurchase = Math.min(lottery.max_per_user || 10, lottery.total_tickets - lottery.sold_tickets)
  const totalPrice = lottery.ticket_price * quantity

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta
    if (newQuantity >= 1 && newQuantity <= maxPurchase) {
      setQuantity(newQuantity)
    }
  }

  const generateWinningCodes = (lotteryId: string, startIndex: number, count: number): string[] => {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const sequence = (startIndex + i + 1).toString().padStart(5, '0')
      codes.push(`LM-${lotteryId}-${sequence}`)
    }
    return codes
  }

  const handleConfirm = async () => {
    try {
      setIsLoading(true)
      await onConfirm(lottery.id, quantity)
      
      // 生成中奖码(模拟)
      const startIndex = lottery.sold_tickets
      const codes = generateWinningCodes(lottery.period, startIndex, quantity)
      setPurchasedCodes(codes)
      setShowSuccess(true)
      
      toast.success('购买成功!')
    } catch (error: any) {
      toast.error(error.message || '购买失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setQuantity(1)
    setPurchasedCodes([])
    setShowSuccess(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* 对话框 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 max-w-md mx-auto"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">购买彩票</h3>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-6">
              {showSuccess && purchasedCodes.length > 0 ? (
                /* 购买成功显示 */
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">购买成功!</h4>
                    <p className="text-sm text-gray-600">您的中奖码已生成</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 space-y-2 max-h-60 overflow-y-auto">
                    {purchasedCodes.map((code, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <span className="font-mono font-medium text-gray-900">{code}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(code)
                            toast.success('已复制')
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          复制
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    您可以在"我的中奖码"页面查看所有中奖码
                  </p>
                </div>
              ) : (
                <>
              {/* 商品信息 */}
              <div className="flex items-start space-x-4">
                <img
                  src={lottery.image_url || '/placeholder.png'}
                  alt={lottery.title}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{lottery.title}</h4>
                  <p className="text-sm text-gray-500">期号: {lottery.period}</p>
                  <p className="text-sm text-gray-500">单价: TJS{lottery.ticket_price.toFixed(2)}</p>
                </div>
              </div>

              {/* 数量选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  购买数量
                </label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="p-2 bg-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <MinusIcon className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{quantity}</div>
                    <div className="text-xs text-gray-500 mt-1">最多 {maxPurchase} 张</div>
                  </div>

                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= maxPurchase}
                    className="p-2 bg-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* 总价 */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">总计</span>
                  <span className="text-2xl font-bold text-blue-600">
                    TJS{totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
                </>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-gray-100 flex space-x-3">
              {showSuccess ? (
                <button
                  onClick={handleClose}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  完成
                </button>
              ) : (
                <>
                  <button
                    onClick={handleClose}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '处理中...' : '确认购买'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
