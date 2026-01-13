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
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  const currentLang = i18n.language as 'zh' | 'ru' | 'tg';

  // 三语版本的提示内容
  const content = {
    zh: {
      title: '温馨提示',
      point1: {
        text: 'TezBarakat 的商品均享受平台专属补贴，价格极具优势。因此，除质量问题外，',
        highlight: '所有商品暂不支持退换货',
        suffix: '，敬请谅解。'
      },
      point2: {
        text: '目前我们仅在',
        highlight: '杜尚别 (Dushanbe)',
        suffix: '市内提供自提点服务。购买前，请务必确认您能在杜尚别完成取货。'
      },
      button: '我已了解并同意'
    },
    tg: {
      title: 'Огоҳиномаи муҳим',
      point1: {
        text: 'Ҳамаи молҳо дар TezBarakat бо нархҳои махсуси субсидияшуда пешниҳод мегарданд. Аз ин рӯ, ба ғайр аз ҳолатҳои нуқсони сифат, ',
        highlight: 'молҳо баргардонида ё иваз карда намешаванд',
        suffix: '.'
      },
      point2: {
        text: 'Айни замон хизматрасонии мо танҳо дар шаҳри ',
        highlight: 'Душанбе',
        suffix: ' дастрас аст. Лутфан, пеш аз харид боварӣ ҳосил кунед, ки Шумо метавонед молро аз нуқтаҳои қабул дар Душанбе гиред.'
      },
      button: 'Ман фаҳмидам ва розӣ ҳастам'
    },
    ru: {
      title: 'Важное уведомление',
      point1: {
        text: 'Все товары на TezBarakat продаются по специальным субсидированным ценам. В связи с этим, за исключением случаев производственного брака, ',
        highlight: 'возврат и обмен товаров не предусмотрен',
        suffix: '.'
      },
      point2: {
        text: 'В настоящее время мы работаем только в городе ',
        highlight: 'Душанбе',
        suffix: '. Пожалуйста, перед покупкой убедитесь, что вы сможете забрать заказ в одном из наших пунктов выдачи в Душанбе.'
      },
      button: 'Я ознакомился и согласен'
    }
  };

  const text = content[currentLang] || content.ru;

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
              <h2 className="text-xl font-bold">{text.title}</h2>
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
              {text.point1.text}
              <span className="font-bold text-red-600">
                {text.point1.highlight}
              </span>
              {text.point1.suffix}
            </p>
          </div>

          {/* Point 2 */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              2
            </div>
            <p className="text-gray-700 leading-relaxed">
              {text.point2.text}
              <span className="font-bold text-red-600">
                {text.point2.highlight}
              </span>
              {text.point2.suffix}
            </p>
          </div>

          {/* Warning Box */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <p className="text-sm text-yellow-800">
              {currentLang === 'zh' && '⚠️ 请仔细阅读以上条款，点击确认即表示您已知晓并同意。'}
              {currentLang === 'tg' && '⚠️ Лутфан, шартҳои боло ба диққат хонед. Пахш кардани тугмаи тасдиқ маънои онро дорад, ки Шумо бо онҳо шинос шудед ва розӣ ҳастед.'}
              {currentLang === 'ru' && '⚠️ Пожалуйста, внимательно ознакомьтесь с условиями выше. Нажимая кнопку подтверждения, вы соглашаетесь с ними.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {text.button}
          </button>
        </div>
      </div>
    </div>
  );
};
