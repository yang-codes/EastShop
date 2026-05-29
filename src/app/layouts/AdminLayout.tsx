import { Box, ClipboardList, FolderTree, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'

export function AdminLayout() {
  const { t } = useTranslation()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand">EastShop</div>
        <nav className="admin-nav" aria-label={t('navigation.admin')}>
          <NavLink to="/admin/products">
            <Box size={18} />
            {t('admin.products')}
          </NavLink>
          <NavLink to="/admin/orders">
            <ClipboardList size={18} />
            {t('admin.orders')}
          </NavLink>
          <NavLink to="/admin/categories">
            <FolderTree size={18} />
            {t('admin.categories')}
          </NavLink>
        </nav>
        <button className="ghost-button" type="button">
          <LogOut size={18} />
          {t('admin.logout')}
        </button>
      </aside>
      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">{t('admin.console')}</p>
            <h1>{t('admin.title')}</h1>
          </div>
          <LanguageSwitcher />
        </header>
        <Outlet />
      </section>
    </div>
  )
}
