import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { cartService, type CartLine } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import { resolveSupportedLanguage } from '../../types/language'
import type { Product } from '../../types/product'

function resolveLanguage(language: string) {
  return resolveSupportedLanguage(language)
}

export function CartPage() {
  const { i18n, t } = useTranslation()
  const [cart, setCart] = useState<CartLine[]>(() => cartService.getCart())
  const [products, setProducts] = useState<Product[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const language = resolveLanguage(i18n.language)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoadingProducts(true)
      setErrorMessage('')

      try {
        const nextProducts = await catalogService.listActiveProducts()

        if (isMounted) {
          setProducts(nextProducts)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t('myOrders.failed'))
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false)
        }
      }
    }

    void loadProducts()

    return () => {
      isMounted = false
    }
  }, [t])

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId)

          if (!product) {
            return null
          }

          const activeVariants = product.variants.filter((item) => item.isActive)
          const variant = line.variantId
            ? activeVariants.find((item) => item.id === line.variantId)
            : activeVariants.find((item) => item.isDefault) ?? activeVariants[0]

          if (!variant) {
            return null
          }

          const unitPrice = variant.price

          return {
            line,
            product,
            subtotal: unitPrice * line.quantity,
            unitPrice,
            variant: variant as Product['variants'][number],
          }
        })
        .filter((item): item is { line: CartLine; product: Product; subtotal: number; unitPrice: number; variant: Product['variants'][number] } => Boolean(item)),
    [cart, products],
  )

  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  function updateQuantity(productId: string, quantity: number, variantId?: string) {
    setCart(cartService.updateQuantity(productId, quantity, variantId))
  }

  function removeItem(productId: string, variantId?: string) {
    setCart(cartService.removeItem(productId, variantId))
  }

  return (
    <section className="page-stack">
      <PageHeader title={t('cart.title')} />
      {isLoadingProducts ? <div className="form-card"><p>{t('common.loading')}</p></div> : null}
      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {!isLoadingProducts && !errorMessage && cartItems.length === 0 ? (
        <div className="form-card">
          <p>{t('cart.empty')}</p>
          <Link className="primary-button cart-empty-action" to="/">
            {t('cart.continueShopping')}
          </Link>
        </div>
      ) : null}
      {!isLoadingProducts && !errorMessage && cartItems.length > 0 ? (
        <div className="cart-panel">
          <div className="cart-list">
            {cartItems.map(({ line, product, subtotal, unitPrice, variant }) => (
              <article className="cart-item" key={`${product.id}-${line.variantId ?? 'default'}`}>
                <Link className="cart-item-image" to={`/product/${product.id}`}>
                  {product.coverImage ? <img alt={product.name[language]} src={product.coverImage} /> : null}
                </Link>
                <Link className="cart-item-main" to={`/product/${product.id}`}>
                  <h2>{product.name[language]}</h2>
                  {variant ? <strong className="cart-item-variant">{variant.name[language]}</strong> : null}
                  <p>{product.description[language]}</p>
                  <div className="cart-item-meta">
                    <span>
                      {t('cart.unitPrice')}: ${unitPrice.toFixed(2)}
                    </span>
                    <span>
                      {t('cart.subtotal')}: ${subtotal.toFixed(2)}
                    </span>
                  </div>
                </Link>
                <div className="quantity-control" aria-label={t('cart.quantity')}>
                  <button
                    aria-label={t('cart.decrease')}
                    onClick={() => updateQuantity(product.id, line.quantity - 1, line.variantId)}
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <strong>{line.quantity}</strong>
                  <button
                    aria-label={t('cart.increase')}
                    onClick={() => updateQuantity(product.id, line.quantity + 1, line.variantId)}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button className="remove-button" onClick={() => removeItem(product.id, line.variantId)} type="button">
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
            <Link className="secondary-button" to="/">
              <ArrowLeft size={18} />
              {t('cart.continueShopping')}
            </Link>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
