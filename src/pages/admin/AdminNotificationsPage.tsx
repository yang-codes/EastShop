import { Bell, Save, Send } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { adminNotificationService, type NotificationSettings } from '../../services/adminNotificationService'
import { scrollAdminPageToTop } from '../../utils/adminScroll'

const emptySettings: NotificationSettings = {
  feishuEnabled: false,
  feishuSecret: '',
  feishuWebhook: '',
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const parts = ['message', 'details', 'hint', 'code']
      .map((key) => {
        const value = (error as Record<string, unknown>)[key]
        return typeof value === 'string' && value ? value : ''
      })
      .filter(Boolean)

    if (parts.length > 0) {
      return parts.join(' ')
    }
  }

  return error instanceof Error ? error.message : String(error)
}

export function AdminNotificationsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<NotificationSettings>(emptySettings)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setErrorMessage('')

      try {
        if (!isSupabaseConfigured()) {
          setSettings(emptySettings)
          return
        }

        const nextSettings = await adminNotificationService.getSettings()

        if (isMounted) {
          setSettings(nextSettings)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  function updateSettings<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(t('admin.supabaseNotConfigured'))
      }

      const savedSettings = await adminNotificationService.saveSettings(settings)
      setSettings(savedSettings)
      setStatusMessage(t('admin.notificationSaved'))
      scrollAdminPageToTop()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestSend() {
    setIsTesting(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await adminNotificationService.sendTest(settings)
      setStatusMessage(t('admin.notificationTestSent'))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader description={t('admin.notificationsDescription')} title={t('admin.notifications')} />

      {statusMessage ? <p className="auth-message success">{statusMessage}</p> : null}
      {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}

      <form className="form-card admin-edit-form notification-settings-form" onSubmit={(event) => void handleSave(event)}>
        <div className="section-title-row">
          <h2>{t('admin.feishuOrderNotifications')}</h2>
          <span className={`admin-product-status ${settings.feishuEnabled ? 'active' : 'inactive'}`}>
            <Bell size={14} />
            {settings.feishuEnabled ? t('admin.enabled') : t('admin.disabled')}
          </span>
        </div>
        <p>{t('admin.notificationsHelp')}</p>

        <label className="checkbox-label status-toggle-item notification-toggle">
          <span>{t('admin.enableFeishu')}</span>
          <input checked={settings.feishuEnabled} onChange={(event) => updateSettings('feishuEnabled', event.target.checked)} type="checkbox" />
        </label>

        <label>
          {t('admin.feishuWebhook')}
          <input
            onChange={(event) => updateSettings('feishuWebhook', event.target.value)}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            type="url"
            value={settings.feishuWebhook}
          />
        </label>

        <label>
          {t('admin.feishuSecret')}
          <input
            autoComplete="off"
            onChange={(event) => updateSettings('feishuSecret', event.target.value)}
            placeholder={t('admin.feishuSecretPlaceholder')}
            type="password"
            value={settings.feishuSecret}
          />
          <small className="field-hint">{t('admin.feishuSecretHint')}</small>
        </label>

        <div className="admin-action-row">
          <button className="primary-button" disabled={isSaving || isLoading} type="submit">
            <Save size={18} />
            {isSaving ? t('admin.saving') : t('common.save')}
          </button>
          <button className="secondary-button" disabled={isTesting || isLoading || !settings.feishuWebhook.trim()} onClick={() => void handleTestSend()} type="button">
            <Send size={18} />
            {isTesting ? t('admin.notificationTesting') : t('admin.notificationTest')}
          </button>
        </div>
      </form>
    </section>
  )
}
