import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CreditCardIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000, 5000];

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);
    
    if (!depositAmount || depositAmount <= 0) {
      toast.error(t('error.validationError'));
      return;
    }

    if (depositAmount < 10) {
      toast.error('最小充值金额为 10 TJS');
      return;
    }

    setIsProcessing(true);

    try {
      // TODO: 集成实际支付网关
      // 这里模拟支付流程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟成功
      toast.success(t('wallet.depositSuccess'));
      onSuccess();
      onClose();
      setAmount('');
    } catch (error: any) {
      console.error('Deposit failed:', error);
      toast.error(error.message || t('error.networkError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const selectPresetAmount = (presetAmount: number) => {
    setAmount(presetAmount.toString());
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">{t('wallet.deposit')}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Payment Method Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                支付方式
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center space-x-2 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCardIcon className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-700'}`}>
                    银行卡
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod('bank')}
                  className={`flex items-center justify-center space-x-2 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'bank'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <BanknotesIcon className={`w-5 h-5 ${paymentMethod === 'bank' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${paymentMethod === 'bank' ? 'text-blue-600' : 'text-gray-700'}`}>
                    银行转账
                  </span>
                </button>
              </div>
            </div>

            {/* Preset Amounts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                快速选择金额
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((presetAmount) => (
                  <button
                    key={presetAmount}
                    onClick={() => selectPresetAmount(presetAmount)}
                    className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                      amount === presetAmount.toString()
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {presetAmount} TJS
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自定义金额
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="输入充值金额"
                  className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="10"
                  step="10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  TJS
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                最小充值金额: 10 TJS
              </p>
            </div>

            {/* Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>提示:</strong> 充值功能当前为演示模式,实际支付网关集成中。
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex space-x-3 p-6 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeposit}
              disabled={isProcessing || !amount}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </span>
              ) : (
                `确认充值 ${amount ? parseFloat(amount).toFixed(2) : '0.00'} TJS`
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
