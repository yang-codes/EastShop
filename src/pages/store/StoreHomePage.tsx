import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { catalogService } from '../../services/catalogService'
import type { Product } from '../../types/product'

export function StoreHomePage() {
  const { i18n, t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    void catalogService.listActiveProducts().then(setProducts)
  }, [])

  const language = i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ru') ? 'ru' : 'en'

  return (
    <section className="page-stack">
      <PageHeader description={t('store.heroText')} title={t('store.heroTitle')} />
      <label className="search-field">
        <Search size={18} />
        <input placeholder={t('common.search')} type="search" />
      </label>
      <div className="product-grid">
        {products.map((product) => (
          <Link className="product-card" key={product.id} to={`/product/${product.id}`}>
            <div className="product-image">{product.coverImage ? <img alt="" src={product.coverImage} /> : null}</div>
            <div>
              <h2>{product.name[language]}</h2>
              <p>{product.description[language]}</p>
              <strong>{product.price > 0 ? `$${product.price.toFixed(2)}` : 'Inquiry'}</strong>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
