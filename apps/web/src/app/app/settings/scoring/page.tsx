import { requirePermission } from '@/lib/context';
import { getTranslations } from 'next-intl/server';
import { scoringSchema, scoreResultSchema } from '@/lib/domain/scoring';
import { ScoringEditor } from '@/components/scoring-editor';
export default async function ScoringPage() {
  const { db, tenant } = await requirePermission('tenant.manage');
  const t = await getTranslations('Scoring');
  const { data } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'scoring')
    .eq('key', 'main')
    .single();
  const { data: client } = await db
    .from('clients')
    .select('id,name')
    .eq('tenant_id', tenant.id)
    .order('name')
    .limit(1)
    .maybeSingle();
  const score = client
    ? await db.rpc('client_score', { t: tenant.id, cid: client.id })
    : null;
  const metrics = score?.data
    ? scoreResultSchema.parse(score.data).metrics
    : {};
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('settingsTitle')}</h1>
          <p>{t('settingsHelp')}</p>
        </div>
      </div>
      <ScoringEditor
        initial={scoringSchema.parse(data?.value)}
        metrics={metrics}
        clientName={client?.name ?? t('withoutHistory')}
      />
    </>
  );
}
