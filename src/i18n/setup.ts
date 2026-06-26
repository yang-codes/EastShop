import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import { resolveSupportedLanguage, type SupportedLanguage } from '../types/language'

const supportedLanguages: SupportedLanguage[] = ['uz', 'zh', 'en', 'ru']
const languageStorageKey = 'eastshop.language'

function getStoredLanguage() {
  try {
    return window.localStorage.getItem(languageStorageKey)
  } catch {
    return null
  }
}

function setStoredLanguage(language: string) {
  try {
    window.localStorage.setItem(languageStorageKey, language)
  } catch {
    // Some in-app browsers can block localStorage; language still changes for the current session.
  }
}

function resolveInitialLanguage(): SupportedLanguage {
  const storedLanguage = getStoredLanguage()
  const telegramLanguage = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  const browserLanguage = navigator.language
  const candidates = [storedLanguage, telegramLanguage, browserLanguage]

  for (const candidate of candidates) {
    const normalized = candidate?.toLowerCase()

    if (!normalized) {
      continue
    }

    if (normalized.startsWith('zh') || normalized.startsWith('ru') || normalized.startsWith('uz') || normalized.startsWith('en')) {
      return resolveSupportedLanguage(normalized)
    }
  }

  return 'uz'
}

void i18n.use(initReactI18next).init({
  fallbackLng: 'uz',
  interpolation: {
    escapeValue: false,
  },
  lng: resolveInitialLanguage(),
  resources,
  supportedLngs: supportedLanguages,
})

i18n.on('languageChanged', (language) => {
  setStoredLanguage(language)
})

export { i18n }
