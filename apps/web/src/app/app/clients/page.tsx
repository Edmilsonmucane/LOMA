import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { clientSummary } from '@/lib/domain/clients';
import { ClientsList } from '@/components/clients-list';
export default async function ClientsPage() {
  const { db, tenant, permissions, membership } =
    await requirePermission('clients.read');
  const t = await getTranslations('Clients');
  const [{ data: clients, error }, { data: branches }] = await Promise.all([
    db.rpc('search_clients', { t: tenant.id, page_size: 50 }),
    db
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenant.id)
      .order('name'),
  ]);
  if (error) throw new Error('Client lookup failed');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p className="ui-help">{t('intro')}</p>
        </div>
      </div>
      <ClientsList
        initial={(clients ?? []).map(clientSummary)}
        branches={branches ?? []}
        canManage={can(permissions, 'clients.manage')}
        defaultBranch={membership?.branch_id ?? branches?.[0]?.id ?? ''}
      />
    </>
  );
}
