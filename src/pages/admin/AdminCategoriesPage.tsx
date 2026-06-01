import { FolderPlus, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { adminProductService } from '../../services/adminProductService'
import { catalogService } from '../../services/catalogService'
import type { Category, Product } from '../../types/product'

type CategoryDraft = {
  id: string
  isActive: boolean
  nameEn: string
  nameRu: string
  nameZh: string
  sortOrder: string
}

function resolveLanguage(language: string) {
  if (language.startsWith('zh')) {
    return 'zh'
  }

  if (language.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
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
    nameZh: category.name.zh,
    sortOrder: String(category.sortOrder),
  }
}

function draftToCategory(draft: CategoryDraft): Category {
  return {
    id: draft.id || createCategoryId(draft.nameEn || draft.nameZh || draft.nameRu),
    isActive: draft.isActive,
    name: {
      en: draft.nameEn,
      ru: draft.nameRu,
      zh: draft.nameZh,
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    const category = draftToCategory(draft)

    try {
      const savedCategory = isSupabaseConfigured() ? await adminProductService.saveCategory(category) : category

      setCategories((current) => {
        const exists = current.some((item) => item.id === savedCategory.id)
        const nextCategories = exists
          ? current.map((item) => (item.id === savedCategory.id ? savedCategory : item))
          : [...current, savedCategory]

        return nextCategories.sort((left, right) => left.sortOrder - right.sortOrder)
      })
      setSelectedCategoryId(savedCategory.id)
      setDraft(categoryToDraft(savedCategory))
      setStatusMessage(isSupabaseConfigured() ? t('admin.saved') : t('admin.savedLocally'))
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

    setErrorMessage('')
    setStatusMessage('')

    try {
      if (isSupabaseConfigured()) {
        await adminProductService.deleteCategory(selectedCategory.id)
      }

      setCategories((current) => current.filter((category) => category.id !== selectedCategory.id))
      const nextCategory = categories.find((category) => category.id !== selectedCategory.id)
      setSelectedCategoryId(nextCategory?.id ?? '')
      setDraft(nextCategory ? categoryToDraft(nextCategory) : createEmptyDraft(1))
      setStatusMessage(isSupabaseConfigured() ? t('admin.deleted') : t('admin.deletedLocally'))
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

      <div className="admin-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder={t('common.search')} type="search" />
        </label>
      </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-management-grid">
        <div className="admin-list-panel">
          {categoryRows.map(({ category, productCount }) => (
            <button
              className={`admin-list-item ${category.id === selectedCategoryId ? 'selected' : ''}`}
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
                {category.isActive ? t('admin.active') : t('admin.inactive')}
              </span>
            </button>
          ))}
        </div>

        <form className="form-card admin-edit-form" onSubmit={handleSave}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{t('admin.categoryEditor')}</p>
              <h2>{selectedCategory ? selectedCategory.name[language] : t('admin.newCategory')}</h2>
            </div>
            <span className={`status-pill ${draft.isActive ? 'success' : 'muted'}`}>
              {draft.isActive ? t('admin.visibleInStore') : t('admin.inactive')}
            </span>
          </div>
          <div className="form-grid language-columns">
            <label>
              {t('admin.nameZh')}
              <input onChange={(event) => updateDraft('nameZh', event.target.value)} required value={draft.nameZh} />
            </label>
            <label>
              {t('admin.nameEn')}
              <input onChange={(event) => updateDraft('nameEn', event.target.value)} required value={draft.nameEn} />
            </label>
            <label>
              {t('admin.nameRu')}
              <input onChange={(event) => updateDraft('nameRu', event.target.value)} required value={draft.nameRu} />
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
