import { useEffect } from 'react'
import './i18n/setup'
import { AppRouter } from './app/AppRouter'

export default function App() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp

    if (!webApp) {
      return
    }

    try {
      webApp.ready?.()
      webApp.expand?.()
    } catch {
      // Telegram WebView APIs can vary by client version; storefront still works without them.
    }
  }, [])

  return <AppRouter />
}
