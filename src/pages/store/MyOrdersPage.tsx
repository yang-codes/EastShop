import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { waitForTelegramInitData } from '../../lib/source'
import { orderService } from '../../services/orderService'
import { defaultPhonePrefixes, storeSettingsService, type PhonePrefixOption } from '../../services/storeSettingsService'
import type { Order } from '../../types/order'
import { resolveSupportedLanguage, type SupportedLanguage } from '../../types/language'

type LookupMode = 'orderId' | 'socialHandle'

function resolveLanguage(language: string): SupportedLanguage {
  return resolveSupportedLanguage(language)
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function MyOrdersPage() {
  const { i18n, t } = useTranslation()
  const language = resolveLanguage(i18n.language)
  const [phonePrefixes, setPhonePrefixes] = useState<PhonePrefixOption[]>(defaultPhonePrefixes)
  const [phonePrefixId, setPhonePrefixId] = useState('uz')
  const [customPhonePrefix, setCustomPhonePrefix] = useState('+')
  const [phone, setPhone] = useState('')
  const [lookupMode, setLookupMode] = useState<LookupMode>('orderId')
  const [orderId, setOrderId] = useState('')
  const [socialHandle, setSocialHandle] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [message, setMessage] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [telegramInitData, setTelegramInitData] = useState('')

  const selectedPhonePrefix = useMemo(
    () => phonePrefixes.find((item) => item.id === phonePrefixId) ?? phonePrefixes[0] ?? defaultPhonePrefixes[0],
    [phonePrefixId, phonePrefixes],
  )

  useEffect(() => {
    void storeSettingsService.getSettings().then((settings) => {
      const activePrefixes = settings.phonePrefixes.filter((item) => item.isActive)
      setPhonePrefixes(activePrefixes.length > 0 ? activePrefixes : defaultPhonePrefixes)
    })
  }, [])

  async function lookupWithTelegramIdentity(initData: string) {
    if (!initData) {
      return
    }

    setMessage('')
    setIsLoading(true)

    try {
      const result = await orderService.lookupOrders({ telegramInitData: initData })
      setOrders(result)
      setMessage(result.length > 0 ? t('myOrders.resultCount', { count: result.length }) : t('myOrders.empty'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('myOrders.telegramLookupFailed'))
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    void waitForTelegramInitData().then((initData) => {
      if (!isMounted) {
        return
      }

      setTelegramInitData(initData)

      if (initData) {
        void lookupWithTelegramIdentity(initData)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const phonePrefix =
      selectedPhonePrefix.isCustom
        ? `+${customPhonePrefix.replace(/\D/g, '')}`
        : selectedPhonePrefix.prefix
    const localPhone = phone.replace(/\D/g, '')
    const fullPhone = `${phonePrefix}${localPhone}`
    const normalizedOrderId = orderId.trim()
    const normalizedSocialHandle = socialHandle.trim()

    if (!localPhone || (selectedPhonePrefix.isCustom && phonePrefix === '+')) {
      setMessage(t('myOrders.required'))
      return
    }

    if (lookupMode === 'orderId' && !normalizedOrderId) {
      setMessage(t('myOrders.required'))
      return
    }

    if (lookupMode === 'socialHandle' && !normalizedSocialHandle) {
      setMessage(t('myOrders.required'))
      return
    }

    setIsLoading(true)

    try {
      const result = await orderService.lookupOrders({
        phone: fullPhone,
        orderId: lookupMode === 'orderId' ? normalizedOrderId : undefined,
        socialHandle: lookupMode === 'socialHandle' ? normalizedSocialHandle : undefined,
      })
      setOrders(result)
      setMessage(result.length > 0 ? t('myOrders.resultCount', { count: result.length }) : t('myOrders.empty'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('myOrders.failed'))
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCancelOrder(order: Order) {
    if (order.status !== 'new' || cancellingOrderId) {
      return
    }

    if (!window.confirm(t('myOrders.cancelConfirm'))) {
      return
    }

    setMessage('')
    setCancellingOrderId(order.id)

    try {
      const result = await orderService.cancelOrder({
        orderId: order.id,
        phone: order.contact.phone,
      })
      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === result.orderId
            ? {
                ...item,
                status: result.status,
              }
            : item,
        ),
      )
      setMessage(t('myOrders.cancelSuccess'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('myOrders.cancelFailed'))
    } finally {
      setCancellingOrderId('')
    }
  }

  return (
    <>
      {!telegramInitData ? (
        <PageHeader
          description={t('myOrders.description')}
          title={t('myOrders.title')}
        />
      ) : null}

      {telegramInitData ? (
        <section className="form-card order-lookup-card telegram-order-lookup-card">
          <div>
            <strong>{t('myOrders.telegramDetected')}</strong>
            <p>{t('myOrders.telegramDetectedDescription')}</p>
          </div>
          <button
            className="primary-button"
            disabled={isLoading}
            onClick={() => void lookupWithTelegramIdentity(telegramInitData)}
            type="button"
          >
            <Search size={16} />
            {isLoading ? t('myOrders.searching') : t('myOrders.telegramRefresh')}
          </button>
        </section>
      ) : (
        <section className="form-card order-lookup-card">
          <form className="order-lookup-form" onSubmit={handleSubmit}>
          <label className="order-lookup-phone">
            {t('myOrders.phone')}
            <div className="phone-input-row">
              <div className="phone-prefix-control">
                <select
                  aria-label={t('checkout.phonePrefix')}
                  onChange={(event) => setPhonePrefixId(event.target.value)}
                  value={phonePrefixId}
                >
                  {phonePrefixes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label[language]} {item.prefix}
                    </option>
                  ))}
                </select>
                {phonePrefixes.find((item) => item.id === phonePrefixId)?.isCustom ? (
                  <input
                    aria-label={t('checkout.customPhonePrefix')}
                    inputMode="tel"
                    onChange={(event) => setCustomPhonePrefix(event.target.value)}
                    placeholder="+"
                    value={customPhonePrefix}
                  />
                ) : null}
              </div>
              <input
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="701 000 1020"
                required
                value={phone}
              />
            </div>
          </label>

          <div className="lookup-mode-row" role="group" aria-label={t('myOrders.lookupBy')}>
            <button
              className={lookupMode === 'orderId' ? 'active' : ''}
              onClick={() => setLookupMode('orderId')}
              type="button"
            >
              {t('myOrders.orderId')}
            </button>
            <button
              className={lookupMode === 'socialHandle' ? 'active' : ''}
              onClick={() => setLookupMode('socialHandle')}
              type="button"
            >
              {t('myOrders.socialHandle')}
            </button>
          </div>

          {lookupMode === 'orderId' ? (
            <label className="order-lookup-key">
              {t('myOrders.orderId')}
              <input
                onChange={(event) => setOrderId(event.target.value)}
                placeholder={t('myOrders.orderIdPlaceholder')}
                value={orderId}
              />
            </label>
          ) : (
            <label className="order-lookup-key">
              {t('myOrders.socialHandle')}
              <input
                onChange={(event) => setSocialHandle(event.target.value)}
                placeholder={t('myOrders.socialPlaceholder')}
                value={socialHandle}
              />
            </label>
          )}

          <button className="primary-button order-lookup-submit" disabled={isLoading} type="submit">
            <Search size={16} />
            {isLoading ? t('myOrders.searching') : t('myOrders.submit')}
          </button>
          </form>
        </section>
      )}

      {message ? <p className={orders.length > 0 ? 'notice success' : 'notice'}>{message}</p> : null}

      <section className="my-order-list" aria-label={t('myOrders.results')}>
        {orders.map((order) => (
          <article className="my-order-card panel" key={order.id}>
            <div className="my-order-header">
              <div>
                <strong>{order.id}</strong>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="my-order-header-actions">
                <span className={`status-pill ${order.status}`}>{t(`orderStatus.${order.status}`)}</span>
                {order.status === 'new' ? (
                  <button
                    className="my-order-cancel-button"
                    disabled={cancellingOrderId === order.id}
                    onClick={() => void handleCancelOrder(order)}
                    type="button"
                  >
                    {cancellingOrderId === order.id ? t('myOrders.cancelling') : t('myOrders.cancelOrder')}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="my-order-meta">
              <div>
                <small>{t('myOrders.total')}</small>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
              <div>
                <small>{t('myOrders.phone')}</small>
                <strong>{order.contact.phone}</strong>
              </div>
              <div>
                <small>{t('myOrders.address')}</small>
                <strong>{order.contact.address || order.location?.formattedAddress || '-'}</strong>
              </div>
            </div>

            <div className="my-order-lines">
              <h3>{t('myOrders.items')}</h3>
              {order.items.map((item) => (
                <div className="my-order-line" key={`${order.id}-${item.productId}-${item.variantId ?? 'default'}`}>
                  <span>
                    <strong>{item.productName}</strong>
                    {item.variantName ? <small>{item.variantName}</small> : null}
                  </span>
                  <span>
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </span>
                  <strong>{formatCurrency(item.subtotal)}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  )
}
