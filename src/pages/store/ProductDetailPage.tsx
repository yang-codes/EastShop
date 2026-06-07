import { ShoppingCart } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { cartService } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import { storeSettingsService, type StoreSettings } from '../../services/storeSettingsService'
import { resolveSupportedLanguage } from '../../types/language'
import type { Product } from '../../types/product'

function resolveLanguage(language: string) {
  return resolveSupportedLanguage(language)
}

function getDisplayPrice(product: Product) {
  return (product.variants.find((variant) => variant.isActive && variant.isDefault) ?? product.variants.find((variant) => variant.isActive))?.price ?? 0
}

function normalizeProductKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function findProductByLegacyKey(products: Product[], productId: string) {
  const normalizedProductId = normalizeProductKey(productId)

  return products.find((item) => {
    const candidates = [
      item.id,
      item.name.zh,
      item.name.en,
      item.name.ru,
      item.name.uz,
      item.name.en.replace(/\s+/g, '-'),
      item.name.zh.replace(/\s+/g, '-'),
    ]

    return candidates.some((candidate) => normalizeProductKey(candidate) === normalizedProductId)
  })
}

type ProductDetailContentProps = {
  product: Product
}

export function ProductDetailContent({ product }: ProductDetailContentProps) {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const language = resolveLanguage(i18n.language)
  const coverImages = product.coverImages.length > 0 ? product.coverImages : product.coverImage ? [product.coverImage] : []
  const detailImages = Array.from(new Set(product.images))
  const activeVariants = product.variants.filter((variant) => variant.isActive)
  const defaultVariant = activeVariants.find((variant) => variant.isDefault) ?? activeVariants[0]
  const [activeCoverIndex, setActiveCoverIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? '')
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? defaultVariant
  const displayPrice = selectedVariant?.price ?? 0

  useEffect(() => {
    setActiveCoverIndex(0)
    setSelectedVariantId(defaultVariant?.id ?? '')
  }, [defaultVariant?.id, product.id, coverImages.length])

  useEffect(() => {
    if (coverImages.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveCoverIndex((index) => (index + 1) % coverImages.length)
    }, 3500)

    return () => window.clearInterval(timer)
  }, [coverImages.length])

  function handleAddToCart() {
    if (!selectedVariant) {
      return
    }

    cartService.addItem(product.id, 1, selectedVariant.id)
    navigate('/cart')
  }

  return (
    <section className="page-stack product-detail-content">
      <PageHeader description={product.description[language]} title={product.name[language]} />
      <div className="detail-panel">
        <div className="product-media-stack">
          <div
            className={`product-cover-gallery ${coverImages.length > 1 ? 'has-carousel' : 'is-single'}`}
            aria-label={t('store.coverImage')}
          >
            <span className="media-label">{t('store.coverImage')}</span>
            {coverImages[activeCoverIndex] ? (
              <figure className="media-placeholder product-detail-image" key={coverImages[activeCoverIndex]}>
                <img alt={`${product.name[language]} ${activeCoverIndex + 1}`} src={coverImages[activeCoverIndex]} />
              </figure>
            ) : null}
            {coverImages.length > 1 ? (
              <div className="cover-carousel-dots" aria-label={t('store.coverImage')}>
                {coverImages.map((image, index) => (
                  <button
                    aria-label={`${t('store.coverImage')} ${index + 1}`}
                    className={index === activeCoverIndex ? 'active' : ''}
                    key={`${image}-${index}`}
                    onClick={() => setActiveCoverIndex(index)}
                    type="button"
                  />
                ))}
              </div>
            ) : null}
          </div>
          {detailImages.length > 0 ? (
            <section className="detail-image-section" aria-label={t('store.detailImages')}>
              <div className="detail-image-heading">
                <span>{t('store.detailImages')}</span>
              </div>
              <div className="detail-image-flow">
                {detailImages.map((image, index) => (
                  <figure className="detail-image-item" key={image}>
                    <img alt={`${product.name[language]} ${index + 1}`} src={image} />
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <div className="form-card product-purchase-card">
          <strong className="price-line">{selectedVariant ? `$${displayPrice.toFixed(2)}` : 'Inquiry'}</strong>
          <div className="mobile-product-title">
            <h1>{product.name[language]}</h1>
            <p>{product.description[language]}</p>
          </div>
          <p>{product.detail[language]}</p>
          <div className="tag-row">
            {product.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {activeVariants.length > 0 ? (
            <div className="variant-selector" aria-label={t('store.variantSelector')}>
              <strong>{t('store.variantSelector')}</strong>
              <div>
                {activeVariants.map((variant) => (
                  <button
                    className={variant.id === selectedVariant?.id ? 'selected' : ''}
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    type="button"
                  >
                    <span>{variant.name[language]}</span>
                    <small>${variant.price.toFixed(2)}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <dl className="spec-list">
            {product.specs.map((spec) => (
              <div key={spec.id}>
                <dt>{spec.label[language]}</dt>
                <dd>{spec.value[language]}</dd>
              </div>
            ))}
          </dl>
          <button className="primary-button" disabled={!selectedVariant} onClick={handleAddToCart} type="button">
            <ShoppingCart size={18} />
            {t('cart.add')}
          </button>
        </div>
      </div>
    </section>
  )
}

export function ProductDetailPage() {
  const { i18n, t } = useTranslation()
  const { productId } = useParams()
  const navigate = useNavigate()
  const showProductSwitcher = true
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    let isMounted = true

    void storeSettingsService
      .getSettings()
      .then((settings) => {
        if (isMounted) {
          setStoreSettings(settings)
        }
      })
      .catch(() => {
        if (isMounted) {
          setStoreSettings(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!productId) {
      return
    }

    if (products.length > 0) {
      const resolvedProduct = products.find((item) => item.id === productId) ?? findProductByLegacyKey(products, productId)
      setProduct(resolvedProduct ?? null)
      setIsLoading(false)

      if (resolvedProduct && resolvedProduct.id !== productId) {
        navigate(`/product/${resolvedProduct.id}`, { replace: true })
      }

      return
    }

    let isMounted = true
    setIsLoading(true)
    setErrorMessage('')

    void Promise.all([catalogService.getProductById(productId), catalogService.listActiveProducts()])
      .then(([loadedProduct, activeProducts]) => {
        if (!isMounted) {
          return
        }

        const resolvedProduct = loadedProduct ?? findProductByLegacyKey(activeProducts, productId)

        setProduct(resolvedProduct ?? null)
        setProducts(activeProducts)

        if (!loadedProduct && resolvedProduct && resolvedProduct.id !== productId) {
          navigate(`/product/${resolvedProduct.id}`, { replace: true })
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        setProduct(null)
        setProducts([])
        setErrorMessage(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [navigate, productId, products])

  const language = resolveLanguage(i18n.language)

  function handleSelectProduct(nextProduct: Product) {
    if (nextProduct.id === product?.id) {
      return
    }

    setProduct(nextProduct)
    navigate(`/product/${nextProduct.id}`)
  }

  if (isLoading) {
    return (
      <section className="page-stack">
        <div className="form-card">
          <p>{t('common.loading')}</p>
        </div>
      </section>
    )
  }

  if (!product) {
    return (
      <section className="page-stack">
        <PageHeader description={productId} title={t('store.productUnavailableTitle')} />
        <div className="form-card product-unavailable-card">
          <p>{errorMessage || t('store.productUnavailableDescription')}</p>
          <button className="secondary-button" onClick={() => navigate('/')} type="button">
            <ArrowLeft size={18} />
            {t('navigation.home')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={`store-catalog-shell product-detail-route-shell${showProductSwitcher ? '' : ' product-detail-route-shell-single'}`}>
      {showProductSwitcher ? (
        <aside className="store-product-sidebar product-detail-product-switcher">
          <PageHeader
            description={storeSettings?.storeDescription[language] || t('store.heroText')}
            title={storeSettings?.storeTitle[language] || t('store.heroTitle')}
          />
          <div className="store-product-list">
            {products.map((item) => (
              <button
                aria-current={item.id === product.id ? 'true' : undefined}
                className={`store-product-list-item ${item.id === product.id ? 'selected' : ''}`}
                key={item.id}
                onClick={() => handleSelectProduct(item)}
                type="button"
              >
                <span className="store-product-thumb">{item.coverImage ? <img alt="" src={item.coverImage} /> : null}</span>
                <span className="store-product-list-text">
                  <strong>{item.name[language]}</strong>
                  <small>{item.description[language]}</small>
                  <b>{getDisplayPrice(item) > 0 ? `$${getDisplayPrice(item).toFixed(2)}` : 'Inquiry'}</b>
                </span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
      <div className="store-product-detail-pane">
        <ProductDetailContent product={product} />
      </div>
    </section>
  )
}
