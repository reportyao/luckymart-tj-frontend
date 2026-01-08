import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
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
import { useSupabase } from '../contexts/SupabaseContext'

const WalletPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { wallets, refreshWallets, user } = useUser()
  const { supabase } = useSupabase()
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('transactions')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)
  const [hasLoadedTransactions, setHasLoadedTransactions] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshWallets()
    await fetchTransactions()
    setIsRefreshing(false)
    toast.success(t('wallet.balanceUpdated'))
  }

  const fetchTransactions = useCallback(async () => {
    if (!user) return
    
    setIsLoadingTransactions(true)
    try {
      // 获取用户的所有钱包 ID
      const walletIds = wallets.map(w => w.id)
      
      // 1. 查询钱包交易记录
      let walletTransactions: any[] = []
      if (walletIds.length > 0) {
        const { data: txData, error: txError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .in('wallet_id', walletIds)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (!txError && txData) {
          walletTransactions = txData.map(tx => ({
            ...tx,
            source: 'wallet_transactions'
          }))
        }
      }
      
      // 2. 查询充值记录
      const { data: depositData, error: depositError } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      const depositTransactions = (!depositError && depositData) ? depositData.map(d => ({
        id: d.id,
        type: 'DEPOSIT',
        amount: Number(d.amount),
        status: d.status === 'APPROVED' ? 'COMPLETED' : d.status,
        created_at: d.created_at,
        description: (d as any).notes || d.admin_note || '充值',
        source: 'deposit_requests'
      })) : []
      
      // 3. 查询提现记录
      const { data: withdrawData, error: withdrawError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      const withdrawTransactions = (!withdrawError && withdrawData) ? withdrawData.map(w => ({
        id: w.id,
        type: 'WITHDRAWAL',
        amount: -Number(w.amount),
        status: w.status === 'APPROVED' ? 'COMPLETED' : w.status,
        created_at: w.created_at,
        description: (w as any).notes || w.admin_note || '提现',
        source: 'withdrawal_requests'
      })) : []
      
      // 4. 合并并排序（按时间倒序）
      const allTransactions = [
        ...walletTransactions,
        ...depositTransactions,
        ...withdrawTransactions
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      // 5. 去重（避免充值/提现同时在wallet_transactions和单独表中出现）
      const seen = new Set<string>()
      const uniqueTransactions = allTransactions.filter(tx => {
        // 如果是充值/提现类型，优先使用单独表的数据
        if (tx.source === 'wallet_transactions' && (tx.type === 'DEPOSIT' || tx.type === 'WITHDRAWAL')) {
          // 检查是否已经有来自单独表的同类型记录
          const key = `${tx.type}_${tx.amount}_${new Date(tx.created_at).toDateString()}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
        }
        return true
      })
      
      setTransactions(uniqueTransactions.slice(0, 30))
      setHasLoadedTransactions(true)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      toast.error(t('error.networkError'))
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [user, wallets, supabase, t])

  useEffect(() => {
    if (user && wallets.length > 0 && !hasLoadedTransactions) {
      fetchTransactions()
    }
  }, [user, wallets, hasLoadedTransactions])



  const getTransactionTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'DEPOSIT': t('wallet.transactionType.deposit'),
      'WITHDRAWAL': t('wallet.transactionType.withdrawal'),
      'ONE_YUAN_PURCHASE': t('wallet.transactionType.oneYuanPurchase'),
      'LOTTERY_PURCHASE': t('wallet.transactionType.lotteryPurchase'),
      'LOTTERY_REFUND': t('wallet.transactionType.lotteryRefund'),
      'LOTTERY_PRIZE': t('wallet.transactionType.lotteryPrize'),
      'REFERRAL_BONUS': t('wallet.transactionType.referralBonus'),
      'COIN_EXCHANGE': t('wallet.transactionType.coinExchange'),
      'MARKET_PURCHASE': t('wallet.transactionType.marketPurchase'),
      'MARKET_SALE': t('wallet.transactionType.marketSale'),
      'ADMIN_ADJUSTMENT': t('wallet.transactionType.adminAdjustment'),
      'SHOWOFF_REWARD': t('wallet.transactionType.showoffReward'),
      'FRIEND_CASHBACK': t('wallet.transactionType.friendCashback'),
      'GROUP_BUY_PURCHASE': t('wallet.transactionType.groupBuyPurchase'),
      'GROUP_BUY_REFUND': t('wallet.transactionType.groupBuyRefund'),
      'GROUP_BUY_PRIZE': t('wallet.transactionType.groupBuyPrize'),
      'SPIN_REWARD': t('wallet.transactionType.spinReward')
    }
    return typeMap[type] || type
  }

  const getTransactionStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'COMPLETED': t('wallet.transactionStatus.completed'),
      'PENDING': t('wallet.transactionStatus.pending'),
      'FAILED': t('wallet.transactionStatus.failed')
    }
    return statusMap[status] || status
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <ArrowDownIcon className="w-5 h-5 text-green-600" />
      case 'WITHDRAWAL':
        return <ArrowUpIcon className="w-5 h-5 text-red-600" />
      case 'ONE_YUAN_PURCHASE':
      case 'LOTTERY_PURCHASE':
      case 'GROUP_BUY_PURCHASE':
        return <ArrowUpIcon className="w-5 h-5 text-orange-600" />
      case 'LOTTERY_PRIZE':
      case 'GROUP_BUY_PRIZE':
        return <ArrowDownIcon className="w-5 h-5 text-green-600" />
      case 'LOTTERY_REFUND':
      case 'GROUP_BUY_REFUND':
        return <ArrowDownIcon className="w-5 h-5 text-blue-600" />
      case 'COIN_EXCHANGE':
        return <ArrowPathIcon className="w-5 h-5 text-blue-600" />
      case 'SHOWOFF_REWARD':
      case 'SPIN_REWARD':
        return <ArrowDownIcon className="w-5 h-5 text-yellow-600" />
      case 'REFERRAL_BONUS':
      case 'FRIEND_CASHBACK':
        return <ArrowDownIcon className="w-5 h-5 text-purple-600" />
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
          <h1 className="text-2xl font-bold text-gray-900">{t('wallet.myWallet')}</h1>
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
            <p className="text-sm font-medium text-gray-900">{t('wallet.deposit')}</p>
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
            <p className="text-sm font-medium text-gray-900">{t('wallet.withdraw')}</p>
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
            <p className="text-sm font-medium text-gray-900">{t('wallet.exchange')}</p>
          </motion.button>
        </div>
      </div>

      {/* 交易记录 */}
      <div className="px-4 mt-8">
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{t('wallet.transactions')}</h3>
          </div>
            
            <div className="divide-y divide-gray-100">
              {isLoadingTransactions ? (
                <div className="p-8 text-center text-gray-500">
                  <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p>{t('common.loading')}</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>{t('wallet.noTransactions')}</p>
                </div>
              ) : (
                transactions.map((transaction) => (
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
                        {getTransactionTypeLabel(transaction.type)}
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
                      {Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              ))
              )}
          </div>
        </div>
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