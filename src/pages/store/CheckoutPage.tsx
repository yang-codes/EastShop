import { MapPin } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { detectEntrySource } from '../../lib/source'
import { cartService, type CartLine } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import { locationService } from '../../services/locationService'
import { orderService } from '../../services/orderService'
import type { SupportedLanguage } from '../../types/language'
import type { LocationSnapshot } from '../../types/order'
import type { Product } from '../../types/product'

function resolveLanguage(language: string): SupportedLanguage {
  if (language.startsWith('zh')) {
    return 'zh'
  }

  if (language.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
}

function getLocationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof GeolocationPositionError) {
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message === 'GEOLOCATION_UNSUPPORTED' ? fallback : error.message
  }

  return fallback
}

export function CheckoutPage() {
  const { i18n, t } = useTranslation()
  const [cart, setCart] = useState<CartLine[]>(() => cartService.getCart())
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [socialHandle, setSocialHandle] = useState('')
  const [note, setNote] = useState('')
  const [location, setLocation] = useState<LocationSnapshot | null>(null)
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submittedOrderId, setSubmittedOrderId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function handleLocate() {
    setIsLocating(true)
    setLocationStatus(t('checkout.locating'))

    try {
      const position = await locationService.getBrowserPosition()
      const snapshot = await locationService.reverseGeocode(position, language)
      const coordinates = `${snapshot.latitude?.toFixed(6)}, ${snapshot.longitude?.toFixed(6)}`
      const locationLine = t('checkout.locationCoordinates', {
        accuracy: Math.round(snapshot.accuracy ?? 0),
        coordinates,
      })

      setLocation(snapshot)
      setAddress((current) => (current.trim() ? `${current}\n${locationLine}` : locationLine))
      setLocationStatus(t('checkout.located'))
    } catch (error) {
      setLocation(null)
      setLocationStatus(getLocationErrorMessage(error, t('checkout.locationFailed')))
    } finally {
      setIsLocating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationMessage('')
    setSubmitMessage('')

    if (cartItems.length === 0) {
      setValidationMessage(t('checkout.emptyCart'))
      return
    }

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setValidationMessage(t('checkout.requiredFields'))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await orderService.submitOrder({
        cart,
        contact: {
          address: address.trim(),
          name: name.trim(),
          note: note.trim() || undefined,
          phone: phone.trim(),
          socialHandle: socialHandle.trim() || undefined,
        },
        language,
        location: location ?? undefined,
        source: detectEntrySource(),
        telegramInitData: window.Telegram?.WebApp?.initData,
      })

      cartService.clearCart()
      setCart([])
      setSubmittedOrderId(result.orderId)
      setSubmitMessage(t('checkout.orderSubmitted', { orderId: result.orderId }))
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : t('checkout.submitFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader title={t('checkout.title')} />
      {submittedOrderId ? (
        <div className="form-card success-panel">
          <h2>{t('checkout.successTitle')}</h2>
          <p>{submitMessage}</p>
          <Link className="secondary-button" to="/">
            {t('checkout.continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="checkout-panel">
          <form className="form-card" onSubmit={handleSubmit}>
            <label>
              {t('checkout.username')}
              <input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
            </label>
            <label>
              {t('checkout.phone')}
              <input onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
            </label>
            <label>
              {t('checkout.address')}
              <textarea onChange={(event) => setAddress(event.target.value)} required rows={3} value={address} />
            </label>
            <button className="secondary-button" disabled={isLocating} onClick={handleLocate} type="button">
              <MapPin size={18} />
              {isLocating ? t('checkout.locating') : t('checkout.locate')}
            </button>
            {locationStatus ? <p className="location-status">{locationStatus}</p> : null}
            {location?.latitude && location.longitude ? (
              <a
                className="map-link"
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                rel="noreferrer"
                target="_blank"
              >
                {t('checkout.openMap')}
              </a>
            ) : null}
            <label>
              {t('checkout.social')}
              <input onChange={(event) => setSocialHandle(event.target.value)} type="text" value={socialHandle} />
            </label>
            <label>
              {t('checkout.note')}
              <textarea onChange={(event) => setNote(event.target.value)} rows={2} value={note} />
            </label>
            {validationMessage ? <p className="auth-message error">{validationMessage}</p> : null}
            {submitMessage ? <p className="auth-message error">{submitMessage}</p> : null}
            <button className="primary-button" disabled={isSubmitting || cartItems.length === 0} type="submit">
              {isSubmitting ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </form>
          <aside className="cart-summary checkout-summary">
            <h2>{t('checkout.orderSummary')}</h2>
            {cartItems.length === 0 ? (
              <p>{t('cart.empty')}</p>
            ) : (
              <div className="checkout-lines">
                {cartItems.map(({ line, product, subtotal }) => (
                  <div className="checkout-line" key={product.id}>
                    <span>{product.name[language]}</span>
                    <small>
                      {line.quantity} x ${product.price.toFixed(2)}
                    </small>
                    <strong>${subtotal.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="checkout-total">
              <span>{t('cart.total')}</span>
              <strong>${total.toFixed(2)}</strong>
            </div>
            {cartItems.length === 0 ? (
              <Link className="secondary-button" to="/">
                {t('checkout.continueShopping')}
              </Link>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  )
}
