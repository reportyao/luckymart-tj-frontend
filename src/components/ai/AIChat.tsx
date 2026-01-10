import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { useAIChat } from '../../hooks/ai/useAIChat';
import { MessageBubble } from './MessageBubble';
import { AIServiceError } from '../../lib/aiService';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  onBack: () => void;
  onQuotaUpdate: () => void;
}

// 错误消息映射 (塔吉克语)
const ERROR_MESSAGES: Record<string, string> = {
  'QUOTA_EXCEEDED': 'Шумо имрӯз ҳамаи саволҳоро истифода бурдед. Дӯстонро даъват кунед ё дар пулинг иштирок кунед!',
  'SENSITIVE_CONTENT': 'Мебахшед, ман наметавонам дар бораи ин мавзӯъ сӯҳбат кунам. Лутфан мавзӯъи дигар интихоб кунед.',
  'AI_ERROR': 'Хатогӣ рух дод. Лутфан дубора кӯшиш кунед.',
  'UNAUTHORIZED': 'Лутфан аввал ворид шавед.',
  'DEFAULT': 'Хатогӣ рух дод. Лутфан дубора кӯшиш кунед.'
};

export function AIChat({ initialMessages = [], onMessagesChange, onBack, onQuotaUpdate }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  
  // 同步messages到父组件
  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);
  const [input, setInput] = useState('');
  const { sendMessage, loading } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput || loading) return;

    // 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // 调用 AI API
      const response = await sendMessage(trimmedInput);
      
      // 添加 AI 回复
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // 更新次数
      onQuotaUpdate();
      
    } catch (error) {
      console.error('AI chat error:', error);
      
      // 根据错误类型显示不同提示
      let errorMessage = ERROR_MESSAGES['DEFAULT'];
      
      if (error instanceof AIServiceError) {
        errorMessage = ERROR_MESSAGES[error.code] || error.message || ERROR_MESSAGES['DEFAULT'];
      }
      
      toast.error(errorMessage, {
        duration: 4000
      });
    }

    // 重新聚焦输入框
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 返回按钮 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Бозгашт</span>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Саволи худро нависед</p>
            <p className="text-xs mt-2">Ман ба Шумо дар масъалаҳои рӯзмарра кӯмак мекунам</p>
          </div>
        )}
        
        <AnimatePresence>
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {/* 加载动画 */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-500"
          >
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">Интизор шавед...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Саволи худро нависед..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={loading}
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* 字符计数 */}
        {input.length > 0 && (
          <div className="text-xs text-gray-500 mt-2 text-right">
            {input.length}/500
          </div>
        )}
        
        {/* AI免责声明 */}
        <div className="text-center text-xs text-gray-400 mt-2">
          AI танҳо барои маълумот аст, на мавқеи расмӣ.
        </div>
      </div>
    </div>
  );
}
