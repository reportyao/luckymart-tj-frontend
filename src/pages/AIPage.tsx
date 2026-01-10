import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { DailyProverb } from '../components/ai/DailyProverb';
import { QuickSuggestions } from '../components/ai/QuickSuggestions';
import { AIChat } from '../components/ai/AIChat';
import { UsageQuota } from '../components/ai/UsageQuota';
import { useAIQuota } from '../hooks/ai/useAIQuota';
import { useAIChat } from '../hooks/ai/useAIChat';
import { AIServiceError } from '../lib/aiService';
import toast from 'react-hot-toast';

// 错误消息映射 (塔吉克语)
const ERROR_MESSAGES: Record<string, string> = {
  'QUOTA_EXCEEDED': 'Шумо имрӯз ҳамаи саволҳоро истифода бурдед. Дӯстонро даъват кунед ё дар пулинг иштирок кунед!',
  'SENSITIVE_CONTENT': 'Мебахшед, ман наметавонам дар бораи ин мавзӯъ сӯҳбат кунам. Лутфан мавзӯъи дигар интихоб кунед.',
  'AI_ERROR': 'Хатогӣ рух дод. Лутфан дубора кӯшиш кунед.',
  'UNAUTHORIZED': 'Лутфан аввал ворид шавед.',
  'DEFAULT': 'Хатогӣ рух дод. Лутфан дубора кӯшиш кунед.'
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIPage() {
  const { quota, loading, refetch } = useAIQuota();
  const [showWelcome, setShowWelcome] = useState(true);
  const [quickInput, setQuickInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const { sendMessage, loading: sending } = useAIChat();

  // 处理欢迎页面的快速提问
  const handleQuickSend = async () => {
    const trimmedInput = quickInput.trim();
    
    if (!trimmedInput || sending) return;

    // 添加用户消息到全局状态
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 发送消息
      const response = await sendMessage(trimmedInput);
      
      // 添加AI回复到全局状态
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // 清空输入
      setQuickInput('');
      
      // 切换到聊天界面
      setShowWelcome(false);
      
      // 更新配额
      refetch();
      
    } catch (error) {
      console.error('Quick send error:', error);
      
      // 根据错误类型显示不同提示
      let errorMessage = ERROR_MESSAGES['DEFAULT'];
      
      if (error instanceof AIServiceError) {
        errorMessage = ERROR_MESSAGES[error.code] || error.message || ERROR_MESSAGES['DEFAULT'];
      }
      
      toast.error(errorMessage, {
        duration: 4000
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSend();
    }
  };

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

                {/* 直接输入框和按钮 - 移到谚语下方 */}
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleQuickSend();
                        }
                      }}
                      placeholder="Саволи худро нависед..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      disabled={sending}
                      maxLength={500}
                      rows={4}
                      style={{ minHeight: '100px' }}
                    />
                    <button
                      onClick={handleQuickSend}
                      disabled={sending || !quickInput.trim()}
                      className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors self-end"
                    >
                      <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 快捷提问建议 */}
                <QuickSuggestions />

                {/* 使用说明 */}
                <div className="text-center text-sm text-gray-500 space-y-1">
                  <p>Ман ёрдамчии ҳушманди TezBarakat ҳастам</p>
                  <p>Ман метавонам ба Шумо дар масъалаҳои рӯзмарра кӯмак кунам</p>
                </div>

                {/* AI免责声明 */}
                <div className="text-center text-xs text-gray-400 mt-4 pb-4">
                  AI танҳо барои маълумот аст, на мавқеи расмӣ.
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
                initialMessages={messages}
                onMessagesChange={setMessages}
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
