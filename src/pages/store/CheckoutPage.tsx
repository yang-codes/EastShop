import { MapPin } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { detectEntrySource } from '../../lib/source'
import { cartService, type CartLine } from '../../services/cartService'
import { catalogService } from '../../services/catalogService'
import { locationService } from '../../services/locationService'
import { orderService, OrderServiceError } from '../../services/orderService'
import {
  defaultPhonePrefixes,
  defaultSocialPlatforms,
  storeSettingsService,
  type PhonePrefixOption,
  type SocialPlatformOption,
} from '../../services/storeSettingsService'
import { resolveSupportedLanguage, type SupportedLanguage } from '../../types/language'
import type { LocationSnapshot } from '../../types/order'
import type { Product } from '../../types/product'

function resolveLanguage(language: string): SupportedLanguage {
  return resolveSupportedLanguage(language)
}

function getLocationErrorMessage(error: unknown, fallback: string, secureOriginMessage: string) {
  const message = error instanceof Error ? error.message : error instanceof GeolocationPositionError ? error.message : ''

  if (
    !window.isSecureContext ||
    message.includes('Origin does not have permission') ||
    message.includes('Only secure origins are allowed')
  ) {
    return secureOriginMessage
  }

  if (error instanceof GeolocationPositionError) {
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message === 'GEOLOCATION_UNSUPPORTED' ? fallback : error.message
  }

  return fallback
}

const submitErrorTranslationKeys: Record<string, string> = {
  DUPLICATE_ORDER: 'checkout.submitErrors.duplicateOrder',
  EMPTY_CART: 'checkout.emptyCart',
  INVALID_CART_LINE: 'checkout.submitErrors.invalidCart',
  INVALID_CONTACT: 'checkout.requiredFields',
  INVALID_REQUEST: 'checkout.submitErrors.invalidRequest',
  INVALID_TELEGRAM_INIT_DATA: 'checkout.submitErrors.invalidTelegram',
  PRODUCT_INACTIVE: 'checkout.submitErrors.productUnavailable',
  PRODUCT_NOT_FOUND: 'checkout.submitErrors.productUnavailable',
  PRODUCT_VARIANT_NOT_FOUND: 'checkout.submitErrors.productUnavailable',
  PRODUCT_VARIANT_REQUIRED: 'checkout.submitErrors.productUnavailable',
  RATE_LIMITED: 'checkout.submitErrors.rateLimited',
}

function getSubmitErrorMessage(error: unknown, translate: (key: string) => string, fallback: string) {
  if (error instanceof OrderServiceError && error.code) {
    const translationKey = submitErrorTranslationKeys[error.code]

    if (translationKey) {
      return translate(translationKey)
    }
  }

  return fallback
}

