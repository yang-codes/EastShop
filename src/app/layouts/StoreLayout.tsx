import { Home, Languages, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { detectEntrySource } from '../../lib/source'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'

export function StoreLayout() {
  const { t } = useTranslation()
  const source = detectEntrySource()

  return (
    <div className="app-shell store-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          EastShop
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
