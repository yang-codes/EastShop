import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'

export function AdminProductsPage() {
  const { t } = useTranslation()

  return (
    <section className="page-stack">
      <PageHeader
        action={
          <button className="primary-button" type="button">
            <Plus size={18} />
            {t('admin.products')}
          </button>
        }
        description={t('common.comingSoon')}
        title={t('admin.products')}
      />
      <div className="admin-card-grid">
        <article className="admin-card">
          <h2>{t('admin.products')}</h2>
          <p>{t('common.comingSoon')}</p>
        </article>
      </div>
    </section>
  )
}
