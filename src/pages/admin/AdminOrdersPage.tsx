import { Download, MapPin, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { adminOrderService } from '../../services/adminOrderService'
import type { Order, OrderStatus } from '../../types/order'

const statuses: OrderStatus[] = ['new', 'contacted', 'fulfilled', 'cancelled']

export function AdminOrdersPage() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadOrders() {
      try {
        const nextOrders = await adminOrderService.listOrders()

        if (isMounted) {
          setOrders(nextOrders)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void loadOrders()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredOrders = orders.filter((order) => {
    const normalizedQuery = query.trim().toLowerCase()
    const orderTime = new Date(order.createdAt).getTime()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const matchesDateFrom = fromTime === null || orderTime >= fromTime
    const matchesDateTo = toTime === null || orderTime <= toTime
    const matchesQuery =
      !normalizedQuery ||
      order.id.toLowerCase().includes(normalizedQuery) ||
      order.contact.name.toLowerCase().includes(normalizedQuery) ||
      order.contact.phone.toLowerCase().includes(normalizedQuery)

    return matchesStatus && matchesDateFrom && matchesDateTo && matchesQuery
  })

  const totalsByStatus = useMemo(
    () =>
      statuses.map((status) => ({
        count: orders.filter((order) => order.status === status).length,
        status,
      })),
    [orders],
  )

  async function handleExport(format: 'csv' | 'xlsx') {
    const payload = await adminOrderService.exportOrders(filteredOrders, format)
    const blob = new Blob([payload], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateSuffix = dateFrom || dateTo ? `-${dateFrom || 'start'}-${dateTo || 'end'}` : ''
    link.href = url
    link.download = `eastshop-orders${dateSuffix}.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setErrorMessage('')
    setStatusMessage('')
    setUpdatingOrderId(orderId)

    try {
      await adminOrderService.updateOrderStatus(orderId, status)
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)))
      setStatusMessage(t('admin.saved'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setUpdatingOrderId('')
    }
  }

  return (
    <section className="page-stack">
      <PageHeader description={t('admin.ordersDescription')} title={t('admin.orders')} />

      <div className="admin-kpi-grid">
        {totalsByStatus.map(({ count, status }) => (
          <article className="admin-card" key={status}>
            <span className="admin-kpi-label">{t(`orderStatus.${status}`)}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>

      <div className="admin-toolbar admin-orders-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder={t('admin.searchOrders')} type="search" />
        </label>
        <label className="admin-date-field">
          <span>{t('admin.dateFrom')}</span>
          <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
        </label>
        <label className="admin-date-field">
          <span>{t('admin.dateTo')}</span>
          <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
        </label>
        <label className="admin-date-field">
          <span>{t('admin.status')}</span>
          <select onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')} value={statusFilter}>
            <option value="all">{t('admin.allStatuses')}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`orderStatus.${status}`)}
              </option>
            ))}
          </select>
        </label>
          <button className="primary-button" onClick={() => void handleExport('xlsx')} type="button">
            <Download size={18} />
            {t('admin.exportOrders')}
          </button>
        </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-order-list">
        {filteredOrders.map((order) => (
          <article className="admin-order-card" key={order.id}>
            <div className="admin-order-header">
              <div className="admin-order-title">
                <p className="eyebrow">{order.id}</p>
                <h2>{order.contact.name}</h2>
                <span className={`status-pill ${order.status}`}>{t(`orderStatus.${order.status}`)}</span>
              </div>
              <label className="admin-order-status-control">
                <span>{t('admin.status')}</span>
                <select
                  disabled={updatingOrderId === order.id}
                  onChange={(event) => void handleStatusChange(order.id, event.target.value as OrderStatus)}
                  value={order.status}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`orderStatus.${status}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-meta-grid">
              <div>
                <small>{t('admin.phone')}</small>
                <span>{order.contact.phone}</span>
              </div>
              <div>
                <small>{t('admin.source')}</small>
                <span>{t(`source.${order.source}`)}</span>
              </div>
              <div>
                <small>{t('admin.createdAt')}</small>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <small>{t('cart.total')}</small>
                <strong>${order.total.toFixed(2)}</strong>
              </div>
            </div>
            <div className="admin-line-items">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.productId}-${item.variantId ?? 'default'}`}>
                  <span>
                    {item.productName}
                    {item.variantName ? <small> / {item.variantName}</small> : null}
                  </span>
                  <span>
                    {item.quantity} x ${item.unitPrice.toFixed(2)}
                  </span>
                  <strong>${item.subtotal.toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <div className="admin-order-note-grid">
              <div className="admin-address-line">
                <MapPin size={16} />
                <span>{order.contact.address}</span>
              </div>
              {order.contact.socialHandle ? (
                <p>
                  <strong>{t('checkout.social')}：</strong>
                  {order.contact.socialHandle}
                </p>
              ) : null}
              {order.contact.note ? <p>{order.contact.note}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
