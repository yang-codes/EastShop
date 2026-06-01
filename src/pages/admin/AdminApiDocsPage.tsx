import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'
import { PageHeader } from '../../components/PageHeader'
import openApiContent from '../../../.codex/openapi.yaml?raw'
import { useTranslation } from 'react-i18next'

export function AdminApiDocsPage() {
  const { t } = useTranslation()

  return (
    <section className="page-stack">
      <PageHeader description={t('admin.apiDocsDescription')} title={t('admin.apiDocs')} />
      <div className="api-docs-panel">
        <ApiReferenceReact
          configuration={{
            content: openApiContent,
            defaultHttpClient: {
              clientKey: 'fetch',
              targetKey: 'javascript',
            },
            hideDarkModeToggle: true,
            layout: 'modern',
            theme: 'default',
          }}
        />
      </div>
    </section>
  )
}
