import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
// Note: This page uses Edge Functions directly, which is acceptable for this level of abstraction.
// In a larger application, these could also be moved to the service layer.
import { uploadImages } from '../lib/uploadImage'
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'

interface PaymentConfig {
  id: string
  config_key: string
  config_data: {
    method: string
    enabled: boolean
    account_number?: string
    account_name?: string
    bank_name?: string
    instructions: {
      zh: string
      ru: string
      tg: string
    }
    min_amount: number
    max_amount: number
    processing_time: string
  }
}

export default function DepositPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [selectedMethod, setSelectedMethod] = useState<PaymentConfig | null>(null)
  const [amount, setAmount] = useState('')
  const [payerName, setPayerName] = useState('')
  const [payerAccount, setPayerAccount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchPaymentConfigs()
  }, [])

  const fetchPaymentConfigs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('get-payment-config', {
        body: { type: 'DEPOSIT' }
      })

      if (error) throw error
      
      if (data?.success && data?.data) {
        setConfigs(data.data)
        if (data.data.length > 0) {
          setSelectedMethod(data.data[0])
        }
      }
    } catch (error) {
      console.error('获取支付配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    try {
      const fileArray = Array.from(files)
      const urls = await uploadImages(fileArray, true, 'payment-proofs', 'deposits')
      setUploadedImages(prev => [...prev, ...urls])
    } catch (error) {
      console.error('图片上传失败:', error)
      alert(t('wallet.imageUploadFailed'))
    }
  }

  const handleSubmit = async () => {
    if (!selectedMethod) {
      alert(t('wallet.pleaseSelectPaymentMethod'))
      return
    }

    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum < selectedMethod.config_data.min_amount) {
      alert(t('wallet.minimumAmount') + ': ' + formatCurrency('TJS', selectedMethod.config_data.min_amount))
      return
    }

    if (amountNum > selectedMethod.config_data.max_amount) {
      alert(t('wallet.maximumAmount') + ': ' + formatCurrency('TJS', selectedMethod.config_data.max_amount))
      return
    }

    if (!payerName || !payerAccount) {
      alert(t('wallet.pleaseCompletePaymentInfo'))
      return
    }

    // 验证是否上传了凭证
    if (!uploadedImages || uploadedImages.length === 0) {
      alert(t('wallet.pleaseUploadProof') || '请上传充值凭证')
      return
    }

    try {
      setSubmitting(true)

      const { data, error } = await supabase.functions.invoke('deposit-request', {
        body: {
          amount: amountNum,
          currency: 'TJS',
          paymentMethod: selectedMethod.config_data.method,
          paymentProofImages: uploadedImages,
          paymentReference: paymentReference,
          payerName: payerName,
          payerAccount: payerAccount,
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
      console.error('提交充值申请失败:', error)
      alert(error.message || t('wallet.depositRequestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const currentLang = i18n.language as 'zh' | 'ru' | 'tg'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-white text-xl">{t('common.loading')}</div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('wallet.depositRequestSubmitted')}</h2>
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
        <h1 className="text-white text-xl font-bold ml-4">{t('wallet.deposit')}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 选择支付方式 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.selectPaymentMethod')}</h2>
          <div className="space-y-2">
            {configs.map((config) => (
              <button
                key={config.id}
                onClick={() => setSelectedMethod(config)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedMethod?.id === config.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="font-bold text-gray-800">{config.config_data.method}</div>
                {config.config_data.bank_name && (
                  <div className="text-sm text-gray-600">{config.config_data.bank_name}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {t('wallet.processingTime')}: {config.config_data.processing_time}{t('wallet.minutes')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 转账信息 */}
        {selectedMethod && (
          <div className="bg-white rounded-2xl p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.transferInfo')}</h2>
            <div className="space-y-3 text-sm">
              {selectedMethod.config_data.account_number && (
                <div>
                  <div className="text-gray-600">{t('wallet.accountNumber')}</div>
                  <div className="font-bold text-gray-800">{selectedMethod.config_data.account_number}</div>
                </div>
              )}
              {selectedMethod.config_data.account_name && (
                <div>
                  <div className="text-gray-600">{t('wallet.accountName')}</div>
                  <div className="font-bold text-gray-800">{selectedMethod.config_data.account_name}</div>
                </div>
              )}
              {selectedMethod.config_data.bank_name && (
                <div>
                  <div className="text-gray-600">{t('wallet.bankName')}</div>
                  <div className="font-bold text-gray-800">{selectedMethod.config_data.bank_name}</div>
                </div>
              )}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                <div className="text-xs text-gray-700 whitespace-pre-line">
                  {selectedMethod.config_data.instructions[currentLang] || selectedMethod.config_data.instructions.zh}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 充值金额 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.depositAmount')}</h2>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('wallet.enterAmount')}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
          />
          {selectedMethod && (
            <div className="text-xs text-gray-500 mt-2">
              {t('wallet.amountRange')}: {formatCurrency('TJS', selectedMethod.config_data.min_amount)} - {formatCurrency('TJS', selectedMethod.config_data.max_amount)}
            </div>
          )}
        </div>

        {/* 付款人信息 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.payerInfo')}</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder={t('wallet.payerName')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={payerAccount}
              onChange={(e) => setPayerAccount(e.target.value)}
              placeholder={t('wallet.payerAccount')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder={t('wallet.paymentReference') + ' (' + t('common.optional') + ')'}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* 上传凭证 */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('wallet.uploadProof')}</h2>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-500 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">{t('wallet.clickToUpload')}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
          {uploadedImages.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {uploadedImages.map((img, idx) => (
                <img key={idx} src={img} alt="proof" className="w-full h-24 object-cover rounded-lg" />
              ))}
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {submitting ? t('common.submitting') : t('wallet.submitDepositRequest')}
        </button>
      </div>
    </div>
  )
}
