import { Languages, Plus, Save } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  defaultPhonePrefixes,
  normalizePhonePrefixes,
  storeSettingsService,
  type PhonePrefixOption,
} from '../../services/storeSettingsService'
import { translationService } from '../../services/translationService'
import { scrollAdminPageToTop } from '../../utils/adminScroll'

function createPrefixDraft(sortOrder: number): PhonePrefixOption {
  return {
    id: `custom-${Date.now()}`,
    label: { zh: '', en: '', ru: '' },
    prefix: '+',
    isActive: true,
    sortOrder,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

export function AdminStoreSettingsPage() {
  const { t } = useTranslation()
  const prefixCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prefixNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [phonePrefixes, setPhonePrefixes] = useState<PhonePrefixOption[]>(defaultPhonePrefixes)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [autoFillingPrefixId, setAutoFillingPrefixId] = useState('')
  const [pendingScrollPrefixId, setPendingScrollPrefixId] = useState('')
  const isAutoFilling = Boolean(autoFillingPrefixId)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const settings = await storeSettingsService.getSettings()
        if (isMounted) {
          setPhonePrefixes(settings.phonePrefixes)
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

  useEffect(() => {
    if (!pendingScrollPrefixId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      prefixCardRefs.current[pendingScrollPrefixId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      prefixNameInputRefs.current[pendingScrollPrefixId]?.focus()
      setPendingScrollPrefixId('')
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [pendingScrollPrefixId, phonePrefixes])

  function updatePrefix(index: number, patch: Partial<PhonePrefixOption>) {
    setPhonePrefixes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function updatePrefixLabel(index: number, language: 'zh' | 'en' | 'ru', value: string) {
    setPhonePrefixes((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              label: {
                ...item.label,
                [language]: value,
              },
            }
          : item,
      ),
    )
  }

  function removePrefix(index: number) {
    setPhonePrefixes((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function addPrefix() {
    const draft = createPrefixDraft(phonePrefixes.length + 1)
    setPhonePrefixes((current) => [...current, draft])
    setPendingScrollPrefixId(draft.id)
  }

  async function handleAutoFillPhonePrefix(index: number) {
    const item = phonePrefixes[index]
    const sourceText = item?.label.zh.trim() ?? ''

    if (!item || !sourceText) {
      setErrorMessage(t('admin.storeSettingsAutoFillRequiresChinese'))
      setStatusMessage('')
      return
    }

    if (item.label.en.trim() && item.label.ru.trim()) {
      setStatusMessage(t('admin.storeSettingsAutoFillNothing'))
      setErrorMessage('')
      return
    }

    setAutoFillingPrefixId(item.id)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const translated = await translationService.translateFromChinese(sourceText)

      setPhonePrefixes((current) =>
        current.map((currentItem, itemIndex) =>
          itemIndex === index
            ? {
                ...currentItem,
                label: {
                  ...currentItem.label,
                  en: currentItem.label.en.trim() ? currentItem.label.en : translated.en,
                  ru: currentItem.label.ru.trim() ? currentItem.label.ru : translated.ru,
                },
              }
            : currentItem,
        ),
      )
      setStatusMessage(t('admin.storeSettingsAutoFillDone'))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setAutoFillingPrefixId('')
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const normalized = normalizePhonePrefixes(phonePrefixes).map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }))

      if (!isSupabaseConfigured()) {
        setPhonePrefixes(normalized)
        setStatusMessage(t('admin.savedLocally'))
        scrollAdminPageToTop()
        return
      }

      const saved = await storeSettingsService.saveSettings({ phonePrefixes: normalized })
      setPhonePrefixes(saved.phonePrefixes)
      setStatusMessage(t('admin.storeSettingsSaved'))
      scrollAdminPageToTop()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader description={t('admin.storeSettingsDescription')} title={t('admin.storeSettings')} />

      {statusMessage ? <p className="auth-message success">{statusMessage}</p> : null}
      {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}

      <form className="form-card admin-edit-form" onSubmit={(event) => void handleSave(event)}>
        <div className="section-title-row">
          <div>
            <h2>{t('admin.phonePrefixSettings')}</h2>
            <p>{t('admin.phonePrefixSettingsHelp')}</p>
          </div>
          <div className="section-actions">
            <button
              className="secondary-button"
              disabled={isLoading || isSaving || isAutoFilling}
              onClick={addPrefix}
              type="button"
            >
              <Plus size={18} />
              {t('admin.addPhonePrefix')}
            </button>
          </div>
        </div>

        <div className="phone-prefix-admin-list">
          {phonePrefixes.map((item, index) => (
            <div className="phone-prefix-admin-item" key={item.id} ref={(node) => { prefixCardRefs.current[item.id] = node }}>
              <div className="phone-prefix-admin-header">
                <div>
                  <strong>
                    {t('admin.phonePrefixItem')} {index + 1}
                  </strong>
                  <p>
                    {item.label.zh || item.label.en || item.label.ru || t('admin.unnamedPrefix')} · {item.prefix || '+'}
                  </p>
                </div>
                <div className="phone-prefix-admin-actions">
                  <button
                    className="secondary-button"
                    disabled={isLoading || isSaving || isAutoFilling}
                    onClick={() => void handleAutoFillPhonePrefix(index)}
                    type="button"
                  >
                    <Languages size={18} />
                    {autoFillingPrefixId === item.id ? t('admin.autoFillingTranslations') : t('admin.storeSettingsAutoFillOnePrefix')}
                  </button>
                  <button className="danger-button" disabled={isSaving || isAutoFilling} onClick={() => removePrefix(index)} type="button">
                    {t('admin.delete')}
                  </button>
                </div>
              </div>

              <div className="phone-prefix-fields phone-prefix-name-fields">
                <label>
                  {t('admin.nameZh')}
                  <input
                    onChange={(event) => updatePrefixLabel(index, 'zh', event.target.value)}
                    ref={(node) => { prefixNameInputRefs.current[item.id] = node }}
                    value={item.label.zh}
                  />
                </label>
                <label>
                  {t('admin.nameEn')}
                  <input onChange={(event) => updatePrefixLabel(index, 'en', event.target.value)} value={item.label.en} />
                </label>
                <label>
                  {t('admin.nameRu')}
                  <input onChange={(event) => updatePrefixLabel(index, 'ru', event.target.value)} value={item.label.ru} />
                </label>
              </div>

              <div className="phone-prefix-fields phone-prefix-meta-fields">
                <label>
                  {t('admin.phonePrefixCode')}
                  <input onChange={(event) => updatePrefix(index, { prefix: event.target.value })} placeholder="+86" value={item.prefix} />
                </label>
                <label>
                  {t('admin.sortOrder')}
                  <input
                    min="1"
                    onChange={(event) => updatePrefix(index, { sortOrder: Number(event.target.value) })}
                    type="number"
                    value={item.sortOrder}
                  />
                </label>
                <label className="checkbox-label status-toggle-item">
                  <span>{t('admin.enabled')}</span>
                  <input checked={item.isActive} onChange={(event) => updatePrefix(index, { isActive: event.target.checked })} type="checkbox" />
                </label>
                <label className="checkbox-label status-toggle-item">
                  <span>{t('admin.customPhonePrefixOption')}</span>
                  <input checked={Boolean(item.isCustom)} onChange={(event) => updatePrefix(index, { isCustom: event.target.checked })} type="checkbox" />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-action-row">
          <button className="primary-button" disabled={isSaving || isLoading || isAutoFilling} type="submit">
            <Save size={18} />
            {isSaving ? t('admin.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </section>
  )
}
