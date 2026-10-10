import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@loma/ui';
import { requirePermission } from '@/lib/context';
import type { Permission } from '@/lib/domain/tenancy';
const sections: Record<string, Permission> = {
  clients: 'clients.read',
  applications: 'applications.read',
  loans: 'loans.read',
  collections: 'collections.manage',
  messages: 'messages.manage',
  reports: 'reports.read',
};
export default async function ModulePage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const permission = sections[section];
  if (!permission) notFound();
  await requirePermission(permission);
  const t = await getTranslations('App');
  return (
    <>
      <div className="page-heading">
        <h1>{t(`nav.${section}`)}</h1>
      </div>
      <div className="empty-module">
        <EmptyState
          title={t('modulePending')}
          description={t('modulePendingHelp')}
          action={
            <Link
              className="ui-button ui-button-secondary"
              href="/app/settings"
            >
              {t('nav.settings')}
            </Link>
          }
        />
      </div>
    </>
  );
}
