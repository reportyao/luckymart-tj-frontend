import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  ArrowLeftIcon,
  LanguageIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'zh')

  const languages = [
    { code: 'zh', name: '中文', nativeName: '简体中文' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' }
  ]

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode)
      setCurrentLanguage(languageCode)
      localStorage.setItem('i18nextLng', languageCode)
      
      // 根据语言显示不同的提示
      const messages: Record<string, string> = {
        zh: '语言已切换为中文',
        ru: 'Язык изменен на русский',
        tg: 'Забон ба тоҷикӣ иваз шуд'
      }
      toast.success(messages[languageCode] || '语言已切换')
      
      // 刷新页面以应用新语言
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('语言切换失败:', error)
      toast.error('语言切换失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 页面标题 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">系统设置</h1>
        </div>
      </div>

      {/* 语言设置 */}
      <div className="mx-4 mt-4">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <LanguageIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">语言设置</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">选择您的首选语言</p>
          </div>

          <div className="divide-y divide-gray-100">
            {languages.map((language, index) => (
              <motion.button
                key={language.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleLanguageChange(language.code)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{language.nativeName}</p>
                    <p className="text-xs text-gray-500">{language.name}</p>
                  </div>
                </div>
                {currentLanguage === language.code && (
                  <CheckIcon className="w-5 h-5 text-blue-600" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* 其他设置（预留） */}
      <div className="mx-4 mt-4">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">通知设置</h2>
            <p className="text-sm text-gray-500 mt-1">管理通知偏好</p>
          </div>

          <div className="p-4">
            <p className="text-sm text-gray-500 text-center py-8">功能开发中...</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
