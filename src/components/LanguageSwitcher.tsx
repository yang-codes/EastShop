import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../types/language'

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'uz', label: 'UZ' },
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
]

type LanguageSwitcherProps = {
  icon?: ReactNode
}

export function LanguageSwitcher({ icon }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const currentLanguage = languages.find((language) => i18n.language.startsWith(language.code)) ?? languages[0]

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    const closePopover = () => {
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', closePopover, true)
    window.addEventListener('touchmove', closePopover, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', closePopover, true)
      window.removeEventListener('touchmove', closePopover)
    }
  }, [isOpen])

  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language)
    setIsOpen(false)
  }

  return (
    <div className="language-switcher" aria-label="Language switcher" ref={switcherRef}>
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
