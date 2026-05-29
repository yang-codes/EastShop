import type { LocalizedText } from '../types/language'

export const translationService = {
  async translateFromChinese(text: string): Promise<LocalizedText> {
    return {
      en: '',
      ru: '',
      zh: text,
    }
  },
}
