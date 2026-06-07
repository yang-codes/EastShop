import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { createLocalizedText, type LocalizedText } from '../types/language'

export type PhonePrefixOption = {
  id: string
  label: LocalizedText
  prefix: string
  isActive: boolean
  isCustom?: boolean
  sortOrder: number
}

export type SocialPlatformOption = {
  id: string
  label: LocalizedText
  code: string
  isActive: boolean
  sortOrder: number
}

export type StoreSettings = {
  phonePrefixes: PhonePrefixOption[]
  socialPlatforms: SocialPlatformOption[]
}

type StoreSettingsRow = {
  id: string
  phone_prefixes: unknown
  social_platforms?: unknown
}

export const defaultPhonePrefixes: PhonePrefixOption[] = [
  { id: 'cn', label: createLocalizedText({ zh: '中国', en: 'China', ru: 'Китай', uz: 'Xitoy' }), prefix: '+86', isActive: true, sortOrder: 1 },
  { id: 'kz', label: createLocalizedText({ zh: '哈萨克斯坦', en: 'Kazakhstan', ru: 'Казахстан', uz: 'Qozogʻiston' }), prefix: '+7', isActive: true, sortOrder: 2 },
  { id: 'ru', label: createLocalizedText({ zh: '俄罗斯', en: 'Russia', ru: 'Россия', uz: 'Rossiya' }), prefix: '+7', isActive: true, sortOrder: 3 },
  { id: 'uz', label: createLocalizedText({ zh: '乌兹别克斯坦', en: 'Uzbekistan', ru: 'Узбекистан', uz: 'Oʻzbekiston' }), prefix: '+998', isActive: true, sortOrder: 4 },
  { id: 'kg', label: createLocalizedText({ zh: '吉尔吉斯斯坦', en: 'Kyrgyzstan', ru: 'Кыргызстан', uz: 'Qirgʻiziston' }), prefix: '+996', isActive: true, sortOrder: 5 },
  { id: 'tj', label: createLocalizedText({ zh: '塔吉克斯坦', en: 'Tajikistan', ru: 'Tajikistan', uz: 'Tojikiston' }), prefix: '+992', isActive: true, sortOrder: 6 },
  { id: 'tm', label: createLocalizedText({ zh: '土库曼斯坦', en: 'Turkmenistan', ru: 'Туркменистан', uz: 'Turkmaniston' }), prefix: '+993', isActive: true, sortOrder: 7 },
  { id: 'other', label: createLocalizedText({ zh: '其他', en: 'Other', ru: 'Другое', uz: 'Boshqa' }), prefix: '+', isActive: true, isCustom: true, sortOrder: 99 },
]

export const defaultSocialPlatforms: SocialPlatformOption[] = [
  { id: 'telegram', label: createLocalizedText({ zh: 'Telegram', en: 'Telegram', ru: 'Telegram', uz: 'Telegram' }), code: 'telegram', isActive: true, sortOrder: 1 },
  { id: 'instagram', label: createLocalizedText({ zh: 'Instagram', en: 'Instagram', ru: 'Instagram', uz: 'Instagram' }), code: 'instagram', isActive: true, sortOrder: 2 },
  { id: 'facebook', label: createLocalizedText({ zh: 'Facebook', en: 'Facebook', ru: 'Facebook', uz: 'Facebook' }), code: 'facebook', isActive: true, sortOrder: 3 },
  { id: 'other', label: createLocalizedText({ zh: '其他', en: 'Other', ru: 'Другое', uz: 'Boshqa' }), code: 'other', isActive: true, sortOrder: 99 },
]

const defaultSettings: StoreSettings = {
  phonePrefixes: defaultPhonePrefixes,
  socialPlatforms: defaultSocialPlatforms,
}

function normalizePrefix(prefix: string) {
  const normalized = prefix.trim().replace(/[^\d+]/g, '')
  if (!normalized) {
    return '+'
  }
  return normalized.startsWith('+') ? normalized : `+${normalized}`
}

