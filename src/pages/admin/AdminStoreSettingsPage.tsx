import { Languages, Plus, Save } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  defaultPhonePrefixes,
  defaultSocialPlatforms,
  normalizePhonePrefixes,
  normalizeSocialPlatforms,
  storeSettingsService,
  type PhonePrefixOption,
  type SocialPlatformOption,
} from '../../services/storeSettingsService'
import { translationService } from '../../services/translationService'
import { createLocalizedText, type LocalizedText, type SupportedLanguage } from '../../types/language'
import { scrollAdminPageToTop } from '../../utils/adminScroll'

function createPrefixDraft(sortOrder: number): PhonePrefixOption {
  return {
    id: `custom-${Date.now()}`,
    label: { zh: '', en: '', ru: '', uz: '' },
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

function createSocialPlatformDraft(sortOrder: number): SocialPlatformOption {
  const timestamp = Date.now()
  return {
    code: `platform-${timestamp}`,
    id: `platform-${timestamp}`,
    isActive: true,
    label: { zh: '', en: '', ru: '', uz: '' },
    sortOrder,
  }
}

function normalizePlatformCodeInput(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export function AdminStoreSettingsPage() {
  const { t } = useTranslation()
  const [storeTitle, setStoreTitle] = useState<LocalizedText>(createLocalizedText({ zh: 'EastShop' }))
  const [storeDescription, setStoreDescription] = useState<LocalizedText>(createLocalizedText({
    zh: '面向中亚市场的多语言商品商城。',
    en: 'A multilingual product store for Central Asia.',
    ru: 'Многоязычный каталог товаров для Центральной Азии.',
    uz: 'Markaziy Osiyo uchun ko‘p tilli mahsulotlar do‘koni.',
  }))
  const prefixCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prefixNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const platformCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const platformNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [phonePrefixes, setPhonePrefixes] = useState<PhonePrefixOption[]>(defaultPhonePrefixes)
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatformOption[]>(defaultSocialPlatforms)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [autoFillingStoreField, setAutoFillingStoreField] = useState<'title' | 'description' | ''>('')
  const [autoFillingPrefixId, setAutoFillingPrefixId] = useState('')
  const [autoFillingPlatformId, setAutoFillingPlatformId] = useState('')
  const [pendingScrollPrefixId, setPendingScrollPrefixId] = useState('')
  const [pendingScrollPlatformId, setPendingScrollPlatformId] = useState('')
  const isAutoFilling = Boolean(autoFillingStoreField || autoFillingPrefixId || autoFillingPlatformId)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const settings = await storeSettingsService.getSettings()
        if (isMounted) {
          setStoreTitle(settings.storeTitle)
          setStoreDescription(settings.storeDescription)
          setPhonePrefixes(settings.phonePrefixes)
          setSocialPlatforms(settings.socialPlatforms)
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

  useEffect(() => {
    if (!pendingScrollPlatformId) {
      return
    }

    const timer = window.setTimeout(() => {
      platformCardRefs.current[pendingScrollPlatformId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      platformNameInputRefs.current[pendingScrollPlatformId]?.focus()
      setPendingScrollPlatformId('')
    }, 50)

    return () => window.clearTimeout(timer)
  }, [pendingScrollPlatformId, socialPlatforms])

  function updatePrefix(index: number, patch: Partial<PhonePrefixOption>) {
    setPhonePrefixes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function updatePrefixLabel(index: number, language: SupportedLanguage, value: string) {
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

    if (item.label.en.trim() && item.label.ru.trim() && item.label.uz.trim()) {
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
                  uz: currentItem.label.uz.trim() ? currentItem.label.uz : translated.uz,
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

  function updatePlatform(index: number, patch: Partial<SocialPlatformOption>) {
    setSocialPlatforms((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function updatePlatformLabel(index: number, language: SupportedLanguage, value: string) {
    setSocialPlatforms((items) => items.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, label: { ...item.label, [language]: value } }
        : item
    )))
  }

  function updateStoreText(field: 'title' | 'description', language: SupportedLanguage, value: string) {
    const update = (current: LocalizedText) => ({ ...current, [language]: value })
    if (field === 'title') {
      setStoreTitle(update)
      return
    }

    setStoreDescription(update)
  }

  async function handleAutoFillStoreField(field: 'title' | 'description') {
    const current = field === 'title' ? storeTitle : storeDescription
    const sourceText = current.zh.trim()

    if (!sourceText) {
      setErrorMessage(t('admin.storeFrontAutoFillRequiresChinese'))
      return
    }

    if (current.en.trim() && current.ru.trim() && current.uz.trim()) {
      setStatusMessage(t('admin.storeFrontAutoFillNothing'))
      return
    }

    setAutoFillingStoreField(field)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const translated = await translationService.translateFromChinese(sourceText)
      const next = createLocalizedText({
        zh: sourceText,
        en: current.en.trim() || translated.en,
        ru: current.ru.trim() || translated.ru,
        uz: current.uz.trim() || translated.uz,
      })

      if (field === 'title') {
        setStoreTitle(next)
      } else {
        setStoreDescription(next)
      }

      setStatusMessage(t('admin.storeFrontAutoFillDone'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.translationFailed'))
    } finally {
      setAutoFillingStoreField('')
    }
  }

  function addPlatform() {
    const draft = createSocialPlatformDraft(socialPlatforms.length + 1)
    setSocialPlatforms((items) => [...items, draft])
    setPendingScrollPlatformId(draft.id)
    setStatusMessage('')
    setErrorMessage('')
  }

  function removePlatform(index: number) {
    setSocialPlatforms((items) => items.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleAutoFillSocialPlatform(index: number) {
    const item = socialPlatforms[index]
    const sourceText = item?.label.zh.trim()

    if (!item || !sourceText) {
      setErrorMessage(t('admin.storeSettingsAutoFillRequiresChinese'))
      setStatusMessage('')
      return
    }

    if (item.label.en.trim() && item.label.ru.trim() && item.label.uz.trim()) {
      setStatusMessage(t('admin.storeSettingsAutoFillNothing'))
      setErrorMessage('')
      return
    }

    setAutoFillingPlatformId(item.id)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const result = await translationService.translateFromChinese(sourceText)
      setSocialPlatforms((items) => items.map((current, itemIndex) => {
        if (itemIndex !== index) {
          return current
        }

        return {
          ...current,
          label: {
            ...current.label,
            en: current.label.en.trim() ? current.label.en : result.en,
            ru: current.label.ru.trim() ? current.label.ru : result.ru,
            uz: current.label.uz.trim() ? current.label.uz : result.uz,
          },
        }
      }))
      setStatusMessage(t('admin.storeSettingsAutoFillPlatformDone'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.translationFailed'))
    } finally {
      setAutoFillingPlatformId('')
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
      const normalizedSocialPlatforms = normalizeSocialPlatforms(socialPlatforms).map((item, index) => ({
        ...item,
        code: normalizePlatformCodeInput(item.code) || item.id,
        sortOrder: index + 1,
      }))

      if (!isSupabaseConfigured()) {
        setStoreTitle(storeTitle)
        setStoreDescription(storeDescription)
        setPhonePrefixes(normalized)
        setSocialPlatforms(normalizedSocialPlatforms)
        setStatusMessage(t('admin.savedLocally'))
        scrollAdminPageToTop()
        return
      }

      const saved = await storeSettingsService.saveSettings({
        storeDescription,
        storeTitle,
        phonePrefixes: normalized,
        socialPlatforms: normalizedSocialPlatforms,
      })
      setStoreTitle(saved.storeTitle)
      setStoreDescription(saved.storeDescription)
      setPhonePrefixes(saved.phonePrefixes)
      setSocialPlatforms(saved.socialPlatforms)
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
            <h2>{t('admin.storeFrontSettings')}</h2>
            <p>{t('admin.storeFrontSettingsHelp')}</p>
          </div>
        </div>

        <div className="form-grid">
          <label>
            {t('admin.storeTitleZh')}
            <input onChange={(event) => updateStoreText('title', 'zh', event.target.value)} value={storeTitle.zh} />
          </label>
          <label>
            {t('admin.storeTitleEn')}
            <input onChange={(event) => updateStoreText('title', 'en', event.target.value)} value={storeTitle.en} />
          </label>
          <label>
            {t('admin.storeTitleRu')}
            <input onChange={(event) => updateStoreText('title', 'ru', event.target.value)} value={storeTitle.ru} />
          </label>
          <label>
            {t('admin.storeTitleUz')}
            <input onChange={(event) => updateStoreText('title', 'uz', event.target.value)} value={storeTitle.uz} />
          </label>
        </div>

        <div className="section-actions">
          <button
            className="secondary-button"
            disabled={isLoading || isSaving || isAutoFilling}
            onClick={() => void handleAutoFillStoreField('title')}
            type="button"
          >
            <Languages size={18} />
            {autoFillingStoreField === 'title' ? t('admin.autoFillingTranslations') : t('admin.storeFrontAutoFillTitle')}
          </button>
        </div>

        <div className="form-grid">
          <label>
            {t('admin.storeDescriptionZh')}
            <textarea onChange={(event) => updateStoreText('description', 'zh', event.target.value)} rows={3} value={storeDescription.zh} />
          </label>
          <label>
            {t('admin.storeDescriptionEn')}
            <textarea onChange={(event) => updateStoreText('description', 'en', event.target.value)} rows={3} value={storeDescription.en} />
          </label>
          <label>
            {t('admin.storeDescriptionRu')}
            <textarea onChange={(event) => updateStoreText('description', 'ru', event.target.value)} rows={3} value={storeDescription.ru} />
          </label>
          <label>
            {t('admin.storeDescriptionUz')}
            <textarea onChange={(event) => updateStoreText('description', 'uz', event.target.value)} rows={3} value={storeDescription.uz} />
          </label>
        </div>

        <div className="section-actions">
          <button
            className="secondary-button"
            disabled={isLoading || isSaving || isAutoFilling}
            onClick={() => void handleAutoFillStoreField('description')}
            type="button"
          >
            <Languages size={18} />
            {autoFillingStoreField === 'description' ? t('admin.autoFillingTranslations') : t('admin.storeFrontAutoFillDescription')}
          </button>
        </div>

        <div className="store-settings-divider" />

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
                    {item.label.zh || item.label.en || item.label.ru || item.label.uz || t('admin.unnamedPrefix')} · {item.prefix || '+'}
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
                <label>
                  {t('admin.nameUz')}
                  <input onChange={(event) => updatePrefixLabel(index, 'uz', event.target.value)} value={item.label.uz} />
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

        <div className="store-settings-divider" />

        <div className="section-title-row">
          <div>
            <h2>{t('admin.socialPlatformSettings')}</h2>
            <p>{t('admin.socialPlatformSettingsHelp')}</p>
          </div>
          <div className="section-actions">
            <button
              className="secondary-button"
              disabled={isLoading || isSaving || isAutoFilling}
              onClick={addPlatform}
              type="button"
            >
              <Plus size={18} />
              {t('admin.addSocialPlatform')}
            </button>
          </div>
        </div>

        <div className="phone-prefix-admin-list">
          {socialPlatforms.map((item, index) => (
            <div className="phone-prefix-admin-item" key={item.id} ref={(node) => { platformCardRefs.current[item.id] = node }}>
              <div className="phone-prefix-admin-header">
                <div>
                  <strong>
                    {t('admin.socialPlatformItem')} {index + 1}
                  </strong>
                  <p>
                    {item.label.zh || item.label.en || item.label.ru || item.label.uz || t('admin.unnamedSocialPlatform')}
                    {item.code ? ` · ${item.code}` : ''}
                  </p>
                </div>
                <div className="section-actions">
                  <button
                    className="secondary-button"
                    disabled={isAutoFilling}
                    onClick={() => void handleAutoFillSocialPlatform(index)}
                    type="button"
                  >
                    <Languages size={16} />
                    {autoFillingPlatformId === item.id ? t('admin.autoFillingTranslations') : t('admin.storeSettingsAutoFillOneSocialPlatform')}
                  </button>
                  <button className="danger-button" onClick={() => removePlatform(index)} type="button">
                    {t('admin.delete')}
                  </button>
                </div>
              </div>

              <div className="phone-prefix-fields phone-prefix-name-fields">
                <label>
                  {t('admin.nameZh')}
                  <input
                    onChange={(event) => updatePlatformLabel(index, 'zh', event.target.value)}
                    ref={(node) => { platformNameInputRefs.current[item.id] = node }}
                    value={item.label.zh}
                  />
                </label>
                <label>
                  {t('admin.nameEn')}
                  <input onChange={(event) => updatePlatformLabel(index, 'en', event.target.value)} value={item.label.en} />
                </label>
                <label>
                  {t('admin.nameRu')}
                  <input onChange={(event) => updatePlatformLabel(index, 'ru', event.target.value)} value={item.label.ru} />
                </label>
                <label>
                  {t('admin.nameUz')}
                  <input onChange={(event) => updatePlatformLabel(index, 'uz', event.target.value)} value={item.label.uz} />
                </label>
              </div>

              <div className="phone-prefix-fields phone-prefix-meta-fields">
                <label>
                  {t('admin.socialPlatformCode')}
                  <input onChange={(event) => updatePlatform(index, { code: normalizePlatformCodeInput(event.target.value) })} value={item.code} />
                </label>
                <label>
                  {t('admin.sortOrder')}
                  <input min="1" onChange={(event) => updatePlatform(index, { sortOrder: Number(event.target.value) })} type="number" value={item.sortOrder} />
                </label>
                <label className="checkbox-card">
                  <span>{t('admin.enabled')}</span>
                  <input
                    checked={item.isActive}
                    onChange={(event) => updatePlatform(index, { isActive: event.target.checked })}
                    type="checkbox"
                  />
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
