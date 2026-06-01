import type { EntrySource } from '../types/order'

export function detectEntrySource(): EntrySource {
  const params = new URLSearchParams(window.location.search)
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
  const hashParams = new URLSearchParams(hashQuery)
  const source = params.get('source') ?? hashParams.get('source')

  if (source === 'instagram' || source === 'web' || source === 'telegram') {
    return source
  }

  if (window.Telegram?.WebApp) {
    return 'telegram'
  }

  return 'web'
}
