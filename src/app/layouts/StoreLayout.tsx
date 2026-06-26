import { Home, Languages, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { detectEntrySource } from '../../lib/source'
import { cartService } from '../../services/cartService'
import { storeSettingsService, type StoreSettings } from '../../services/storeSettingsService'
import { resolveSupportedLanguage } from '../../types/language'

export function StoreLayout() {
  const { i18n, t } = useTranslation()
  const source = detectEntrySource()
  const language = resolveSupportedLanguage(i18n.language)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)
  const [cartCount, setCartCount] = useState(() =>
    cartService.getCart().reduce((sum, line) => sum + line.quantity, 0)
  )

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

  useEffect(() => {
    function syncCart() {
      const count = cartService.getCart().reduce((sum, line) => sum + line.quantity, 0)
      setCartCount(count)
    }

    window.addEventListener('cart-updated', syncCart)
    window.addEventListener('storage', syncCart)
    return () => {
      window.removeEventListener('cart-updated', syncCart)
      window.removeEventListener('storage', syncCart)
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
          {cartCount > 0 ? (
            <span className="cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
          ) : null}
        </Link>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

