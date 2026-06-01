import type { LocalizedText } from '../types/language'

export const translationService = {
  /**
   * 根据中文商品文案生成三语文案结构。
   * 业务用途：后台商品编辑时辅助把中文名称、简介或详情翻译成英文和俄文。
   * 当前是占位实现，后续接入 DeepL API 或 Edge Function 代理。
   */
  async translateFromChinese(text: string): Promise<LocalizedText> {
    return {
      en: '',
      ru: '',
      zh: text,
    }
  },
}
