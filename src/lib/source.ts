import type { EntrySource } from '../types/order'

const entrySourceStorageKey = 'eastshop.entrySource'

function normalizeEntrySource(source: string | null): EntrySource | null {
  if (source === 'instagram' || source === 'web' || source === 'telegram') {
    return source
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

function isInstagramRuntime() {
  const userAgent = window.navigator.userAgent
  const vendor = window.navigator.vendor
  const referrer = document.referrer

  return /Instagram/i.test(userAgent)
    || /Instagram/i.test(vendor)
    || /(^https?:\/\/)?([^/]+\.)?instagram\.com/i.test(referrer)
}

export function detectEntrySource(): EntrySource {
  const urlSource = getUrlEntrySource()

  if (urlSource) {
    rememberEntrySource(urlSource)
    return urlSource
  }

  if (window.Telegram?.WebApp) {
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

  return 'web'
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData?.trim() ?? ''
}
