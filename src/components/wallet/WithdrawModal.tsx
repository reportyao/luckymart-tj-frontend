import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { wallets } = useUser();
  const [amount, setAmount] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const balanceWallet = wallets.find(w => w.type === 'BALANCE');
  const availableBalance = balanceWallet?.balance || 0;
  const MIN_WITHDRAW = 50;
  const MAX_WITHDRAW = 10000;
  const WITHDRAW_FEE_RATE = 0.02; // 2% 手续费

  const calculateFee = (withdrawAmount: number): number => {
    return withdrawAmount * WITHDRAW_FEE_RATE;
  };

  const calculateActualAmount = (withdrawAmount: number): number => {
    return withdrawAmount - calculateFee(withdrawAmount);
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    
    if (!withdrawAmount || withdrawAmount <= 0) {
      toast.error(t('error.validationError'));
      return;
    }

    if (withdrawAmount < MIN_WITHDRAW) {
      toast.error(`最小提现金额为 ${MIN_WITHDRAW} TJS`);
      return;
    }

    if (withdrawAmount > MAX_WITHDRAW) {
      toast.error(`单笔最大提现金额为 ${MAX_WITHDRAW} TJS`);
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast.error(t('wallet.insufficientBalance'));
      return;
    }

    if (!bankAccount || !bankName || !accountHolder) {
      toast.error('请填写完整的银行信息');
      return;
    }

    setIsProcessing(true);

    try {
      // TODO: 调用实际提现API
      // 这里模拟提现流程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('提现申请已提交,预计1-3个工作日到账');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Withdraw failed:', error);
      toast.error(error.message || t('error.networkError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setBankAccount('');
    setBankName('');
    setAccountHolder('');
  };

  const setMaxAmount = () => {
    setAmount(availableBalance.toString());
  };

  if (!isOpen) return null;

  const withdrawAmount = parseFloat(amount) || 0;
  const fee = calculateFee(withdrawAmount);
  const actualAmount = calculateActualAmount(withdrawAmount);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-bold text-gray-900">{t('wallet.withdraw')}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Available Balance */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">可提现余额</p>
              <p className="text-3xl font-bold mt-1">{availableBalance.toFixed(2)} TJS</p>
            </div>

            {/* Withdraw Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提现金额
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`最小 ${MIN_WITHDRAW} TJS`}
                  className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={MIN_WITHDRAW}
                  max={MAX_WITHDRAW}
                  step="10"
                />
                <button
                  onClick={setMaxAmount}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-600 text-sm font-medium rounded transition-colors"
                >
                  全部
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                提现范围: {MIN_WITHDRAW} - {MAX_WITHDRAW} TJS
              </p>
            </div>

            {/* Fee Calculation */}
            {withdrawAmount > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">提现金额</span>
                  <span className="font-medium text-gray-900">{withdrawAmount.toFixed(2)} TJS</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">手续费 ({(WITHDRAW_FEE_RATE * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-red-600">-{fee.toFixed(2)} TJS</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between">
                  <span className="font-medium text-gray-900">实际到账</span>
                  <span className="font-bold text-green-600 text-lg">{actualAmount.toFixed(2)} TJS</span>
                </div>
              </div>
            )}

            {/* Bank Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">银行信息</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  银行名称
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="例如: Amonatbank"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  账户持有人
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="请输入账户持有人姓名"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  银行账号
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="请输入银行账号"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Warning Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 space-y-1">
                <p className="font-medium">提现须知:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>提现申请提交后将在1-3个工作日内处理</li>
                  <li>请确保银行信息准确,错误信息可能导致提现失败</li>
                  <li>提现功能当前为演示模式,实际流程集成中</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex space-x-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleWithdraw}
              disabled={isProcessing || !amount || !bankAccount || !bankName || !accountHolder || withdrawAmount < MIN_WITHDRAW}
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
                '确认提现'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
