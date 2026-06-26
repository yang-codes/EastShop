import { ChevronDown, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { cartService, type CartLine } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import { storeSettingsService, type StoreSettings } from '../../services/storeSettingsService'
import { resolveSupportedLanguage } from '../../types/language'
import type { Category, Product } from '../../types/product'

function getDisplayVariants(product: Product) {
  return product.variants
    .filter((variant) => variant.isActive)
    .sort((first, second) => {
      if (first.isDefault !== second.isDefault) {
        return first.isDefault ? -1 : 1
      }

      return first.sortOrder - second.sortOrder
    })
}

function getLocalizedText(value: Product['name'] | Category['name'], language: ReturnType<typeof resolveSupportedLanguage>) {
  return value[language] || value.en || value.zh || ''
}

export function StoreHomePage() {
  const { i18n, t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [cart, setCart] = useState<CartLine[]>(() => cartService.getCart())
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string>>({})
  const [expandedVariantIds, setExpandedVariantIds] = useState<Record<string, boolean>>({})
  const [isHeroCollapsed, setIsHeroCollapsed] = useState(false)
  const lastCatalogScrollTopRef = useRef(0)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [activeProducts, activeCategories, settings] = await Promise.all([
          catalogService.listActiveProducts(),
          catalogService.listActiveCategories(),
          storeSettingsService.getSettings(),
        ])

        if (isMounted) {
          setProducts(activeProducts)
          setCategories(activeCategories)
          setStoreSettings(settings)
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

  const language = resolveSupportedLanguage(i18n.language)

  function handleCatalogScroll(event: UIEvent<HTMLDivElement>) {
    const scrollTop = event.currentTarget.scrollTop
    const isScrollingDown = scrollTop > lastCatalogScrollTopRef.current + 6

    if (scrollTop <= 4) {
      setIsHeroCollapsed(false)
    } else if (isScrollingDown) {
      setIsHeroCollapsed(true)
    }

    setExpandedVariantIds({})

    lastCatalogScrollTopRef.current = Math.max(0, scrollTop)
  }

  function getSelectedVariant(product: Product) {
    const variants = getDisplayVariants(product)
    return variants.find((variant) => variant.id === selectedVariantIds[product.id]) ?? variants[0]
  }

  function handleQuickAdd(product: Product) {
    const variant = getSelectedVariant(product)

    if (!variant) {
      return
    }

    setCart(cartService.addItem(product.id, 1, variant.id))
  }

  function getCartQuantity(product: Product) {
    return cart
      .filter((line) => line.productId === product.id)
      .reduce((total, line) => total + line.quantity, 0)
  }

  function handleVariantSelect(productId: string, variantId: string) {
    setSelectedVariantIds((current) => ({ ...current, [productId]: variantId }))
    setExpandedVariantIds((current) => ({ ...current, [productId]: false }))
  }

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const matchesCategory = categoryId === 'all' || product.categoryId === categoryId
      const matchesFeatured = !featuredOnly || product.isFeatured
      const searchableText = [
        product.name.zh,
        product.name.en,
        product.name.ru,
        product.name.uz,
        product.description.zh,
        product.description.en,
        product.description.ru,
        product.description.uz,
        [...product.tags.zh, ...product.tags.en, ...product.tags.ru, ...product.tags.uz].join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return matchesCategory && matchesFeatured && (!normalizedQuery || searchableText.includes(normalizedQuery))
    })
  }, [categoryId, featuredOnly, products, query])

  return (
    <section className={`page-stack store-home-page ${isHeroCollapsed ? 'is-hero-collapsed' : ''}`}>
      <PageHeader
        description={storeSettings?.storeDescription[language] || t('store.heroText')}
        title={storeSettings?.storeTitle[language] || t('store.heroTitle')}
      />
      <div className="store-filter-bar">
        <div className="store-search-combo">
          <select aria-label={t('store.categoryFilter')} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            <option value="all">{t('store.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getLocalizedText(category.name, language)}
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
      <div className="mobile-catalog-layout">
        <nav className="mobile-category-rail" aria-label={t('store.categoryFilter')}>
          <button className={categoryId === 'all' ? 'active' : ''} onClick={() => setCategoryId('all')} type="button">
            {t('store.allCategories')}
          </button>
          {categories.map((category) => (
            <button className={categoryId === category.id ? 'active' : ''} key={category.id} onClick={() => setCategoryId(category.id)} type="button">
              {getLocalizedText(category.name, language)}
            </button>
          ))}
        </nav>
        <div className="product-grid" onScroll={handleCatalogScroll}>
          {filteredProducts.map((product) => {
            const variants = getDisplayVariants(product)
            const selectedVariant = getSelectedVariant(product)
            const isExpanded = Boolean(expandedVariantIds[product.id])

            return (
              <article className={`product-card ${isExpanded ? 'has-expanded-variants' : ''}`} key={product.id}>
                <div className="product-card-main">
                  <Link className="product-image" to={`/product/${product.id}`}>
                    {product.coverImage ? <img alt="" src={product.coverImage} /> : null}
                  </Link>
                  <div className="product-card-copy">
                    <Link className="product-card-copy-link" to={`/product/${product.id}`}>
                      <h2>{getLocalizedText(product.name, language)}</h2>
                      <p className="product-card-description">{getLocalizedText(product.description, language)}</p>
                      {(product.tags[language] ?? product.tags.zh).length > 0 ? (
                        <div className="product-card-tags" aria-label={t('admin.tags')}>
                          {(product.tags[language] ?? product.tags.zh).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                    {selectedVariant ? (
                      <div className={`product-card-variants ${isExpanded ? 'is-expanded' : ''}`} aria-label="Product specifications">
                        <button
                          className="active"
                          onClick={() => {
                            if (variants.length > 1) {
                              setExpandedVariantIds((current) => ({ ...current, [product.id]: !current[product.id] }))
                            }
                          }}
                          type="button"
                        >
                          <span>{getLocalizedText(selectedVariant.name, language)}</span>
                          {variants.length > 1 ? <ChevronDown size={12} strokeWidth={3} /> : null}
                        </button>
                        {isExpanded && variants.length > 1 ? (
                          <div className="product-card-variant-menu">
                            {variants.map((variant) => (
                              <button
                                className={variant.id === selectedVariant.id ? 'active' : ''}
                                key={variant.id}
                                onClick={() => handleVariantSelect(product.id, variant.id)}
                                type="button"
                              >
                                {getLocalizedText(variant.name, language)}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <strong>{selectedVariant ? `$${selectedVariant.price.toFixed(2)}` : 'Inquiry'}</strong>
                  </div>
                </div>
                <button
                  aria-label={t('cart.add')}
                  className={`quick-add-button ${getCartQuantity(product) > 0 ? 'has-count' : ''}`}
                  disabled={!selectedVariant}
                  onClick={() => handleQuickAdd(product)}
                  type="button"
                >
                  <Plus size={16} strokeWidth={3} />
                  {getCartQuantity(product) > 0 ? <span>{getCartQuantity(product)}</span> : null}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
