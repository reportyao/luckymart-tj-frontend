import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase, walletService } from '../lib/supabase'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function WithdrawPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  const [balance, setBalance] = useState(0)
  const [withdrawalMethod, setWithdrawalMethod] = useState<'BANK_TRANSFER' | 'ALIF_MOBI' | 'DC_BANK'>('BANK_TRANSFER')
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

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      setSubmitting(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 使用抽象服务层获取钱包信息
      const wallets = await walletService.getWallets(user.id)
      const balanceWallet = wallets.find(w => w.currency === 'TJS')

      if (balanceWallet) {
        setBalance(balanceWallet.balance)
      }
    } catch (error) {
      console.error('获取余额失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      alert(t('wallet.pleaseEnterValidAmount'))
      return
    }

    if (amountNum > balance) {
      alert(t('wallet.insufficientBalance'))
      return
    }

    // 验证必填字段
    if (withdrawalMethod === 'BANK_TRANSFER') {
      if (!bankName || !bankAccountNumber || !bankAccountName) {
        alert(t('wallet.pleaseCompleteBankInfo'))
        return
      }
    } else {
      if (!mobileWalletNumber || !mobileWalletName) {
        alert(t('wallet.pleaseCompleteWalletInfo'))
        return
      }
    }

    if (!idCardNumber || !idCardName || !phoneNumber) {
      alert(t('wallet.pleaseCompleteIdentityInfo'))
        return
    }

    try {
      setSubmitting(true)

      // 假设 withdraw-request 是一个 Edge Function
      const { data, error } = await supabase.functions.invoke('withdraw-request', {
        body: {
          amount: amountNum,
          currency: 'TJS',
          withdrawalMethod: withdrawalMethod,
          bankName: withdrawalMethod === 'BANK_TRANSFER' ? bankName : null,
          bankAccountNumber: withdrawalMethod === 'BANK_TRANSFER' ? bankAccountNumber : null,
          bankAccountName: withdrawalMethod === 'BANK_TRANSFER' ? bankAccountName : null,
          bankBranch: withdrawalMethod === 'BANK_TRANSFER' ? bankBranch : null,
          mobileWalletNumber: withdrawalMethod !== 'BANK_TRANSFER' ? mobileWalletNumber : null,
          mobileWalletName: withdrawalMethod !== 'BANK_TRANSFER' ? mobileWalletName : null,
          idCardNumber: idCardNumber,
          idCardName: idCardName,
          phoneNumber: phoneNumber,
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
      console.error('提交提现申请失败:', error)
      alert(error.message || t('wallet.withdrawRequestFailed'))
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
              onClick={() => setWithdrawalMethod('BANK_TRANSFER')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                withdrawalMethod === 'BANK_TRANSFER'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="font-bold text-gray-800">{t('wallet.bankTransfer')}</div>
            </button>
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

        {/* 银行卡信息 */}
        {withdrawalMethod === 'BANK_TRANSFER' && (
          <div className="bg-white rounded-2xl p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.bankCardInfo')}</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={t('wallet.bankName')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder={t('wallet.accountNumber')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder={t('wallet.accountName')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder={t('wallet.bankBranch') + ' (' + t('common.optional') + ')'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* 手机钱包信息 */}
        {(withdrawalMethod === 'ALIF_MOBI' || withdrawalMethod === 'DC_BANK') && (
          <div className="bg-white rounded-2xl p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.mobileWalletInfo')}</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={mobileWalletNumber}
                onChange={(e) => setMobileWalletNumber(e.target.value)}
                placeholder={t('wallet.walletNumber')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={mobileWalletName}
                onChange={(e) => setMobileWalletName(e.target.value)}
                placeholder={t('wallet.walletAccountName')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* 身份信息 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.identityInfo')}</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={idCardName}
              onChange={(e) => setIdCardName(e.target.value)}
              placeholder={t('wallet.idCardName')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={idCardNumber}
              onChange={(e) => setIdCardNumber(e.target.value)}
              placeholder={t('wallet.idCardNumber')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
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
