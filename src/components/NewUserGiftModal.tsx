import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafeMotion } from './SafeMotion';
import { GiftIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface NewUserGiftModalProps {
  isOpen: boolean;
  giftAmount: number;
  onClose: () => void;
}

/**
 * 新用户礼物弹窗组件
 * 当新用户通过邀请链接首次进入时显示
 */
const NewUserGiftModal: React.FC<NewUserGiftModalProps> = ({
  isOpen,
  giftAmount,
  onClose
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <SafeMotion
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-[90%] max-w-sm"
      >
        <div className="bg-gradient-to-b from-purple-600 to-pink-600 rounded-3xl p-1">
          <div className="bg-white rounded-[22px] overflow-hidden">
            {/* 顶部装饰 */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 pt-8 pb-12 px-6 relative overflow-hidden">
              {/* 装饰性星星 */}
              <div className="absolute top-4 left-4 animate-pulse">
                <SparklesIcon className="w-6 h-6 text-yellow-300" />
              </div>
              <div className="absolute top-8 right-6 animate-pulse delay-100">
                <SparklesIcon className="w-4 h-4 text-yellow-300" />
              </div>
              <div className="absolute bottom-4 left-8 animate-pulse delay-200">
                <SparklesIcon className="w-5 h-5 text-yellow-300" />
              </div>
              
              {/* 礼盒图标 */}
              <div className="flex justify-center">
                <SafeMotion
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.2, damping: 15 }}
                  className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center"
                >
                  <SafeMotion
                    animate={{ 
                      y: [0, -8, 0],
                      rotate: [0, -5, 5, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatType: 'loop'
                    }}
                  >
                    <GiftIcon className="w-14 h-14 text-white" />
                  </SafeMotion>
                </SafeMotion>
              </div>
            </div>
            
            {/* 内容区域 */}
            <div className="px-6 pb-6 -mt-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                <SafeMotion
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🎁 {t('newUserGift.title')}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {t('newUserGift.description')}
                  </p>
                  
                  {/* 积分数量 */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-500 mb-1">{t('newUserGift.youReceived')}</p>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {giftAmount}
                      </span>
                      <span className="text-lg text-gray-600">{t('newUserGift.points')}</span>
                    </div>
                  </div>
                  
                  {/* 确认按钮 */}
                  <button
                    onClick={onClose}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-98"
                  >
                    {t('newUserGift.receiveButton')}
                  </button>
                </SafeMotion>
              </div>
            </div>
          </div>
        </div>
      </SafeMotion>
    </div>
  );
};

export default NewUserGiftModal;
