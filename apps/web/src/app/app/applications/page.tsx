import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { activeProducts } from '@/lib/active-products';
import { ApplicationList } from '@/components/application-list';
import { ApplicationEditor } from '@/components/application-editor';
export default async function ApplicationsPage() {
  const { db, tenant, permissions } =
    await requirePermission('applications.read');
  const t = await getTranslations('Applications');
  const [{ data: clients }, options] = await Promise.all([
    db
      .from('clients')
      .select('id,name')
      .eq('tenant_id', tenant.id)
      .order('name')
      .limit(100),
    activeProducts(db, tenant.id),
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('listHelp')}</p>
        </div>
        {can(permissions, 'applications.manage') && (
          <ApplicationEditor clients={clients ?? []} products={options} />
        )}
      </div>
      {(!options.length || !clients?.length) &&
        can(permissions, 'applications.manage') && (
          <p className="ui-help">{t('prepareHelp')}</p>
        )}
      <ApplicationList />
    </>
  );
}
