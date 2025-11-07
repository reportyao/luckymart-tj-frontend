import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ArrowRightLeft, CheckCircle2 } from 'lucide-react'

export default function ExchangePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState(0)
  const [luckyCoin, setLuckyCoin] = useState(0)
  const [exchangeType, setExchangeType] = useState<'BALANCE_TO_COIN' | 'COIN_TO_BALANCE'>('BALANCE_TO_COIN')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: wallets } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .eq('currency', 'TJS')

      if (wallets) {
        const balanceWallet = wallets.find(w => w.type === 'BALANCE')
        const coinWallet = wallets.find(w => w.type === 'LUCKY_COIN')
        
        if (balanceWallet) setBalance(balanceWallet.balance)
        if (coinWallet) setLuckyCoin(coinWallet.balance)
      }
    } catch (error) {
      console.error('获取钱包失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExchange = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      alert(t('wallet.pleaseEnterValidAmount'))
      return
    }

    const sourceBalance = exchangeType === 'BALANCE_TO_COIN' ? balance : luckyCoin
    if (amountNum > sourceBalance) {
      alert(t('wallet.insufficientBalance'))
      return
    }

    try {
      setSubmitting(true)

      const { data, error } = await supabase.functions.invoke('exchange-currency', {
        body: {
          exchangeType: exchangeType,
          amount: amountNum,
          currency: 'TJS',
        }
      })

      if (error) throw error

      if (data?.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/wallet')
        }, 2000)
      }
    } catch (error: any) {
      console.error('兑换失败:', error)
      alert(error.message || t('wallet.exchangeFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleExchangeType = () => {
    setExchangeType(prev => 
      prev === 'BALANCE_TO_COIN' ? 'COIN_TO_BALANCE' : 'BALANCE_TO_COIN'
    )
    setAmount('')
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('wallet.exchangeSuccess')}</h2>
          <p className="text-gray-600">{t('wallet.balanceUpdated')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 pb-20">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md p-4 flex items-center">
        <button onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-xl font-bold ml-4">{t('wallet.exchange')}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 兑换卡片 */}
        <div className="bg-white rounded-2xl p-6">
          {/* 源钱包 */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4 mb-4">
            <div className="text-sm text-gray-600 mb-1">
              {exchangeType === 'BALANCE_TO_COIN' ? t('wallet.balance') : t('wallet.luckyCoin')}
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {exchangeType === 'BALANCE_TO_COIN' ? balance.toFixed(2) : luckyCoin.toFixed(2)} TJS
            </div>
          </div>

          {/* 兑换按钮 */}
          <div className="flex justify-center my-4">
            <button
              onClick={toggleExchangeType}
              className="bg-purple-500 text-white p-3 rounded-full hover:bg-purple-600 transition-colors"
            >
              <ArrowRightLeft className="w-6 h-6" />
            </button>
          </div>

          {/* 目标钱包 */}
          <div className="bg-gradient-to-r from-pink-100 to-red-100 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">
              {exchangeType === 'BALANCE_TO_COIN' ? t('wallet.luckyCoin') : t('wallet.balance')}
            </div>
            <div className="text-2xl font-bold text-pink-600">
              {exchangeType === 'BALANCE_TO_COIN' ? luckyCoin.toFixed(2) : balance.toFixed(2)} TJS
            </div>
          </div>
        </div>

        {/* 兑换说明 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-2">{t('wallet.exchangeRules')}</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• {t('wallet.exchangeRate')}: 1:1</p>
            <p>• {t('wallet.instantExchange')}</p>
            <p>• {t('wallet.noFee')}</p>
          </div>
        </div>

        {/* 兑换金额 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.exchangeAmount')}</h2>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('wallet.enterAmount')}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
          />
          <div className="mt-2 text-sm text-gray-500">
            {t('wallet.youWillGet')}: {amount || '0'} {exchangeType === 'BALANCE_TO_COIN' ? t('wallet.luckyCoin') : t('wallet.balance')}
          </div>
        </div>

        {/* 快捷金额 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.quickAmount')}</h2>
          <div className="grid grid-cols-4 gap-2">
            {[10, 50, 100, 500].map(val => (
              <button
                key={val}
                onClick={() => setAmount(val.toString())}
                className="py-2 border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* 兑换按钮 */}
        <button
          onClick={handleExchange}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {submitting ? t('common.exchanging') : t('wallet.confirmExchange')}
        </button>
      </div>
    </div>
  )
}
