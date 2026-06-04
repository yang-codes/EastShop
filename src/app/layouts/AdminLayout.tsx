import { Bell, BookOpen, Box, ClipboardList, FolderTree, LogOut, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { authService } from '../../services/authService'
import type { AdminProfile } from '../../types/admin'

export function AdminLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<AdminProfile | null>(null)
  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'unauthorized'>('checking')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadAdmin() {
      if (!isSupabaseConfigured()) {
        setAdmin({
          displayName: 'Mock Admin',
          email: 'mock-admin@eastshop.local',
          isActive: true,
          role: 'admin',
          userId: 'mock-admin',
        })
        setAuthState('authorized')
        return
      }

      try {
        const currentAdmin = await authService.getCurrentAdmin()

        if (!isMounted) {
          return
        }

        setAdmin(currentAdmin)
        setAuthState(currentAdmin ? 'authorized' : 'unauthorized')
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : String(error))
          setAuthState('unauthorized')
        }
      }
    }

    void loadAdmin()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleLogout() {
    try {
      await authService.signOut()
    } finally {
      navigate('/admin/login', { replace: true })
    }
  }

  if (authState === 'checking') {
    return (
      <main className="login-screen">
        <div className="login-card">
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (authState === 'unauthorized') {
    return <Navigate replace state={{ error: errorMessage, from: location.pathname }} to="/admin/login" />
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand">EastShop</div>
        {admin ? (
          <div className="admin-profile">
            <strong>{admin.displayName || admin.email}</strong>
            <span>{admin.email}</span>
          </div>
        ) : null}
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
          <NavLink to="/admin/store-settings">
            <Settings size={18} />
            {t('admin.storeSettings')}
          </NavLink>
          <NavLink to="/admin/notifications">
            <Bell size={18} />
            {t('admin.notifications')}
          </NavLink>
          <NavLink to="/admin/api-docs">
            <BookOpen size={18} />
            {t('admin.apiDocs')}
          </NavLink>
        </nav>
        <button className="ghost-button" onClick={() => void handleLogout()} type="button">
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
