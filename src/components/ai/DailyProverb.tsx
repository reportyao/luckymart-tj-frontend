import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useDailyProverb } from '../../hooks/ai/useDailyProverb';

export function DailyProverb() {
  const { proverb, nextProverb, loading } = useDailyProverb();

  if (loading || !proverb) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 h-48 animate-pulse" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <SparklesIcon className="w-5 h-5" />
        <span className="text-sm font-medium">Имрӯз меомӯзем</span>
      </div>

      {/* 谚语内容 - 只显示塔吉克语 */}
      <div className="mb-4">
        <p className="text-lg font-medium leading-relaxed">
          "{proverb.tajik}"
        </p>
      </div>

      {/* 切换按钮 */}
      <button
        onClick={nextProverb}
        className="flex items-center gap-2 text-sm text-blue-100 hover:text-white transition-colors"
      >
        <ArrowPathIcon className="w-4 h-4" />
        <span>Дигар нишон диҳед</span>
      </button>
    </motion.div>
  );
}