export function CheckoutPage() {
  const { i18n, t } = useTranslation()
  const [cart, setCart] = useState<CartLine[]>(() => cartService.getCart())
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [phonePrefixes, setPhonePrefixes] = useState<PhonePrefixOption[]>(defaultPhonePrefixes)
  const [phonePrefixId, setPhonePrefixId] = useState('cn')
  const [customPhonePrefix, setCustomPhonePrefix] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatformOption[]>(defaultSocialPlatforms)
  const [socialPlatformId, setSocialPlatformId] = useState('telegram')
  const [socialHandle, setSocialHandle] = useState('')
  const [note, setNote] = useState('')
  const [location, setLocation] = useState<LocationSnapshot | null>(null)
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [catalogErrorMessage, setCatalogErrorMessage] = useState('')
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submittedOrderId, setSubmittedOrderId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const language = resolveLanguage(i18n.language)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoadingProducts(true)
      setCatalogErrorMessage('')

      try {
        const nextProducts = await catalogService.listActiveProducts()

        if (isMounted) {
          setProducts(nextProducts)
        }
      } catch (error) {
        if (isMounted) {
          setCatalogErrorMessage(error instanceof Error ? error.message : t('checkout.submitFailed'))
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

  useEffect(() => {
    void storeSettingsService.getSettings().then((settings) => {
      const activePrefixes = settings.phonePrefixes.filter((item) => item.isActive)
      setPhonePrefixes(activePrefixes.length > 0 ? activePrefixes : defaultPhonePrefixes)
      const activeSocialPlatforms = settings.socialPlatforms.filter((item) => item.isActive)
      setSocialPlatforms(activeSocialPlatforms.length > 0 ? activeSocialPlatforms : defaultSocialPlatforms)
    })
  }, [])

  useEffect(() => {
    if (products.length === 0 || cart.length === 0) {
      return
    }

    const productIds = new Set(products.map((product) => product.id))
    const validCart = cart.filter((line) => productIds.has(line.productId))

    if (validCart.length !== cart.length) {
      cartService.saveCart(validCart)
      setCart(validCart)
    }
  }, [cart, products])

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

  const checkoutTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  async function handleLocate() {
    setIsLocating(true)
    setLocationStatus(t('checkout.locating'))

    try {
      const position = await locationService.getBrowserPosition()
      const snapshot = await locationService.reverseGeocode(position, language)
      const coordinates = `${snapshot.latitude?.toFixed(6)}, ${snapshot.longitude?.toFixed(6)}`
      const detectedAddress = snapshot.formattedAddress || coordinates
      const detectedPlace = [snapshot.city, snapshot.country].filter(Boolean).join(', ')
      const locationLine = t('checkout.locationCoordinates', {
        accuracy: Math.round(snapshot.accuracy ?? 0),
        coordinates,
      })
      const addressLine = detectedPlace
        ? t('checkout.locationDetectedAddress', { address: detectedAddress, place: detectedPlace })
        : locationLine

      setLocation(snapshot)
      setAddress(detectedAddress)
      setLocationStatus(addressLine)
    } catch (error) {
      setLocation(null)
      setLocationStatus(getLocationErrorMessage(error, t('checkout.locationFailed'), t('checkout.locationRequiresSecureOrigin')))
    } finally {
      setIsLocating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationMessage('')
    setSubmitMessage('')

    if (isLoadingProducts) {
      setValidationMessage(t('common.loading'))
      return
    }

    if (catalogErrorMessage) {
      setValidationMessage(catalogErrorMessage)
      return
    }

    if (cartItems.length === 0) {
      setValidationMessage(t('checkout.emptyCart'))
      return
    }

    const selectedPhonePrefix = phonePrefixes.find((item) => item.id === phonePrefixId) ?? phonePrefixes[0] ?? defaultPhonePrefixes[0]
    const normalizedCustomPrefix = customPhonePrefix.trim().replace(/[^\d+]/g, '')
    const phonePrefix = selectedPhonePrefix.isCustom
      ? normalizedCustomPrefix.startsWith('+')
        ? normalizedCustomPrefix
        : `+${normalizedCustomPrefix}`
      : selectedPhonePrefix.prefix
    const localPhone = phone.replace(/\D/g, '')
    const fullPhone = `${phonePrefix}${localPhone}`
    const normalizedSocialHandle = socialHandle.trim()
    const selectedSocialPlatform =
      socialPlatforms.find((item) => item.id === socialPlatformId)
      ?? socialPlatforms[0]
      ?? defaultSocialPlatforms[0]

    if (!localPhone || (selectedPhonePrefix.isCustom && phonePrefix === '+')) {
      setValidationMessage(t('checkout.requiredFields'))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await orderService.submitOrder({
        cart: cartItems.map(({ line }) => line),
        companyWebsite,
        contact: {
          address: address.trim(),
          name: name.trim(),
          note: note.trim() || undefined,
          phone: fullPhone,
          socialHandle: normalizedSocialHandle || undefined,
          socialPlatform: normalizedSocialHandle ? selectedSocialPlatform.code : undefined,
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
      setSubmitMessage(getSubmitErrorMessage(error, t, t('checkout.submitFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={submittedOrderId ? 'page-stack checkout-submitted' : 'page-stack'}>
      <PageHeader
        action={
          submittedOrderId ? undefined : (
            <Link className="secondary-button" to="/">
              <ArrowLeft size={18} />
              {t('checkout.continueShopping')}
            </Link>
          )
        }
        description={submittedOrderId ? t('checkout.receivedHint') : undefined}
        title={t('checkout.title')}
      />
      {submittedOrderId ? (
        <div className="form-card success-panel">
          <h2>{t('checkout.successTitle')}</h2>
          <p>{submitMessage}</p>
          <p className="checkout-success-hint">{t('checkout.orderLookupHint')}</p>
          <div className="checkout-success-actions">
            <Link className="primary-button" to="/orders">
              {t('checkout.viewMyOrders')}
            </Link>
            <Link className="secondary-button" to="/">
              {t('checkout.continueShopping')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="checkout-panel">
          <form className="form-card" onSubmit={handleSubmit}>
            <label className="checkout-honeypot" aria-hidden="true">
              Company website
              <input
                autoComplete="off"
                onChange={(event) => setCompanyWebsite(event.target.value)}
                tabIndex={-1}
                type="text"
                value={companyWebsite}
              />
            </label>
            <label>
              {t('checkout.username')}
              <input onChange={(event) => setName(event.target.value)} type="text" value={name} />
            </label>
            <label>
              <span className="required-label">{t('checkout.mobilePhone')}</span>
              <div className="phone-input-row">
                <div className="phone-prefix-control">
                  <select
                    aria-label={t('checkout.phonePrefix')}
                    onChange={(event) => setPhonePrefixId(event.target.value)}
                    value={phonePrefixId}
                  >
                    {phonePrefixes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label[language]} {item.isCustom ? '' : item.prefix}
                      </option>
                    ))}
                  </select>
                  {phonePrefixes.find((item) => item.id === phonePrefixId)?.isCustom ? (
                    <input
                      aria-label={t('checkout.customPhonePrefix')}
                      inputMode="tel"
                      onChange={(event) => setCustomPhonePrefix(event.target.value)}
                      placeholder="+"
                      required
                      type="tel"
                      value={customPhonePrefix}
                    />
                  ) : null}
                </div>
                <input
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t('checkout.mobilePhonePlaceholder')}
                  required
                  type="tel"
                  value={phone}
                />
              </div>
            </label>
            <label>
              {t('checkout.address')}
              <textarea onChange={(event) => setAddress(event.target.value)} rows={3} value={address} />
            </label>
            <button className="secondary-button" disabled={isLocating} onClick={handleLocate} type="button">
              <MapPin size={18} />
              {isLocating ? t('checkout.locating') : t('checkout.locate')}
            </button>
            {locationStatus ? <p className="location-status">{locationStatus}</p> : null}
            {location?.latitude != null && location.longitude != null ? (
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
              <div className="social-contact-row">
                <select
                  aria-label={t('checkout.socialPlatform')}
                  onChange={(event) => setSocialPlatformId(event.target.value)}
                  value={socialPlatformId}
                >
                  {socialPlatforms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label[language] || item.label.zh}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t('checkout.socialHandle')}
                  onChange={(event) => setSocialHandle(event.target.value)}
                  placeholder={t('checkout.socialHandlePlaceholder')}
                  type="text"
                  value={socialHandle}
                />
              </div>
            </label>
            <label>
              {t('checkout.note')}
              <textarea onChange={(event) => setNote(event.target.value)} rows={2} value={note} />
            </label>
            {validationMessage ? <p className="auth-message error">{validationMessage}</p> : null}
            {catalogErrorMessage ? <p className="auth-message error">{catalogErrorMessage}</p> : null}
            {submitMessage ? <p className="auth-message error">{submitMessage}</p> : null}
            <button className="primary-button" disabled={isSubmitting || isLoadingProducts || Boolean(catalogErrorMessage) || cartItems.length === 0} type="submit">
              {isSubmitting ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </form>
          <aside className="cart-summary checkout-summary">
            <h2>{t('checkout.orderSummary')}</h2>
            {isLoadingProducts ? (
              <p>{t('common.loading')}</p>
            ) : cartItems.length === 0 ? (
              <p>{t('cart.empty')}</p>
            ) : (
              <div className="checkout-lines">
                {cartItems.map(({ line, product, subtotal, unitPrice, variant }) => (
                  <div className="checkout-line" key={`${product.id}-${line.variantId ?? 'default'}`}>
                    <span>{product.name[language]}</span>
                    {variant ? <small>{variant.name[language]}</small> : null}
                    <small>
                      {line.quantity} x ${unitPrice.toFixed(2)}
                    </small>
                    <strong>${subtotal.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="checkout-total" data-total={checkoutTotal.toFixed(2)}>
              <span>{t('cart.total')}</span>
              <strong>${checkoutTotal.toFixed(2)}</strong>
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
