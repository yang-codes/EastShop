import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../types/language'

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
]

type LanguageSwitcherProps = {
  icon?: ReactNode
}

export function LanguageSwitcher({ icon }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const currentLanguage = languages.find((language) => i18n.language.startsWith(language.code)) ?? languages[0]

  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language)
    setIsOpen(false)
  }

  return (
    <div className="language-switcher" aria-label="Language switcher">
      {icon}
      <div className="language-inline-options">
        {languages.map((language) => (
          <button
            className={i18n.language.startsWith(language.code) ? 'active' : ''}
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            type="button"
          >
            {language.label}
          </button>
        ))}
      </div>
      <button
        aria-expanded={isOpen}
        className="language-current-button active"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {currentLanguage.label}
      </button>
      {isOpen ? (
        <div className="language-popover">
          {languages.map((language) => (
            <button
              className={i18n.language.startsWith(language.code) ? 'active' : ''}
              key={language.code}
              onClick={() => changeLanguage(language.code)}
              type="button"
            >
              {language.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
