import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import type { SupportedLanguage } from '../types/language'

const supportedLanguages: SupportedLanguage[] = ['zh', 'en', 'ru']

function resolveInitialLanguage(): SupportedLanguage {
  const storedLanguage = localStorage.getItem('eastshop.language')
  const telegramLanguage = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  const browserLanguage = navigator.language
  const candidates = [storedLanguage, telegramLanguage, browserLanguage]

  for (const candidate of candidates) {
    const normalized = candidate?.toLowerCase()

    if (!normalized) {
      continue
    }

    if (normalized.startsWith('zh')) {
      return 'zh'
    }

    if (normalized.startsWith('ru')) {
      return 'ru'
    }

    if (normalized.startsWith('en')) {
      return 'en'
    }
  }

  return 'en'
}

void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  lng: resolveInitialLanguage(),
  resources,
  supportedLngs: supportedLanguages,
})

i18n.on('languageChanged', (language) => {
  localStorage.setItem('eastshop.language', language)
})

export { i18n }