export function normalizePhonePrefixes(value: unknown): PhonePrefixOption[] {
  if (!Array.isArray(value)) {
    return defaultPhonePrefixes
  }

  const prefixes: PhonePrefixOption[] = []

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const record = item as Partial<PhonePrefixOption>
    const id = String(record.id ?? '').trim()
    const label = record.label && typeof record.label === 'object' ? record.label : undefined
    const zh = String(label?.zh ?? '').trim()
    const en = String(label?.en ?? zh).trim()
    const ru = String(label?.ru ?? zh).trim()
    const uz = String(label?.uz ?? zh).trim()

    if (!id || !zh) {
      return
    }

    prefixes.push({
      id,
      label: createLocalizedText({ zh, en: en || zh, ru: ru || zh, uz: uz || zh }),
      prefix: normalizePrefix(String(record.prefix ?? '+')),
      isActive: record.isActive ?? true,
      isCustom: Boolean(record.isCustom),
      sortOrder: Number(record.sortOrder ?? index + 1),
    })
  })

  prefixes.sort((a, b) => a.sortOrder - b.sortOrder)

  return prefixes.length > 0 ? prefixes : defaultPhonePrefixes
}

function normalizePlatformCode(code: string) {
  return code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export function normalizeSocialPlatforms(value: unknown): SocialPlatformOption[] {
  if (!Array.isArray(value)) {
    return defaultSocialPlatforms
  }

  const platforms: SocialPlatformOption[] = []

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const record = item as Partial<SocialPlatformOption>
    const code = normalizePlatformCode(String(record.code ?? record.id ?? ''))
    const id = normalizePlatformCode(String(record.id ?? code))
    const label = record.label && typeof record.label === 'object' ? record.label : undefined
    const zh = String(label?.zh ?? '').trim()
    const en = String(label?.en ?? zh).trim()
    const ru = String(label?.ru ?? zh).trim()
    const uz = String(label?.uz ?? zh).trim()

    if (!id || !code || !zh) {
      return
    }

    platforms.push({
      id,
      label: createLocalizedText({ zh, en: en || zh, ru: ru || zh, uz: uz || zh }),
      code,
      isActive: record.isActive ?? true,
      sortOrder: Number(record.sortOrder ?? index + 1),
    })
  })

  platforms.sort((a, b) => a.sortOrder - b.sortOrder)

  return platforms.length > 0 ? platforms : defaultSocialPlatforms
}

function mapSettings(row: StoreSettingsRow | null): StoreSettings {
  if (!row) {
    return defaultSettings
  }

  return {
    phonePrefixes: normalizePhonePrefixes(row.phone_prefixes),
    socialPlatforms: normalizeSocialPlatforms(row.social_platforms),
  }
}

export const storeSettingsService = {
  async getSettings(): Promise<StoreSettings> {
    if (!isSupabaseConfigured()) {
      return defaultSettings
    }

    const { data, error } = await getSupabaseClient()
      .from('store_settings')
      .select('id, phone_prefixes, social_platforms')
      .eq('id', 'default')
      .maybeSingle()

    if (error) {
      console.warn('Failed to load store settings, fallback to defaults:', error)
      return defaultSettings
    }

    return mapSettings(data as StoreSettingsRow | null)
  },

  async saveSettings(settings: StoreSettings): Promise<StoreSettings> {
    const phonePrefixes = normalizePhonePrefixes(settings.phonePrefixes)
    const socialPlatforms = normalizeSocialPlatforms(settings.socialPlatforms)
    const { data, error } = await getSupabaseClient()
      .from('store_settings')
      .upsert({
        id: 'default',
        phone_prefixes: phonePrefixes,
        social_platforms: socialPlatforms,
      })
      .select('id, phone_prefixes, social_platforms')
      .single()

    if (error) {
      throw error
    }

    return mapSettings(data as StoreSettingsRow)
  },
}
