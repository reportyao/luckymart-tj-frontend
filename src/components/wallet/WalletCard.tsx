import React from 'react'
import { motion } from 'framer-motion'
import { EyeIcon, EyeSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Wallet } from '../../lib/supabase'
import { formatCurrency, getWalletTypeText, cn } from '../../lib/utils'

interface WalletCardProps {
  wallets: Wallet[]
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
}

export const WalletCard: React.FC<WalletCardProps> = ({
  wallets,
  isLoading = false,
  onRefresh,
  className
}) => {
  const [showBalance, setShowBalance] = React.useState(true)
  
  const balanceWallet = wallets.find(w => w.type === 'BALANCE')
  const luckyCoinWallet = wallets.find(w => w.type === 'LUCKY_COIN')

  const toggleShowBalance = () => {
    setShowBalance(!showBalance)
  }

  const formatDisplayAmount = (amount: number) => {
    return showBalance ? formatCurrency(amount) : '****'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">我的钱包</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleShowBalance}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            {showBalance ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={cn(
                "w-4 h-4",
                isLoading && "animate-spin"
              )} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* 余额钱包 */}
        <div className="bg-white/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">
                {getWalletTypeText('BALANCE')}
              </p>
              <p className="text-2xl font-bold">
                {balanceWallet ? formatDisplayAmount(balanceWallet.balance) : 'TJS0.00'}
              </p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">💰</span>
            </div>
          </div>
          
          {balanceWallet && showBalance && (
            <div className="mt-2 flex justify-between text-xs text-white/70">
              <span>累计充值: {formatCurrency(balanceWallet.total_deposits)}</span>
              <span>累计提现: {formatCurrency(balanceWallet.total_withdrawals)}</span>
            </div>
          )}
        </div>

        {/* 幸运币钱包 */}
        <div className="bg-white/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">
                {getWalletTypeText('LUCKY_COIN')}
              </p>
              <p className="text-2xl font-bold">
                {luckyCoinWallet ? formatDisplayAmount(luckyCoinWallet.balance) : 'TJS0.00'}
              </p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">🍀</span>
            </div>
          </div>
          
          {luckyCoinWallet && showBalance && (
            <div className="mt-2 flex justify-between text-xs text-white/70">
              <span>累计充值: {formatCurrency(luckyCoinWallet.total_deposits)}</span>
              <span>累计提现: {formatCurrency(luckyCoinWallet.total_withdrawals)}</span>
            </div>
          )}
        </div>
      </div>


    </motion.div>
  )
}