import { useState, useEffect } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'
import { useUser } from '../contexts/UserContext'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const languages = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'tg', name: 'Тоҷикӣ', flag: '🇹🇯' }
]

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [currentLang, setCurrentLang] = useState(i18n.language)

  useEffect(() => {
    // 确保 i18n.language 状态与实际语言同步
    setCurrentLang(i18n.language)
  }, [i18n.language])

  const { supabase } = useSupabase()
  const { user, refreshProfile } = useUser()

  const changeLanguage = async (langCode: string) => {
    i18n.changeLanguage(langCode)
    // LanguageDetector 会自动处理 localStorage

    if (user) {
      // 将语言偏好同步到 Supabase profile
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: langCode })
        .eq('id', user.id)
      
      if (error) {
        console.error('Error updating preferred language:', error)
      } else {
        refreshProfile()
      }
    }
  }

  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>{currentLanguage?.flag}</span>
          <span>{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="cursor-pointer"
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.name}</span>
            {lang.code === currentLang && (
              <span className="ml-2 text-blue-600">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
