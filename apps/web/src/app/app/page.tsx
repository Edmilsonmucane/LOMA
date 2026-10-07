import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { Badge } from '@loma/ui';
export default async function TodayPage() {
  const { db, tenant, permissions } = await getTenantContext();
  const t = await getTranslations('App');
  const [{ count: branches }, { count: team }, { count: products }] =
    await Promise.all([
      db
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id),
      db
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('active', true),
      db
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'draft'),
    ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('nav.today')}</p>
          <h1>{t('prepareTitle')}</h1>
          <p>{t('prepareHelp')}</p>
        </div>
        {can(permissions, 'tenant.manage') && (
          <Link
            className="ui-button ui-button-primary"
            href="/app/settings/brand"
          >
            {t('personalize')}
          </Link>
        )}
      </div>
      <div className="setup-summary">
        <div>
          <span>{t('branches')}</span>
          <strong className="numeric">{branches ?? 0}</strong>
        </div>
        <div>
          <span>
            {t(can(permissions, 'users.manage') ? 'activeUsers' : 'yourAccess')}
          </span>
          <strong className="numeric">{team ?? 0}</strong>
        </div>
        <div>
          <span>{t('draftProducts')}</span>
          <strong className="numeric">{products ?? 0}</strong>
        </div>
      </div>
      <section className="setup-list" aria-labelledby="setup-title">
        <h2 id="setup-title">{t('setupTitle')}</h2>
        <div>
          <span>
            <strong>{t('brand')}</strong>
            <p>{t('brandHelp')}</p>
          </span>
          {can(permissions, 'tenant.manage') ? (
            <Link href="/app/settings/brand">{t('review')}</Link>
          ) : (
            <Badge>{t('managerTask')}</Badge>
          )}
        </div>
        <div>
          <span>
            <strong>{t('team')}</strong>
            <p>{t('teamHelp')}</p>
          </span>
          {can(permissions, 'users.manage') ? (
            <Link href="/app/settings/team">{t('review')}</Link>
          ) : (
            <Badge>{t('managerTask')}</Badge>
          )}
        </div>
        <div>
          <span>
            <strong>{t('products')}</strong>
            <p>{t('productsHelp')}</p>
          </span>
          {can(permissions, 'tenant.manage') ? (
            <Link href="/app/settings/products">{t('review')}</Link>
          ) : (
            <Badge>{t('managerTask')}</Badge>
          )}
        </div>
      </section>
      <p className="ui-help initial-note">{t('initialNote')}</p>
    </>
  );
}
