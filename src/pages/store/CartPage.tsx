import { Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { cartService, type CartLine } from '../../services/cartService'
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

export function CartPage() {
  const { i18n, t } = useTranslation()
  const [cart, setCart] = useState<CartLine[]>(() => cartService.getCart())
  const [products, setProducts] = useState<Product[]>([])
  const language = resolveLanguage(i18n.language)

  useEffect(() => {
    void catalogService.listActiveProducts().then(setProducts)
  }, [])

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId)

          if (!product) {
            return null
          }

          return {
            line,
            product,
            subtotal: product.price * line.quantity,
          }
        })
        .filter((item): item is { line: CartLine; product: Product; subtotal: number } => Boolean(item)),
    [cart, products],
  )

  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  function updateQuantity(productId: string, quantity: number) {
    setCart(cartService.updateQuantity(productId, quantity))
  }

  function removeItem(productId: string) {
    setCart(cartService.removeItem(productId))
  }

  return (
    <section className="page-stack">
      <PageHeader title={t('cart.title')} />
      {cartItems.length === 0 ? (
        <div className="form-card">
          <p>{t('cart.empty')}</p>
        </div>
      ) : (
        <div className="cart-panel">
          <div className="cart-list">
            {cartItems.map(({ line, product, subtotal }) => (
              <article className="cart-item" key={product.id}>
                <div className="cart-item-image">
                  {product.coverImage ? <img alt={product.name[language]} src={product.coverImage} /> : null}
                </div>
                <div className="cart-item-main">
                  <h2>{product.name[language]}</h2>
                  <p>{product.description[language]}</p>
                  <div className="cart-item-meta">
                    <span>
                      {t('cart.unitPrice')}: ${product.price.toFixed(2)}
                    </span>
                    <span>
                      {t('cart.subtotal')}: ${subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="quantity-control" aria-label={t('cart.quantity')}>
                  <button
                    aria-label={t('cart.decrease')}
                    onClick={() => updateQuantity(product.id, line.quantity - 1)}
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <strong>{line.quantity}</strong>
                  <button
                    aria-label={t('cart.increase')}
                    onClick={() => updateQuantity(product.id, line.quantity + 1)}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button className="remove-button" onClick={() => removeItem(product.id)} type="button">
                  <Trash2 size={16} />
                  {t('cart.remove')}
                </button>
              </article>
            ))}
          </div>
          <aside className="cart-summary">
            <span>{t('cart.total')}</span>
            <strong>${total.toFixed(2)}</strong>
            <Link className="primary-button" to="/checkout">
              {t('cart.checkout')}
            </Link>
          </aside>
        </div>
      )}
    </section>
  )
}
