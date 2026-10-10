import { requirePermission } from '@/lib/context';
import { siteSchema } from '@/lib/domain/public-site';
import { SiteEditor } from '@/components/site-editor';
import { getTranslations } from 'next-intl/server';
export default async function Page() {
  const { db, tenant } = await requirePermission('tenant.manage');
  const { data, error } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'website')
    .eq('key', 'main')
    .single();
  if (error) throw new Error('Site configuration unavailable');
  const t = await getTranslations('Public');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('siteTitle')}</h1>
          <p>{t('siteHelp')}</p>
        </div>
      </div>
      <SiteEditor initial={siteSchema.parse(data.value)} />
    </>
  );
}
