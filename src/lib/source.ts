import type { EntrySource } from '../types/order'

const entrySourceStorageKey = 'eastshop.entrySource'
const webHostnames = new Set(['localhost', '127.0.0.1', 'www.yangshop.online', 'yangshop.online'])
const telegramInitDataPollIntervalMs = 100
let cachedTelegramInitData = ''
let telegramInitDataPreloadPromise: Promise<string> | null = null

function normalizeEntrySource(source: string | null | undefined): EntrySource | null {
  const normalizedSource = source?.trim().toLowerCase()

  if (!normalizedSource) {
    return null
  }

  if (normalizedSource === 'tel' || normalizedSource === 'tg') {
    return 'telegram'
  }

  if (normalizedSource === 'instagram' || normalizedSource === 'web' || normalizedSource === 'telegram') {
    return normalizedSource
  }

  return null
}

function normalizeEntrySourceFromParam(value: string | null | undefined): EntrySource | null {
  const directSource = normalizeEntrySource(value)

  if (directSource) {
    return directSource
  }

  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return null
  }

  const nestedParams = new URLSearchParams(normalizedValue.includes('?') ? normalizedValue.split('?').pop() : normalizedValue)
  return normalizeEntrySource(nestedParams.get('source') ?? nestedParams.get('utm_source') ?? nestedParams.get('ref'))
}

function getHashQuery() {
  return window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
}

function getHashParams() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  return new URLSearchParams(hash.includes('?') ? hash.split('?').pop() : hash)
}

function getUrlEntrySource(): EntrySource | null {
  const params = new URLSearchParams(window.location.search)
  const hashQueryParams = new URLSearchParams(getHashQuery())
  const hashParams = getHashParams()
  const telegramStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param

  const candidates = [
    params.get('source'),
    params.get('utm_source'),
    params.get('ref'),
    params.get('startapp'),
    params.get('tgWebAppStartParam'),
    hashQueryParams.get('source'),
    hashQueryParams.get('utm_source'),
    hashQueryParams.get('ref'),
    hashQueryParams.get('startapp'),
    hashParams.get('tgWebAppStartParam'),
    telegramStartParam,
  ]

  for (const candidate of candidates) {
    const source = normalizeEntrySourceFromParam(candidate)

    if (source) {
      return source
    }
  }

  return null
}

function rememberEntrySource(source: EntrySource) {
  try {
    window.sessionStorage.setItem(entrySourceStorageKey, source)
  } catch {
    // Session storage can be blocked in some in-app browsers; source detection still works for the current call.
  }
}

function getRememberedEntrySource(): EntrySource | null {
  try {
    return normalizeEntrySource(window.sessionStorage.getItem(entrySourceStorageKey))
  } catch {
    return null
  }
}

function isKnownWebHost() {
  return webHostnames.has(window.location.hostname.toLowerCase())
}

function isInstagramRuntime() {
  const userAgent = window.navigator.userAgent
  const vendor = window.navigator.vendor
  const referrer = document.referrer

  return /Instagram/i.test(userAgent)
    || /Instagram/i.test(vendor)
    || /(^https?:\/\/)?([^/]+\.)?instagram\.com/i.test(referrer)
}

function isTelegramRuntime() {
  const webApp = window.Telegram?.WebApp

  return Boolean(webApp?.initData?.trim() || webApp?.initDataUnsafe?.user || getTelegramInitData())
}

export function detectEntrySource(): EntrySource {
  const urlSource = getUrlEntrySource()

  if (urlSource) {
    rememberEntrySource(urlSource)
    return urlSource
  }

  if (isTelegramRuntime()) {
    rememberEntrySource('telegram')
    return 'telegram'
  }

  if (isInstagramRuntime()) {
    rememberEntrySource('instagram')
    return 'instagram'
  }

  const rememberedSource = getRememberedEntrySource()

  if (rememberedSource) {
    return rememberedSource
  }

  if (isKnownWebHost()) {
    rememberEntrySource('web')
    return 'web'
  }

  return 'web'
}

export function getTelegramInitData() {
  if (cachedTelegramInitData) {
    return cachedTelegramInitData
  }

  const sdkInitData = window.Telegram?.WebApp?.initData?.trim()

  if (sdkInitData) {
    cachedTelegramInitData = sdkInitData
    return sdkInitData
  }

  const params = new URLSearchParams(window.location.search)
  const hashParams = getHashParams()

  const initData = params.get('tgWebAppData')?.trim() ?? hashParams.get('tgWebAppData')?.trim() ?? ''

  if (initData) {
    cachedTelegramInitData = initData
  }

  return initData
}

function pollTelegramInitData(timeoutMs: number): Promise<string> {
  const initialInitData = getTelegramInitData()

  if (initialInitData) {
    return Promise.resolve(initialInitData)
  }

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const intervalId = window.setInterval(() => {
      const initData = getTelegramInitData()

      if (initData || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(intervalId)
        if (initData) {
          cachedTelegramInitData = initData
        }
        resolve(initData)
      }
    }, telegramInitDataPollIntervalMs)
  })
}

export function preloadTelegramInitData(timeoutMs = 5_000): Promise<string> {
  const initData = getTelegramInitData()

  if (initData) {
    return Promise.resolve(initData)
  }

  if (!telegramInitDataPreloadPromise) {
    telegramInitDataPreloadPromise = pollTelegramInitData(timeoutMs).finally(() => {
      telegramInitDataPreloadPromise = null
    })
  }

  return telegramInitDataPreloadPromise
}

export function waitForTelegramInitData(timeoutMs = 2_000): Promise<string> {
  const initData = getTelegramInitData()

  if (initData) {
    return Promise.resolve(initData)
  }

  return pollTelegramInitData(timeoutMs)
}
