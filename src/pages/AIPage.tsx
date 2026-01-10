import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { DailyProverb } from '../components/ai/DailyProverb';
import { QuickSuggestions } from '../components/ai/QuickSuggestions';
import { AIChat } from '../components/ai/AIChat';
import { UsageQuota } from '../components/ai/UsageQuota';
import { useAIQuota } from '../hooks/ai/useAIQuota';

export default function AIPage() {
  const { quota, loading, refetch } = useAIQuota();
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">TezBarakat AI</h1>
          {!loading && <UsageQuota quota={quota} />}
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showWelcome ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
                {/* 每日谚语 */}
                <DailyProverb />

                {/* 快捷提问建议 */}
                <QuickSuggestions />

                {/* 开始对话按钮 */}
                <motion.button
                  onClick={() => setShowWelcome(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
                >
                  Оғоз кардани гуфтугӯ
                </motion.button>

                {/* 使用说明 */}
                <div className="text-center text-sm text-gray-500 space-y-1">
                  <p>Ман ёрдамчии ҳушманди TezBarakat ҳастам</p>
                  <p>Ман метавонам ба Шумо дар масъалаҳои рӯзмарра кӯмак кунам</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <AIChat 
                onBack={() => setShowWelcome(true)} 
                onQuotaUpdate={refetch}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
