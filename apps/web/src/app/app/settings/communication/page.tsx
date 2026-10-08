import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { CommunicationRules } from '@/components/communication-settings';
import { rulesSchema } from '@/lib/domain/communications';
export default async function CommunicationPage() {
  const { db, tenant } = await requirePermission('tenant.manage'),
    t = await getTranslations('Communications');
  const { data } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'communication')
    .eq('key', 'rules')
    .single();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('rules')}</h1>
          <p>{t('rulesHelp')}</p>
        </div>
      </div>
      <CommunicationRules initial={rulesSchema.parse(data?.value)} />
    </>
  );
}
