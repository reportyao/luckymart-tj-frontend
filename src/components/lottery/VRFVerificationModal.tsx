import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ShieldCheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { copyToClipboard as copyToClipboardUtil } from '../../lib/utils';

interface VRFVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotteryData: {
    id: string;
    title: string;
    draw_time: string;
    winning_numbers?: string;
    vrf_seed?: string;
    vrf_proof?: string;
    total_entries?: number;
  };
}

export const VRFVerificationModal: React.FC<VRFVerificationModalProps> = ({
  isOpen,
  onClose,
  lotteryData
}) => {
  const { t: _t } = useTranslation();

  const copyToClipboard = async (text: string, label: string) => {
    const success = await copyToClipboardUtil(text);
    if (success) {
      toast.success(`${label}已复制到剪贴板`);
    } else {
      toast.error('复制失败');
    }
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
          className="absolute inset-0 bg-black/60"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheckIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">VRF 开奖验证</h2>
                <p className="text-sm text-gray-500">可验证随机函数证明</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Introduction */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-2">什么是VRF验证?</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                VRF(Verifiable Random Function)是一种可验证的随机函数,确保开奖结果的公平性和不可篡改性。
                任何人都可以使用下方的种子(Seed)和证明(Proof)来验证开奖结果的真实性。
              </p>
            </div>

            {/* Lottery Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">抽奖信息</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">抽奖ID</p>
                  <p className="font-mono text-sm font-medium text-gray-900">{lotteryData.id}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">抽奖名称</p>
                  <p className="text-sm font-medium text-gray-900">{lotteryData.title}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">开奖时间</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(lotteryData.draw_time).toLocaleString('zh-CN')}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">参与人数</p>
                  <p className="text-sm font-medium text-gray-900">{lotteryData.total_entries || 0} 人</p>
                </div>
              </div>
            </div>

            {/* Winning Number */}
            {lotteryData.winning_numbers && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">中奖号码</h3>
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-600 mb-2">中奖号码</p>
                  <p className="text-3xl font-bold text-orange-600">{lotteryData.winning_numbers}</p>
                </div>
              </div>
            )}

            {/* VRF Seed */}
            {lotteryData.vrf_seed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">VRF Seed (种子)</h3>
                  <button
                    onClick={() => copyToClipboard(lotteryData.vrf_seed!, 'VRF Seed')}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    <span>复制</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="font-mono text-xs text-gray-700 break-all leading-relaxed">
                    {lotteryData.vrf_seed}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  * 种子是生成随机数的初始输入,由时间戳、抽奖ID和随机字节组合生成
                </p>
              </div>
            )}

            {/* VRF Proof */}
            {lotteryData.vrf_proof && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">VRF Proof (证明)</h3>
                  <button
                    onClick={() => copyToClipboard(lotteryData.vrf_proof!, 'VRF Proof')}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    <span>复制</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="font-mono text-xs text-gray-700 break-all leading-relaxed">
                    {lotteryData.vrf_proof}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  * 证明用于验证随机数生成过程的正确性和不可篡改性
                </p>
              </div>
            )}

            {/* Verification Steps */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">如何验证?</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">复制VRF Seed和Proof</p>
                    <p className="text-xs text-gray-600 mt-1">使用上方的复制按钮获取验证数据</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">使用SHA-256算法验证</p>
                    <p className="text-xs text-gray-600 mt-1">将Seed通过SHA-256哈希,对比Proof验证一致性</p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">确认开奖结果</p>
                    <p className="text-xs text-gray-600 mt-1">验证通过后,确认中奖号码的真实性</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ShieldCheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">安全保证</p>
                  <p className="text-xs text-green-800 mt-1 leading-relaxed">
                    我们使用Web Crypto API的SHA-256算法生成VRF,确保开奖过程公开透明、
                    结果不可预测且不可篡改。所有开奖数据永久保存在区块链上,可随时验证。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
