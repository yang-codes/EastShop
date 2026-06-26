import type { EntrySource } from '../types/order'

const entrySourceStorageKey = 'eastshop.entrySource'
const webHostnames = new Set(['localhost', '127.0.0.1', 'www.yangshop.online', 'yangshop.online'])

function normalizeEntrySource(source: string | null): EntrySource | null {
  const normalizedSource = source?.trim().toLowerCase()

  if (normalizedSource === 'tel' || normalizedSource === 'tg') {
    return 'telegram'
  }

  if (normalizedSource === 'instagram' || normalizedSource === 'web' || normalizedSource === 'telegram') {
    return normalizedSource
  }

  return null
}

function getHashQuery() {
  return window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
}

function getUrlEntrySource(): EntrySource | null {
  const params = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(getHashQuery())

  return normalizeEntrySource(params.get('source') ?? hashParams.get('source'))
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

  return Boolean(webApp?.initData?.trim() || webApp?.initDataUnsafe?.user || webApp)
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

  if (isKnownWebHost()) {
    rememberEntrySource('web')
    return 'web'
  }

  const rememberedSource = getRememberedEntrySource()

  if (rememberedSource) {
    return rememberedSource
  }

  return 'web'
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData?.trim() ?? ''
}
