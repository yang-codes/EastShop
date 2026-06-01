import { ImagePlus, Plus, Save, Search, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { adminProductService } from '../../services/adminProductService'
import { catalogService } from '../../services/catalogService'
import type { Category, Product } from '../../types/product'

type ProductDraft = {
  categoryId: string
  coverImage: string
  descriptionEn: string
  descriptionRu: string
  descriptionZh: string
  detailEn: string
  detailRu: string
  detailZh: string
  id: string
  imagesText: string
  isActive: boolean
  isFeatured: boolean
  nameEn: string
  nameRu: string
  nameZh: string
  price: string
  sortOrder: string
  tagsText: string
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

function createId(seed: string) {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'product'}-${Date.now()}`
}

function createEmptyDraft(sortOrder: number): ProductDraft {
  return {
    categoryId: '',
    coverImage: '',
    descriptionEn: '',
    descriptionRu: '',
    descriptionZh: '',
    detailEn: '',
    detailRu: '',
    detailZh: '',
    id: '',
    imagesText: '',
    isActive: true,
    isFeatured: false,
    nameEn: '',
    nameRu: '',
    nameZh: '',
    price: '0',
    sortOrder: String(sortOrder),
    tagsText: '',
  }
}

function productToDraft(product: Product): ProductDraft {
  return {
    categoryId: product.categoryId,
    coverImage: product.coverImage ?? '',
    descriptionEn: product.description.en,
    descriptionRu: product.description.ru,
    descriptionZh: product.description.zh,
    detailEn: product.detail.en,
    detailRu: product.detail.ru,
    detailZh: product.detail.zh,
    id: product.id,
    imagesText: product.images.join('\n'),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    nameEn: product.name.en,
    nameRu: product.name.ru,
    nameZh: product.name.zh,
    price: String(product.price),
    sortOrder: String(product.sortOrder),
    tagsText: product.tags.join(', '),
  }
}

function draftToProduct(draft: ProductDraft, fallbackProduct?: Product): Product {
  const id = draft.id || createId(draft.nameEn || draft.nameZh || draft.nameRu)
  const images = draft.imagesText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
  const coverImage = draft.coverImage.trim() || images[0]

  return {
    categoryId: draft.categoryId,
    coverImage,
    description: {
      en: draft.descriptionEn,
      ru: draft.descriptionRu,
      zh: draft.descriptionZh,
    },
    detail: {
      en: draft.detailEn,
      ru: draft.detailRu,
      zh: draft.detailZh,
    },
    id,
    images: images.length > 0 ? images : coverImage ? [coverImage] : [],
    isActive: draft.isActive,
    isFeatured: draft.isFeatured,
    name: {
      en: draft.nameEn,
      ru: draft.nameRu,
      zh: draft.nameZh,
    },
    price: Number(draft.price) || 0,
    sortOrder: Number(draft.sortOrder) || 0,
    specs: fallbackProduct?.specs ?? [],
    tags: draft.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

export function AdminProductsPage() {
  const { i18n, t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [draft, setDraft] = useState<ProductDraft>(() => createEmptyDraft(1))
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const language = resolveLanguage(i18n.language)

  async function loadAdminCatalog() {
    setErrorMessage('')

    try {
      const [nextProducts, nextCategories] = isSupabaseConfigured()
        ? await Promise.all([adminProductService.listProducts(), adminProductService.listCategories()])
        : await Promise.all([catalogService.listActiveProducts(), catalogService.listActiveCategories()])

      setProducts(nextProducts)
      setCategories(nextCategories)

      const nextSelectedId = selectedProductId || nextProducts[0]?.id || ''
      setSelectedProductId(nextSelectedId)
      setDraft(nextProducts.find((product) => product.id === nextSelectedId) ? productToDraft(nextProducts.find((product) => product.id === nextSelectedId) as Product) : createEmptyDraft(nextProducts.length + 1))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadAdminCatalog())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name[language]])),
    [categories, language],
  )

  const filteredProducts = products.filter((product) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery =
      !normalizedQuery ||
      product.name[language].toLowerCase().includes(normalizedQuery) ||
      product.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    const matchesCategory = categoryId === 'all' || product.categoryId === categoryId

    return matchesQuery && matchesCategory
  })

  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const activeCount = products.filter((product) => product.isActive).length
  const featuredCount = products.filter((product) => product.isFeatured).length

  function selectProduct(product: Product) {
    setSelectedProductId(product.id)
    setDraft(productToDraft(product))
    setStatusMessage('')
    setErrorMessage('')
  }

  function startNewProduct() {
    setSelectedProductId('')
    setDraft(createEmptyDraft(products.length + 1))
    setStatusMessage('')
    setErrorMessage('')
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    const product = draftToProduct(draft, selectedProduct)

    try {
      const savedProduct = isSupabaseConfigured() ? await adminProductService.saveProduct(product) : product

      setProducts((current) => {
        const exists = current.some((item) => item.id === savedProduct.id)
        const nextProducts = exists
          ? current.map((item) => (item.id === savedProduct.id ? savedProduct : item))
          : [...current, savedProduct]

        return nextProducts.sort((left, right) => left.sortOrder - right.sortOrder)
      })
      setSelectedProductId(savedProduct.id)
      setDraft(productToDraft(savedProduct))
      setStatusMessage(isSupabaseConfigured() ? t('admin.saved') : t('admin.savedLocally'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedProduct) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')

    try {
      if (isSupabaseConfigured()) {
        await adminProductService.deleteProduct(selectedProduct.id)
      }

      setProducts((current) => current.filter((product) => product.id !== selectedProduct.id))
      const nextProduct = products.find((product) => product.id !== selectedProduct.id)
      setSelectedProductId(nextProduct?.id ?? '')
      setDraft(nextProduct ? productToDraft(nextProduct) : createEmptyDraft(1))
      setStatusMessage(isSupabaseConfigured() ? t('admin.deleted') : t('admin.deletedLocally'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" onClick={startNewProduct} type="button">
            <Plus size={18} />
            {t('admin.addProduct')}
          </button>
        }
        description={t('admin.productsDescription')}
        title={t('admin.products')}
      />

      <div className="admin-kpi-grid">
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.totalProducts')}</span>
          <strong>{products.length}</strong>
        </article>
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.activeProducts')}</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="admin-card">
          <span className="admin-kpi-label">{t('admin.featuredProducts')}</span>
          <strong>{featuredCount}</strong>
        </article>
      </div>

      <div className="admin-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder={t('common.search')} type="search" />
        </label>
        <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
          <option value="all">{t('admin.allCategories')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name[language]}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-management-grid">
        <div className="admin-list-panel">
          {filteredProducts.map((product) => (
            <button
              className={`admin-list-item ${product.id === selectedProductId ? 'selected' : ''}`}
              key={product.id}
              onClick={() => selectProduct(product)}
              type="button"
            >
              <span className="admin-thumb">{product.coverImage ? <img alt="" src={product.coverImage} /> : null}</span>
              <span>
                <strong>{product.name[language]}</strong>
                <small>{categoryNameById.get(product.categoryId) ?? t('admin.uncategorized')}</small>
              </span>
              {product.isFeatured ? <Star className="status-icon" size={16} /> : null}
            </button>
          ))}
        </div>

        <form className="form-card admin-edit-form" onSubmit={handleSave}>
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{t('admin.productEditor')}</p>
              <h2>{selectedProduct ? selectedProduct.name[language] : t('admin.newProduct')}</h2>
            </div>
            <span className={`status-pill ${draft.isActive ? 'success' : 'muted'}`}>
              {draft.isActive ? t('admin.active') : t('admin.inactive')}
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
              {t('admin.price')}
              <input min="0" onChange={(event) => updateDraft('price', event.target.value)} step="0.01" type="number" value={draft.price} />
            </label>
            <label>
              {t('admin.category')}
              <select onChange={(event) => updateDraft('categoryId', event.target.value)} value={draft.categoryId}>
                <option value="">{t('admin.uncategorized')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name[language]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('admin.sortOrder')}
              <input onChange={(event) => updateDraft('sortOrder', event.target.value)} type="number" value={draft.sortOrder} />
            </label>
            <label className="checkbox-label">
              <input checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} type="checkbox" />
              {t('admin.active')}
            </label>
            <label className="checkbox-label">
              <input checked={draft.isFeatured} onChange={(event) => updateDraft('isFeatured', event.target.checked)} type="checkbox" />
              {t('admin.featured')}
            </label>
          </div>
          <div className="form-grid language-columns">
            <label>
              {t('admin.descriptionZh')}
              <textarea onChange={(event) => updateDraft('descriptionZh', event.target.value)} rows={3} value={draft.descriptionZh} />
            </label>
            <label>
              {t('admin.descriptionEn')}
              <textarea onChange={(event) => updateDraft('descriptionEn', event.target.value)} rows={3} value={draft.descriptionEn} />
            </label>
            <label>
              {t('admin.descriptionRu')}
              <textarea onChange={(event) => updateDraft('descriptionRu', event.target.value)} rows={3} value={draft.descriptionRu} />
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              {t('admin.tags')}
              <textarea onChange={(event) => updateDraft('tagsText', event.target.value)} rows={3} value={draft.tagsText} />
            </label>
          </div>
          <div className="form-grid language-columns">
            <label>
              {t('admin.detailZh')}
              <textarea onChange={(event) => updateDraft('detailZh', event.target.value)} rows={4} value={draft.detailZh} />
            </label>
            <label>
              {t('admin.detailEn')}
              <textarea onChange={(event) => updateDraft('detailEn', event.target.value)} rows={4} value={draft.detailEn} />
            </label>
            <label>
              {t('admin.detailRu')}
              <textarea onChange={(event) => updateDraft('detailRu', event.target.value)} rows={4} value={draft.detailRu} />
            </label>
          </div>
          <div className="form-grid two-columns">
            <label>
              {t('admin.coverImage')}
              <input onChange={(event) => updateDraft('coverImage', event.target.value)} value={draft.coverImage} />
            </label>
          </div>
          <label>
            {t('admin.images')}
            <textarea onChange={(event) => updateDraft('imagesText', event.target.value)} rows={3} value={draft.imagesText} />
          </label>
          <div className="admin-action-row">
            <button className="secondary-button" type="button">
              <ImagePlus size={18} />
              {t('admin.manageImages')}
            </button>
            <button className="danger-button" disabled={!selectedProduct} onClick={() => void handleDelete()} type="button">
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
