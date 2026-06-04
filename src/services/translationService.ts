import type { LocalizedText } from '../types/language'
import { getSupabaseClient, getSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient'

type TranslateTextResponse = {
  error?: string
  message?: string
  translations?: LocalizedText
}

export const translationService = {
  /**
   * 根据中文商品文案生成三语文案结构。
   * 业务用途：后台商品编辑时辅助把中文名称、简介或详情翻译成英文和俄文。
   * 当前通过 Supabase Edge Function 代理腾讯云机器翻译，避免把腾讯云 SecretKey 暴露在浏览器。
   */
  async translateFromChinese(text: string): Promise<LocalizedText> {
    const sourceText = text.trim()

    if (!sourceText) {
      return {
        en: '',
        ru: '',
        zh: '',
      }
    }

    if (!isSupabaseConfigured()) {
      throw new Error('请先配置 Supabase 后再使用自动翻译。')
    }

    const { anonKey, url } = getSupabaseConfig()
    const supabase = getSupabaseClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (!accessToken) {
      throw new Error('请先登录管理员账号后再使用自动翻译。')
    }

    const response = await fetch(`${url}/functions/v1/translate-text`, {
      body: JSON.stringify({ text: sourceText }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const responseText = await response.text()
    let result: TranslateTextResponse | null = null

    try {
      result = JSON.parse(responseText) as TranslateTextResponse
    } catch {
      result = null
    }

    if (!response.ok) {
      throw new Error(result?.message || responseText || `翻译服务返回 HTTP ${response.status}`)
    }

    if (!result?.translations) {
      throw new Error('翻译服务返回了无效结果。')
    }

    return {
      en: result.translations.en,
      ru: result.translations.ru,
      zh: result.translations.zh,
    }
  },
}
