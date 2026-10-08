import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { can, type Permission } from '@/lib/domain/tenancy';
export default async function SettingsPage() {
  const { permissions } = await getTenantContext();
  const t = await getTranslations('App');
  const options: [string, string, Permission][] = [
    ['products', 'productsHelp', 'tenant.manage'],
    ['communication', 'communicationHelp', 'tenant.manage'],
    ['integrations', 'integrationsHelp', 'tenant.manage'],
    ['documents', 'documentsHelp', 'tenant.manage'],
    ['brand', 'brandHelp', 'tenant.manage'],
    ['site', 'siteHelp', 'tenant.manage'],
    ['team', 'teamHelp', 'users.manage'],
    ['branches', 'branchesHelp', 'users.manage'],
    ['security', 'securityHelp', 'tenant.manage'],
    ['audit', 'auditHelp', 'audit.read'],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('nav.settings')}</h1>
          <p>{t('settingsHelp')}</p>
        </div>
      </div>
      <div className="settings-list">
        {options
          .filter(([, , permission]) => can(permissions, permission))
          .map(([key, help]) => (
            <Link key={key} href={`/app/settings/${key}`}>
              <span>
                <strong>{t(key)}</strong>
                <p>{t(help)}</p>
              </span>
              <span aria-hidden>→</span>
            </Link>
          ))}
        <Link href="/auth/mfa">
          <span>
            <strong>{t('accountSecurity')}</strong>
            <p>{t('mfaHelp')}</p>
          </span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </>
  );
}
