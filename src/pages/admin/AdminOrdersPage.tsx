import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'

export function AdminOrdersPage() {
  const { t } = useTranslation()

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" type="button">
            <Download size={18} />
            {t('admin.exportOrders')}
          </button>
        }
        description={t('common.comingSoon')}
        title={t('admin.orders')}
      />
      <div className="admin-card-grid">
        {['new', 'contacted', 'fulfilled', 'cancelled'].map((status) => (
          <article className="admin-card" key={status}>
            <h2>{status}</h2>
            <p>{t('common.comingSoon')}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
