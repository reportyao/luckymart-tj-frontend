import React from 'react';
import { motion } from 'framer-motion';
import { Bot, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BotManagement from '../components/BotManagement';

export default function BotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{t('nav.bot')}</h1>
                <p className="text-sm text-gray-500">{t('nav.notifications')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <BotManagement />
        </motion.div>
      </div>
    </div>
  );
}