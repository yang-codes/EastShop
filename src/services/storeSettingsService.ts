import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import type { LocalizedText } from '../types/language'

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
  { id: 'cn', label: { zh: '中国', en: 'China', ru: 'Китай' }, prefix: '+86', isActive: true, sortOrder: 1 },
  { id: 'kz', label: { zh: '哈萨克斯坦', en: 'Kazakhstan', ru: 'Казахстан' }, prefix: '+7', isActive: true, sortOrder: 2 },
  { id: 'ru', label: { zh: '俄罗斯', en: 'Russia', ru: 'Россия' }, prefix: '+7', isActive: true, sortOrder: 3 },
  { id: 'uz', label: { zh: '乌兹别克斯坦', en: 'Uzbekistan', ru: 'Узбекистан' }, prefix: '+998', isActive: true, sortOrder: 4 },
  { id: 'kg', label: { zh: '吉尔吉斯斯坦', en: 'Kyrgyzstan', ru: 'Кыргызстан' }, prefix: '+996', isActive: true, sortOrder: 5 },
  { id: 'tj', label: { zh: '塔吉克斯坦', en: 'Tajikistan', ru: 'Tajikistan' }, prefix: '+992', isActive: true, sortOrder: 6 },
  { id: 'tm', label: { zh: '土库曼斯坦', en: 'Turkmenistan', ru: 'Туркменистан' }, prefix: '+993', isActive: true, sortOrder: 7 },
  { id: 'other', label: { zh: '其他', en: 'Other', ru: 'Другое' }, prefix: '+', isActive: true, isCustom: true, sortOrder: 99 },
]

export const defaultSocialPlatforms: SocialPlatformOption[] = [
  { id: 'telegram', label: { zh: 'Telegram', en: 'Telegram', ru: 'Telegram' }, code: 'telegram', isActive: true, sortOrder: 1 },
  { id: 'instagram', label: { zh: 'Instagram', en: 'Instagram', ru: 'Instagram' }, code: 'instagram', isActive: true, sortOrder: 2 },
  { id: 'facebook', label: { zh: 'Facebook', en: 'Facebook', ru: 'Facebook' }, code: 'facebook', isActive: true, sortOrder: 3 },
  { id: 'other', label: { zh: '其他', en: 'Other', ru: 'Другое' }, code: 'other', isActive: true, sortOrder: 99 },
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

    if (!id || !zh) {
      return
    }

    prefixes.push({
      id,
      label: { zh, en: en || zh, ru: ru || zh },
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

    if (!id || !code || !zh) {
      return
    }

    platforms.push({
      id,
      label: { zh, en: en || zh, ru: ru || zh },
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
