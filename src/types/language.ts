export type SupportedLanguage = 'zh' | 'en' | 'ru' | 'uz'

export type LocalizedText = {
  zh: string
  en: string
  ru: string
  uz: string
}

export function createLocalizedText(value: Partial<LocalizedText> = {}): LocalizedText {
  const zh = value.zh ?? ''

  return {
    en: value.en ?? zh,
    ru: value.ru ?? zh,
    uz: value.uz ?? zh,
    zh,
  }
}

export function resolveSupportedLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase()

  if (normalized.startsWith('zh')) {
    return 'zh'
  }

  if (normalized.startsWith('ru')) {
    return 'ru'
  }

  if (normalized.startsWith('uz')) {
    return 'uz'
  }

  return 'uz'
}
