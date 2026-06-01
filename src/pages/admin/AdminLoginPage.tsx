import { Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { authService } from '../../services/authService'

function getRouteErrorMessage(state: unknown) {
  if (!state || typeof state !== 'object' || !('error' in state)) {
    return ''
  }

  const error = (state as { error?: unknown }).error

  return typeof error === 'string' ? error : ''
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : ''
  }

  return typeof error === 'string' ? error : ''
}

export function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState(() => getRouteErrorMessage(location.state))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAlreadyAdmin, setIsAlreadyAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkExistingSession() {
      if (!isSupabaseConfigured()) {
        setIsCheckingSession(false)
        return
      }

      try {
        const admin = await authService.getCurrentAdmin()

        if (isMounted) {
          setIsAlreadyAdmin(Boolean(admin))
        }
      } catch {
        if (isMounted) {
          setIsAlreadyAdmin(false)
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    void checkExistingSession()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!isSupabaseConfigured()) {
      setErrorMessage(t('admin.supabaseNotConfigured'))
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await authService.signIn(email, password)

      if (error) {
        setErrorMessage(error.message)
        return
      }

      const admin = await authService.getCurrentAdmin()

      if (!admin) {
        await authService.signOut()
        setErrorMessage(t('admin.notAuthorized'))
        return
      }

      const redirectTo =
        typeof location.state === 'object' && location.state && 'from' in location.state
          ? String(location.state.from)
          : '/admin/products'

      navigate(redirectTo, { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error) || t('admin.loginFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCheckingSession) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (isAlreadyAdmin) {
    return <Navigate replace to="/admin/products" />
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-header">
          <div className="icon-badge">
            <Lock size={22} />
          </div>
          <LanguageSwitcher />
        </div>
        <h1>{t('admin.login')}</h1>
        {!isSupabaseConfigured() ? <p className="auth-message error">{t('admin.supabaseNotConfigured')}</p> : null}
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}
        <button className="primary-button" disabled={isSubmitting || !isSupabaseConfigured()} type="submit">
          {isSubmitting ? t('admin.signingIn') : t('admin.login')}
        </button>
      </form>
    </main>
  )
}
