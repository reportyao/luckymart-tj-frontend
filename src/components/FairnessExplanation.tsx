// 公平性说明组件
// 在开奖结果页面展示算法公平性说明

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface FairnessExplanationProps {
  timestampSum?: string;  // 时间戳总和
  totalTickets?: number;  // 总票数
  winningNumber?: number;  // 中奖号码
  showVerificationData?: boolean;  // 是否显示验证数据
}

export const FairnessExplanation: React.FC<FairnessExplanationProps> = ({
  timestampSum,
  totalTickets,
  winningNumber,
  showVerificationData = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 公平性说明卡片 */}
      <Card className="border-2 border-blue-500 shadow-lg">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="text-blue-900">{t('fairness.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* 问答1: 用户能操纵时间戳吗? */}
          <div className="flex gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-800 mb-1">
                {t('fairness.question1')}
              </p>
              <p className="text-gray-600 text-sm">
                {t('fairness.answer1')}
              </p>
            </div>
          </div>

          {/* 问答2: 平台能作弊吗? */}
          <div className="flex gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-800 mb-1">
                {t('fairness.question2')}
              </p>
              <p className="text-gray-600 text-sm">
                {t('fairness.answer2')}
              </p>
            </div>
          </div>

          {/* 问答3: 最后购买有优势吗? */}
          <div className="flex gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-800 mb-1">
                {t('fairness.question3')}
              </p>
              <p className="text-gray-600 text-sm">
                {t('fairness.answer3')}
              </p>
            </div>
          </div>

          {/* 问答4: 算法够随机吗? */}
          <div className="flex gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-800 mb-1">
                {t('fairness.question4')}
              </p>
              <p className="text-gray-600 text-sm">
                {t('fairness.answer4')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 验证数据卡片(可选) */}
      {showVerificationData && timestampSum && totalTickets && winningNumber && (
        <Card className="border border-gray-300">
          <CardHeader className="bg-gray-50">
            <CardTitle className="text-gray-900 text-lg">
              {t('fairness.verification_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{t('fairness.timestamp_sum')}:</span>
                <span className="text-gray-900 font-bold">{timestampSum}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{t('fairness.total_tickets')}:</span>
                <span className="text-gray-900 font-bold">{totalTickets}</span>
              </div>
              <div className="border-t border-gray-300 my-3"></div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('fairness.formula')}:</span>
                <span className="text-blue-600 font-bold">
                  {winningNumber} = {timestampSum} % {totalTickets} + 1
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {t('fairness.verification_hint')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FairnessExplanation;
