import type { EntrySource } from '../types/order'

export function detectEntrySource(): EntrySource {
  const params = new URLSearchParams(window.location.search)
  const source = params.get('source')

  if (source === 'instagram' || source === 'web' || source === 'telegram') {
    return source
  }

  if (window.Telegram?.WebApp) {
    return 'telegram'
  }

  return 'web'
}
