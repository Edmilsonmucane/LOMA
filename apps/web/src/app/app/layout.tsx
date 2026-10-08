import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { deriveBrandTokens } from '@loma/ui/theme';
import { getTenantContext } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { AppShell } from '@/components/app-shell';
import { InternalIntlLayout } from '@/components/internal-intl';
export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, tenant, user, membership, permissions } =
    await getTenantContext();
  const t = await getTranslations('App');
  const brand = deriveBrandTokens(tenant.accent);
  const { data: branch } = membership?.branch_id
    ? await db
        .from('branches')
        .select('name')
        .eq('id', membership.branch_id)
        .maybeSingle()
    : { data: null };
  const { data: team } = can(permissions, 'users.manage')
    ? await db
        .from('memberships')
        .select('id,display_name')
        .eq('tenant_id', tenant.id)
        .limit(100)
    : { data: [] };
  return (
    <InternalIntlLayout>
      <div
        style={
          {
            '--accent': brand.accent,
            '--on-accent': brand.onAccent,
            '--accent-hover': brand.accentHover,
            '--accent-soft': brand.accentSoft,
          } as CSSProperties
        }
      >
        <AppShell
          name={tenant.name}
          logoUrl={tenant.logo_url}
          footer={tenant.footer}
          person={membership?.display_name ?? user.email ?? ''}
          branch={branch?.name ?? t('allBranches')}
          canManage={can(permissions, 'users.manage')}
          canAudit={can(permissions, 'audit.read')}
          permissions={permissions}
          searchItems={(team ?? []).map((item) => ({
            id: item.id,
            label: item.display_name,
            path: '/app/settings/team',
          }))}
        >
          {children}
        </AppShell>
      </div>
    </InternalIntlLayout>
  );
}
