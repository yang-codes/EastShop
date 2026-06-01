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
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

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
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const matchesQuery =
      !normalizedQuery ||
      order.id.toLowerCase().includes(normalizedQuery) ||
      order.contact.name.toLowerCase().includes(normalizedQuery) ||
      order.contact.phone.toLowerCase().includes(normalizedQuery)

    return matchesStatus && matchesQuery
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
    link.href = url
    link.download = `eastshop-orders.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setErrorMessage('')
    setStatusMessage('')

    try {
      await adminOrderService.updateOrderStatus(orderId, status)
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)))
      setStatusMessage(t('admin.saved'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" onClick={() => void handleExport('xlsx')} type="button">
            <Download size={18} />
            {t('admin.exportOrders')}
          </button>
        }
        description={t('admin.ordersDescription')}
        title={t('admin.orders')}
      />

      <div className="admin-kpi-grid">
        {totalsByStatus.map(({ count, status }) => (
          <article className="admin-card" key={status}>
            <span className="admin-kpi-label">{t(`orderStatus.${status}`)}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>

      <div className="admin-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder={t('admin.searchOrders')} type="search" />
        </label>
        <select onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')} value={statusFilter}>
          <option value="all">{t('admin.allStatuses')}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(`orderStatus.${status}`)}
            </option>
          ))}
        </select>
        <button className="secondary-button" onClick={() => void handleExport('csv')} type="button">
          <Download size={18} />
          CSV
        </button>
      </div>

      {errorMessage ? <div className="form-card error-panel"><p>{errorMessage}</p></div> : null}
      {statusMessage ? <div className="form-card success-panel"><p>{statusMessage}</p></div> : null}

      <div className="admin-order-list">
        {filteredOrders.map((order) => (
          <article className="admin-order-card" key={order.id}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">{order.id}</p>
                <h2>{order.contact.name}</h2>
              </div>
              <label className="compact-field">
                {t('admin.status')}
                <select onChange={(event) => void handleStatusChange(order.id, event.target.value as OrderStatus)} value={order.status}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`orderStatus.${status}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-meta-grid">
              <span>{order.contact.phone}</span>
              <span>{t(`source.${order.source}`)}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
              <strong>${order.total.toFixed(2)}</strong>
            </div>
            <div className="admin-line-items">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.productId}`}>
                  <span>{item.productName}</span>
                  <span>
                    {item.quantity} x ${item.unitPrice.toFixed(2)}
                  </span>
                  <strong>${item.subtotal.toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <div className="admin-address-line">
              <MapPin size={16} />
              <span>{order.contact.address}</span>
            </div>
            {order.contact.note ? <p>{order.contact.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
