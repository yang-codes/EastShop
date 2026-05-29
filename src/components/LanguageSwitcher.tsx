import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../types/language'

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
]

type LanguageSwitcherProps = {
  icon?: ReactNode
}

export function LanguageSwitcher({ icon }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()

  return (
    <div className="language-switcher" aria-label="Language switcher">
      {icon}
      {languages.map((language) => (
        <button
          className={i18n.language.startsWith(language.code) ? 'active' : ''}
          key={language.code}
          onClick={() => void i18n.changeLanguage(language.code)}
          type="button"
        >
          {language.label}
        </button>
      ))}
    </div>
  )
}
