import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser } from '../contexts/UserContext'
import { WalletCard } from '../components/wallet/WalletCard'
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { formatCurrency, formatDateTime } from '../lib/utils'
import toast from 'react-hot-toast'
import { DepositModal } from '../components/wallet/DepositModal'
import { WithdrawModal } from '../components/wallet/WithdrawModal'

const WalletPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, wallets, refreshWallets } = useUser()
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshWallets()
    setIsRefreshing(false)
    toast.success('钱包数据已更新')
  }

  // Mock transaction data - in real app, this would come from API
  const mockTransactions = [
    {
      id: '1',
      type: 'LOTTERY_PURCHASE',
      amount: -10.00,
      status: 'COMPLETED',
      description: '购买彩票 - TEST2025001',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'LOTTERY_PRIZE',
      amount: 14.40,
      status: 'COMPLETED',
      description: '彩票中奖奖金 - 1等奖',
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: '3',
      type: 'DEPOSIT',
      amount: 100.00,
      status: 'COMPLETED',
      description: '钱包充值',
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
  ]

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <ArrowDownIcon className="w-5 h-5 text-green-600" />
      case 'WITHDRAWAL':
        return <ArrowUpIcon className="w-5 h-5 text-red-600" />
      case 'LOTTERY_PURCHASE':
        return <ArrowUpIcon className="w-5 h-5 text-orange-600" />
      case 'LOTTERY_PRIZE':
        return <ArrowDownIcon className="w-5 h-5 text-green-600" />
      case 'COIN_EXCHANGE':
        return <ArrowPathIcon className="w-5 h-5 text-blue-600" />
      default:
        return <ClockIcon className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'FAILED':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      default:
        return <ClockIcon className="w-4 h-4 text-orange-500" />
    }
  }

  return (
    <div className="pb-20">
      {/* 页面标题 */}
      <div className="bg-white border-b border-gray-100 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">我的钱包</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 钱包卡片 */}
      <div className="px-4 mt-4">
        <WalletCard 
          wallets={wallets} 
          onRefresh={handleRefresh}
          isLoading={isRefreshing}
        />
      </div>

      {/* 快捷操作 */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-3 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/deposit')}
            className="bg-white rounded-xl p-4 shadow-sm text-center"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <ArrowDownIcon className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">充值</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/withdraw')}
            className="bg-white rounded-xl p-4 shadow-sm text-center"
          >
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <ArrowUpIcon className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">提现</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/exchange')}
            className="bg-white rounded-xl p-4 shadow-sm text-center"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <ArrowPathIcon className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">兑换</p>
          </motion.button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="px-4 mt-8">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            钱包概览
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'transactions'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            交易记录
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 mt-4">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            {/* 钱包统计 */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">钱包统计</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">总充值</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(
                      wallets.reduce((sum, w) => sum + w.total_deposits, 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">总提现</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(
                      wallets.reduce((sum, w) => sum + w.total_withdrawals, 0)
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 安全设置 */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">安全设置</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">支付密码</span>
                  <span className="text-sm text-gray-500">未设置</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">身份验证</span>
                  <span className="text-sm text-gray-500">基础验证</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">交易记录</h3>
            </div>
            
            <div className="divide-y divide-gray-100">
              {mockTransactions.map((transaction) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(transaction.status)}
                        <p className="text-xs text-gray-500">
                          {formatDateTime(transaction.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={handleRefresh}
      />
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={handleRefresh}
      />
    </div>
  )
}

export default WalletPage