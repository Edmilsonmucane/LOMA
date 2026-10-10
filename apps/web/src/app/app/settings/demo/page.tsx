import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { DemoReset } from '@/components/demo-reset';
export default async function DemoPage() {
  const { tenant } = await requirePermission('tenant.manage');
  if (!tenant.is_demo) notFound();
  const t = await getTranslations('Demo');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('help')}</p>
        </div>
        <DemoReset generation={tenant.demo_generation} />
      </div>
      <section className="client-section">
        <h2>{t('contents')}</h2>
        <p>{t('dataset')}</p>
        <p>{t('console')}</p>
        <p className="ui-help">
          {t('generation', { generation: tenant.demo_generation })}
        </p>
      </section>
    </>
  );
}
