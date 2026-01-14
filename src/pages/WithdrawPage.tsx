import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useUser } from '../contexts/UserContext'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WithdrawPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { wallets, sessionToken } = useUser()
  
  const [withdrawalMethod, setWithdrawalMethod] = useState<'ALIF_MOBI' | 'DC_BANK'>('ALIF_MOBI')
  const [amount, setAmount] = useState('')
  
  // 银行卡信息
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankBranch, setBankBranch] = useState('')
  
  // 手机钱包信息
  const [mobileWalletNumber, setMobileWalletNumber] = useState('')
  const [mobileWalletName, setMobileWalletName] = useState('')
  
  // 身份信息
  const [idCardNumber, setIdCardNumber] = useState('')
  const [idCardName, setIdCardName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // 从 UserContext 获取钱包数据
  const balanceWallet = wallets.find(w => w.type === 'TJS' && w.currency === 'TJS')
  const balance = balanceWallet?.balance || 0

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      toast.error(t('wallet.pleaseEnterValidAmount'))
      return
    }

    // 检查可用余额（需要考虑冻结余额）
    const frozenBalance = balanceWallet?.frozen_balance || 0
    const availableBalance = balance - frozenBalance
    
    if (amountNum > availableBalance) {
      toast.error(`${t('wallet.insufficientBalance')}\n可用余额: ${availableBalance.toFixed(2)} TJS（总余额: ${balance.toFixed(2)} TJS，已冻结: ${frozenBalance.toFixed(2)} TJS）`)
      return
    }

    // 验证必填字段
    if (!mobileWalletNumber || !mobileWalletName) {
      alert(t('wallet.pleaseCompleteWalletInfo'))
      return
    }

    try {
      setSubmitting(true)

      console.log('[Debug] Withdraw - Session token:', sessionToken ? `${sessionToken.substring(0, 8)}...` : 'null');
      console.log('[Debug] Withdraw - Amount:', amountNum);
      console.log('[Debug] Withdraw - Method:', withdrawalMethod);

      const requestBody = {
        session_token: sessionToken,
          amount: amountNum,
          currency: 'TJS',
          withdrawalMethod: withdrawalMethod,
          mobileWalletNumber: mobileWalletNumber,
          mobileWalletName: mobileWalletName,
        };
      
      console.log('[Debug] Withdraw - Request body:', requestBody);

      // 假设 withdraw-request 是一个 Edge Function
      const { data, error } = await supabase.functions.invoke('withdraw-request', {
        body: requestBody
      });

      console.log('[Debug] Withdraw - Response data:', data);
      console.log('[Debug] Withdraw - Response error:', error);

      if (error) throw error

      if (data?.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/wallet')
        }, 2000)
      }
    } catch (error: any) {
      console.error(t('withdraw.submitFailed') + ':', error)
      toast.error(error.message || t('wallet.withdrawRequestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('wallet.withdrawRequestSubmitted')}</h2>
          <p className="text-gray-600">{t('wallet.pleaseWaitForReview')}</p>
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
        <h1 className="text-white text-xl font-bold ml-4">{t('wallet.withdraw')}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 可用余额 */}
        <div className="bg-white rounded-2xl p-4">
          <div className="text-sm text-gray-600">{t('wallet.availableBalance')}</div>
          <div className="text-3xl font-bold text-purple-600">{balance.toFixed(2)} TJS</div>
        </div>

        {/* 选择提现方式 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.selectWithdrawalMethod')}</h2>
          <div className="space-y-2">

            <button
              onClick={() => setWithdrawalMethod('ALIF_MOBI')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                withdrawalMethod === 'ALIF_MOBI'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-800">Alif Mobi</div>
            </button>
            <button
              onClick={() => setWithdrawalMethod('DC_BANK')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                withdrawalMethod === 'DC_BANK'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-800">DC Bank</div>
            </button>
          </div>
        </div>

        {/* 提现金额 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.withdrawAmount')}</h2>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('wallet.enterAmount')}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>



        {/* 手机钱包信息 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.withdrawBankInfo')}</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={mobileWalletNumber}
              onChange={(e) => setMobileWalletNumber(e.target.value)}
              placeholder={t('wallet.bankAccount')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={mobileWalletName}
              onChange={(e) => setMobileWalletName(e.target.value)}
              placeholder={t('wallet.phoneNumber')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>


        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {submitting ? t('common.submitting') : t('wallet.submitWithdrawRequest')}
        </button>
      </div>
    </div>
  )
}
