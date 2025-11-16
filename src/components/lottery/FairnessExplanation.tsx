import { useTranslation } from 'react-i18next'
import { ShieldCheckIcon, CalculatorIcon, ClockIcon, TicketIcon } from '@heroicons/react/24/outline'
import { formatDateTime } from '@/lib/utils'

interface FairnessExplanationProps {
  timestampSum: string // 毫秒级时间戳总和
  totalShares: number // 总份数
  drawTime: string // 开奖时间
}

const FairnessExplanation: React.FC<FairnessExplanationProps> = ({
  timestampSum,
  totalShares,
  drawTime
}) => {
  const { t } = useTranslation()

  const fairnessQuestions = [
    {
      question: t('fairness.question1'),
      answer: t('fairness.answer1'),
      isFair: false
    },
    {
      question: t('fairness.question2'),
      answer: t('fairness.answer2'),
      isFair: false
    },
    {
      question: t('fairness.question3'),
      answer: t('fairness.answer3'),
      isFair: false
    },
    {
      question: t('fairness.question4'),
      answer: t('fairness.answer4'),
      isFair: true
    }
  ]

  const verificationData = [
    {
      icon: CalculatorIcon,
      label: t('verification.timestampSum'),
      value: timestampSum
    },
    {
      icon: TicketIcon,
      label: t('verification.totalShares'),
      value: totalShares.toString()
    },
    {
      icon: ClockIcon,
      label: t('verification.drawTime'),
      value: formatDateTime(drawTime)
    }
  ]

  const formula = `(${t('verification.timestampSum')} / ${t('verification.totalShares')}) % ${t('verification.totalShares')} + 1`
  const luckyNumber = (BigInt(timestampSum) / BigInt(totalShares)) % BigInt(totalShares) + BigInt(1)

  return (
    <div className="mt-8 p-6 bg-white rounded-xl shadow-lg border-l-4 border-blue-500">
      <div className="flex items-center mb-6">
        <ShieldCheckIcon className="w-8 h-8 text-blue-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-800">{t('fairness.title')}</h2>
      </div>

      {/* 验证数据 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {verificationData.map((item, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <item.icon className="w-6 h-6 text-blue-500 mb-2" />
            <p className="text-sm font-medium text-gray-500">{item.label}</p>
            <p className="text-lg font-semibold text-gray-900 break-all">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 验证公式 */}
      <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 mb-2">{t('verification.formula')}:</p>
        <code className="block p-3 bg-yellow-100 rounded-md text-yellow-900 overflow-x-auto whitespace-pre-wrap">
          {formula}
        </code>
        <p className="mt-2 text-sm font-medium text-yellow-800">
          {t('lottery.luckyNumber')}: <span className="font-bold text-xl">{luckyNumber.toString()}</span>
        </p>
      </div>

      {/* 公平性问答 */}
      <div className="space-y-4">
        {fairnessQuestions.map((item, index) => (
          <div key={index} className="border-b pb-4 last:border-b-0">
            <p className="text-base font-semibold text-gray-800 flex items-start">
              <span className="mr-2 text-blue-600">Q{index + 1}.</span>
              {item.question}
            </p>
            <p className="text-gray-600 mt-1 flex items-start">
              <span className={`mr-2 font-bold text-lg ${item.isFair ? 'text-green-500' : 'text-red-500'}`}>
                {item.isFair ? '✅' : '❌'}
              </span>
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FairnessExplanation
