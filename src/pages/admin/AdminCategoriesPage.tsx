import { FolderPlus, Languages, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { adminProductService } from '../../services/adminProductService'
import { catalogService } from '../../services/catalogService'
import { translationService } from '../../services/translationService'
import { resolveSupportedLanguage } from '../../types/language'
import type { Category, Product } from '../../types/product'
import { scrollAdminPageToTop } from '../../utils/adminScroll'

type CategoryDraft = {
  id: string
  isActive: boolean
  nameEn: string
  nameRu: string
  nameUz: string
  nameZh: string
  sortOrder: string
}

function resolveLanguage(language: string) {
  return resolveSupportedLanguage(language)
}

function createCategoryId(seed: string) {
  void seed
  return crypto.randomUUID()
}

function createEmptyDraft(sortOrder: number): CategoryDraft {
  return {
    id: '',
    isActive: true,
    nameEn: '',
    nameRu: '',
    nameUz: '',
    nameZh: '',
    sortOrder: String(sortOrder),
  }
}

function categoryToDraft(category: Category): CategoryDraft {
  return {
    id: category.id,
    isActive: category.isActive,
    nameEn: category.name.en,
    nameRu: category.name.ru,
    nameUz: category.name.uz,
    nameZh: category.name.zh,
    sortOrder: String(category.sortOrder),
  }
}

function draftToCategory(draft: CategoryDraft): Category {
  const nameZh = draft.nameZh.trim()
  const nameEn = draft.nameEn.trim() || nameZh
  const nameRu = draft.nameRu.trim() || nameZh
  const nameUz = draft.nameUz.trim() || nameZh

  return {
    id: draft.id || createCategoryId(nameEn || nameZh || nameRu),
    isActive: draft.isActive,
    name: {
      en: nameEn,
      ru: nameRu,
      uz: nameUz,
      zh: nameZh,
    },
    sortOrder: Number(draft.sortOrder) || 0,
  }
}

export function AdminCategoriesPage() {
  const { i18n, t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [draft, setDraft] = useState<CategoryDraft>(() => createEmptyDraft(1))
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isAutoFilling, setIsAutoFilling] = useState(false)

  const language = resolveLanguage(i18n.language)

  async function loadCategories() {
    setErrorMessage('')

    try {
      const [nextCategories, nextProducts] = isSupabaseConfigured()
        ? await Promise.all([adminProductService.listCategories(), adminProductService.listProducts()])
        : await Promise.all([catalogService.listActiveCategories(), catalogService.listActiveProducts()])

      setCategories(nextCategories)
      setProducts(nextProducts)

      const nextSelectedId = selectedCategoryId || nextCategories[0]?.id || ''
      const nextCategory = nextCategories.find((category) => category.id === nextSelectedId)
      setSelectedCategoryId(nextSelectedId)
      setDraft(nextCategory ? categoryToDraft(nextCategory) : createEmptyDraft(nextCategories.length + 1))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadCategories())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryRows = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          productCount: products.filter((product) => product.categoryId === category.id).length,
        }))
        .filter(({ category }) => category.name[language].toLowerCase().includes(query.trim().toLowerCase())),
    [categories, language, products, query],
  )

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)

  function selectCategory(category: Category) {
    setSelectedCategoryId(category.id)
    setDraft(categoryToDraft(category))
    setStatusMessage('')
    setErrorMessage('')
  }

  function startNewCategory() {
    setSelectedCategoryId('')
    setDraft(createEmptyDraft(categories.length + 1))
    setStatusMessage('')
    setErrorMessage('')
  }

  function updateDraft<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function handleAutoFillCategoryName() {
    const sourceText = draft.nameZh.trim()

    if (!sourceText) {
      setErrorMessage(t('admin.categoryAutoFillRequiresChinese'))
      return
    }

    setIsAutoFilling(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const translated = await translationService.translateFromChinese(sourceText)

      setDraft((current) => ({
        ...current,
        nameEn: current.nameEn.trim() ? current.nameEn : translated.en,
        nameRu: current.nameRu.trim() ? current.nameRu : translated.ru,
        nameUz: current.nameUz.trim() ? current.nameUz : translated.uz,
      }))
      setStatusMessage(t('admin.categoryAutoFillDone'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsAutoFilling(false)
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const category = draftToCategory(draft)
    const isChangingActiveStatus = Boolean(selectedCategory && selectedCategory.isActive !== category.isActive)

    if (
      isChangingActiveStatus &&
      !window.confirm(t(category.isActive ? 'admin.categoryActivateConfirm' : 'admin.categoryDeactivateConfirm'))
    ) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const savedCategory = isSupabaseConfigured() ? await adminProductService.saveCategory(category) : category

      if (isChangingActiveStatus) {
        if (isSupabaseConfigured()) {
          await adminProductService.setProductsActiveByCategory(savedCategory.id, category.isActive)
        }

        setProducts((current) =>
          current.map((product) =>
            product.categoryId === savedCategory.id ? { ...product, isActive: category.isActive } : product,
          ),
        )
      }

      setCategories((current) => {
        const exists = current.some((item) => item.id === savedCategory.id)
        const nextCategories = exists
          ? current.map((item) => (item.id === savedCategory.id ? savedCategory : item))
          : [...current, savedCategory]

        return nextCategories.sort((left, right) => left.sortOrder - right.sortOrder)
      })
      setSelectedCategoryId(savedCategory.id)
      setDraft(categoryToDraft(savedCategory))
      setStatusMessage(
        isChangingActiveStatus
          ? t(category.isActive ? 'admin.categoryActivateSynced' : 'admin.categoryDeactivateSynced')
          : isSupabaseConfigured()
            ? t('admin.saved')
            : t('admin.savedLocally'),
      )
      scrollAdminPageToTop()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedCategory) {
      return
    }

    if (!window.confirm(t('admin.categoryDeleteConfirm'))) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')

    try {
      if (isSupabaseConfigured()) {
        await adminProductService.deactivateAndUnassignProductsByCategory(selectedCategory.id)
        await adminProductService.deleteCategory(selectedCategory.id)
      }

      setCategories((current) => current.filter((category) => category.id !== selectedCategory.id))
      setProducts((current) =>
        current.map((product) =>
          product.categoryId === selectedCategory.id ? { ...product, categoryId: '', isActive: false } : product,
        ),
      )
      const nextCategory = categories.find((category) => category.id !== selectedCategory.id)
      setSelectedCategoryId(nextCategory?.id ?? '')
      setDraft(nextCategory ? categoryToDraft(nextCategory) : createEmptyDraft(1))
      setStatusMessage(isSupabaseConfigured() ? t('admin.categoryDeleteSynced') : t('admin.deletedLocally'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" onClick={startNewCategory} type="button">
            <FolderPlus size={18} />
            {t('admin.addCategory')}
          </button>
        }
        description={t('admin.categoriesDescription')}
        title={t('admin.categories')}
      />

      <div className="admin-toolbar admin-categories-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder={t('common.search')} type="search" />
        </label>
      </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-management-grid category-management-grid">
        <div className="admin-list-panel">
          {categoryRows.map(({ category, productCount }) => (
            <button
              className={`admin-list-item category-list-item ${category.id === selectedCategoryId ? 'selected' : ''}`}
              key={category.id}
              onClick={() => selectCategory(category)}
              type="button"
            >
              <span>
                <strong>{category.name[language]}</strong>
                <small>
                  {productCount} {t('admin.products')}
                </small>
              </span>
              <span className={`status-pill ${category.isActive ? 'success' : 'muted'}`}>
                {category.isActive ? t('admin.activeProducts') : t('admin.inactiveProducts')}
              </span>
            </button>
          ))}
        </div>

        <form className="form-card admin-edit-form category-edit-form" onSubmit={handleSave}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{t('admin.categoryEditor')}</p>
              <h2>{selectedCategory ? selectedCategory.name[language] : t('admin.newCategory')}</h2>
            </div>
            <div className="editor-title-actions">
              <button className="secondary-button" disabled={isAutoFilling || isSaving} onClick={() => void handleAutoFillCategoryName()} type="button">
                <Languages size={18} />
                {isAutoFilling ? t('admin.autoFillingTranslations') : t('admin.categoryAutoFillName')}
              </button>
              <span className={`status-pill ${draft.isActive ? 'success' : 'muted'}`}>
                {draft.isActive ? t('admin.visibleInStore') : t('admin.inactive')}
              </span>
            </div>
          </div>
          <p className="field-hint">{t('admin.categoryAutoFillHint')}</p>
          <div className="form-grid language-columns">
            <label>
              {t('admin.nameZh')}
              <input onChange={(event) => updateDraft('nameZh', event.target.value)} required value={draft.nameZh} />
            </label>
            <label>
              {t('admin.nameEn')}
              <input onChange={(event) => updateDraft('nameEn', event.target.value)} value={draft.nameEn} />
            </label>
            <label>
              {t('admin.nameRu')}
              <input onChange={(event) => updateDraft('nameRu', event.target.value)} value={draft.nameRu} />
            </label>
            <label>
              {t('admin.nameUz')}
              <input onChange={(event) => updateDraft('nameUz', event.target.value)} value={draft.nameUz} />
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              {t('admin.sortOrder')}
              <input onChange={(event) => updateDraft('sortOrder', event.target.value)} type="number" value={draft.sortOrder} />
            </label>
            <label className="checkbox-label">
              <input checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} type="checkbox" />
              {t('admin.visibleInStore')}
            </label>
          </div>
          <div className="admin-action-row">
            <button className="danger-button" disabled={!selectedCategory} onClick={() => void handleDelete()} type="button">
              <Trash2 size={18} />
              {t('admin.delete')}
            </button>
            <button className="primary-button" disabled={isSaving} type="submit">
              <Save size={18} />
              {isSaving ? t('admin.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
