import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'

export function AdminLoginPage() {
  const { t } = useTranslation()

  return (
    <main className="login-screen">
      <form className="login-card">
        <div className="login-card-header">
          <div className="icon-badge">
            <Lock size={22} />
          </div>
          <LanguageSwitcher />
        </div>
        <h1>{t('admin.login')}</h1>
        <label>
          Email
          <input type="email" />
        </label>
        <label>
          Password
          <input type="password" />
        </label>
        <button className="primary-button" type="submit">
          {t('admin.login')}
        </button>
      </form>
    </main>
  )
}
