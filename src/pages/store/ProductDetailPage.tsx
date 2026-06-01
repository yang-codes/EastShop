import { ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { cartService } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import type { Product } from '../../types/product'

function resolveLanguage(language: string) {
  if (language.startsWith('zh')) {
    return 'zh'
  }

  if (language.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
}

export function ProductDetailPage() {
  const { i18n, t } = useTranslation()
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState('')

  useEffect(() => {
    if (!productId) {
      return
    }

    void catalogService.getProductById(productId).then((loadedProduct) => {
      setProduct(loadedProduct)
      setSelectedImage(loadedProduct?.coverImage || loadedProduct?.images[0] || '')
    })
  }, [productId])

  const language = resolveLanguage(i18n.language)

  if (!product) {
    return (
      <section className="page-stack">
        <PageHeader description={productId} title={t('store.productDetail')} />
        <div className="form-card">
          <p>{t('common.comingSoon')}</p>
        </div>
      </section>
    )
  }

  function handleAddToCart() {
    if (!product) {
      return
    }

    cartService.addItem(product.id)
    navigate('/cart')
  }

  const imageGallery = Array.from(new Set([product.coverImage, ...product.images].filter((image): image is string => Boolean(image))))

  return (
    <section className="page-stack">
      <PageHeader description={product.description[language]} title={product.name[language]} />
      <div className="detail-panel">
        <div className="product-media-stack">
          <div className="media-placeholder product-detail-image">
            {selectedImage ? <img alt={product.name[language]} src={selectedImage} /> : null}
          </div>
          {imageGallery.length > 1 ? (
            <div className="thumbnail-row" aria-label={t('store.productImages')}>
              {imageGallery.map((image) => (
                <button
                  aria-label={t('store.selectImage')}
                  className={image === selectedImage ? 'selected' : ''}
                  key={image}
                  onClick={() => setSelectedImage(image)}
                  type="button"
                >
                  <img alt="" src={image} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="form-card">
          <strong className="price-line">${product.price.toFixed(2)}</strong>
          <p>{product.detail[language]}</p>
          <div className="tag-row">
            {product.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <dl className="spec-list">
            {product.specs.map((spec) => (
              <div key={spec.id}>
                <dt>{spec.label[language]}</dt>
                <dd>{spec.value[language]}</dd>
              </div>
            ))}
          </dl>
          <button className="primary-button" onClick={handleAddToCart} type="button">
            <ShoppingCart size={18} />
            {t('cart.add')}
          </button>
        </div>
      </div>
    </section>
  )
}
