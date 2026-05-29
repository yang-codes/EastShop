import { Languages, ShoppingCart } from 'lucide-react'
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
          <LanguageSwitcher icon={<Languages size={16} />} />
          <Link className="icon-link" to="/cart" aria-label={t('cart.title')}>
            <ShoppingCart size={18} />
          </Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
