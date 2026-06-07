import { Home, Languages, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { detectEntrySource } from '../../lib/source'
import { storeSettingsService, type StoreSettings } from '../../services/storeSettingsService'
import { resolveSupportedLanguage } from '../../types/language'

export function StoreLayout() {
  const { i18n, t } = useTranslation()
  const source = detectEntrySource()
  const language = resolveSupportedLanguage(i18n.language)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    let isMounted = true

    void storeSettingsService.getSettings().then((settings) => {
      if (isMounted) {
        setStoreSettings(settings)
      }
    }).catch(() => {
      if (isMounted) {
        setStoreSettings(null)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-shell store-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          {storeSettings?.storeTitle[language] || 'EastShop'}
        </Link>
        <nav className="nav-actions" aria-label={t('navigation.store')}>
          <span className="source-pill">{t(`source.${source}`)}</span>
          <Link className="icon-link" to="/" aria-label={t('navigation.home')}>
            <Home size={18} />
          </Link>
          <Link className="secondary-button store-orders-link" to="/orders">
            {t('myOrders.title')}
          </Link>
          <LanguageSwitcher icon={<Languages size={16} />} />
        </nav>
        <Link className="icon-link store-cart-link" to="/cart" aria-label={t('cart.title')}>
          <ShoppingCart size={18} />
        </Link>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
