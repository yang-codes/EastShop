import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'

export function AdminCategoriesPage() {
  const { t } = useTranslation()

  return (
    <section className="page-stack">
      <PageHeader description={t('common.comingSoon')} title={t('admin.categories')} />
      <div className="form-card">
        <p>{t('common.comingSoon')}</p>
      </div>
    </section>
  )
}
