import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info } from 'lucide-react';

interface FirstDepositNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 首次充值提示弹窗
 * 
 * 功能说明:
 * - 仅在用户首次充值时显示
 * - 包含三语版本(中文/塔吉克语/俄语)
 * - 关键信息高亮显示
 * - 用户确认后不再显示
 */
export const FirstDepositNoticeModal: React.FC<FirstDepositNoticeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Info className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">{t('firstDeposit.title')}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Point 1 */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              1
            </div>
            <p className="text-gray-700 leading-relaxed">
              {t('firstDeposit.point1Text')}
              <span className="font-bold text-red-600">
                {t('firstDeposit.point1Highlight')}
              </span>
              {t('firstDeposit.point1Suffix')}
            </p>
          </div>

          {/* Point 2 */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              2
            </div>
            <p className="text-gray-700 leading-relaxed">
              {t('firstDeposit.point2Text')}
              <span className="font-bold text-red-600">
                {t('firstDeposit.point2Highlight')}
              </span>
              {t('firstDeposit.point2Suffix')}
            </p>
          </div>

          {/* Warning Box */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <p className="text-sm text-yellow-800">
              {t('firstDeposit.warning')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-6 pb-8 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('firstDeposit.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
};
