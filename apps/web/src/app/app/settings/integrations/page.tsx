import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { IntegrationForm } from '@/components/communication-settings';
import { channels } from '@/lib/domain/communications';
export default async function IntegrationsPage() {
  const { db, tenant } = await requirePermission('tenant.manage'),
    t = await getTranslations('Communications');
  const { data } = await db
    .from('tenant_configuration')
    .select('key,value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'integration');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('integrations')}</h1>
          <p>{t('integrationHelp')}</p>
        </div>
      </div>
      {channels.map((ch) => (
        <IntegrationForm
          key={ch}
          channel={ch}
          provider={
            (
              data?.find((x) => x.key === ch)?.value as
                { provider?: string } | undefined
            )?.provider ?? 'console'
          }
        />
      ))}
    </>
  );
}
