import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { catalogService } from '../../services/catalogService'
import type { Category, Product } from '../../types/product'

function getDisplayPrice(product: Product) {
  return (product.variants.find((variant) => variant.isActive && variant.isDefault) ?? product.variants.find((variant) => variant.isActive))?.price ?? 0
}

export function StoreHomePage() {
  const { i18n, t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [activeProducts, activeCategories] = await Promise.all([
          catalogService.listActiveProducts(),
          catalogService.listActiveCategories(),
        ])

        if (isMounted) {
          setProducts(activeProducts)
          setCategories(activeCategories)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      isMounted = false
    }
  }, [])

  const language = i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ru') ? 'ru' : 'en'
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const matchesCategory = categoryId === 'all' || product.categoryId === categoryId
      const matchesFeatured = !featuredOnly || product.isFeatured
      const searchableText = [
        product.name.zh,
        product.name.en,
        product.name.ru,
        product.description.zh,
        product.description.en,
        product.description.ru,
        product.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return matchesCategory && matchesFeatured && (!normalizedQuery || searchableText.includes(normalizedQuery))
    })
  }, [categoryId, featuredOnly, products, query])

  return (
    <section className="page-stack">
      <PageHeader description={t('store.heroText')} title={t('store.heroTitle')} />
      <div className="store-filter-bar">
        <div className="store-search-combo">
          <select aria-label={t('store.categoryFilter')} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            <option value="all">{t('store.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name[language]}
              </option>
            ))}
          </select>
          <label className="search-field">
            <Search size={18} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder={t('store.searchProducts')} type="search" value={query} />
          </label>
          <label className="toggle-pill">
            <input checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} type="checkbox" />
            {t('store.featuredOnly')}
          </label>
        </div>
      </div>
      {isLoading ? <div className="form-card"><p>{t('common.loading')}</p></div> : null}
      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {!isLoading && !errorMessage && filteredProducts.length === 0 ? (
        <div className="form-card"><p>{t('store.noProducts')}</p></div>
      ) : null}
      <div className="product-grid">
        {filteredProducts.map((product) => (
          <Link className="product-card" key={product.id} to={`/product/${product.id}`}>
            <div className="product-image">{product.coverImage ? <img alt="" src={product.coverImage} /> : null}</div>
            <div>
              <h2>{product.name[language]}</h2>
              <p>{product.description[language]}</p>
              <strong>{getDisplayPrice(product) > 0 ? `$${getDisplayPrice(product).toFixed(2)}` : 'Inquiry'}</strong>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
