import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import { resolveTenantSlug, type Permission, can } from './domain/tenancy';
export const getPublicTenant = cache(async () => {
  const host = (await headers()).get('host') ?? '';
  let slug: string | null;
  try {
    slug = resolveTenantSlug(
      host,
      process.env.PLATFORM_BASE_DOMAIN ?? 'localhost',
    );
  } catch {
    notFound();
  }
  if (!slug) return null;
  const db = await supabaseServer();
  const { data, error } = await db.rpc('resolve_tenant', { tenant_slug: slug });
  if (error) throw new Error('Tenant lookup failed');
  const tenant = data?.[0];
  if (!tenant) notFound();
  return tenant;
});
export const getTenantContext = cache(async () => {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const publicTenant = await getPublicTenant();
  if (!publicTenant) notFound();
  const { data: assurance } =
    await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (publicTenant.require_mfa && assurance?.currentLevel !== 'aal2')
    redirect('/auth/mfa');
  const { data: tenant } = await db
    .from('tenants')
    .select('*')
    .eq('id', publicTenant.id)
    .single();
  if (!tenant) redirect('/login?reason=access');
  const { data: membership } = await db
    .from('memberships')
    .select('*,tenant_roles(*)')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  const { data: isAdmin } = await db.rpc('is_platform_admin');
  if (!membership && !isAdmin) redirect('/login?reason=access');
  const permissions = isAdmin
    ? [
        'tenant.read',
        'tenant.manage',
        'users.manage',
        'audit.read',
        'clients.read',
        'clients.manage',
        'applications.read',
        'applications.manage',
        'loans.read',
        'loans.disburse',
        'payments.manage',
        'collections.manage',
        'messages.manage',
        'reports.read',
      ]
    : (membership?.tenant_roles.permissions ?? []).filter(
        (permission) =>
          !membership?.branch_id ||
          !['tenant.manage', 'users.manage'].includes(permission),
      );
  return { db, user, tenant, membership, permissions, isAdmin: !!isAdmin };
});
export async function requirePermission(permission: Permission) {
  const context = await getTenantContext();
  if (!can(context.permissions, permission)) notFound();
  return context;
}
export async function getPlatformContext() {
  if (await getPublicTenant()) notFound();
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data: admin } = await db.rpc('is_platform_admin');
  if (!admin) notFound();
  return { db, user };
}
export async function tenantAddress(slug: string, path = '/app') {
  const host = (await headers()).get('host') ?? '';
  const base = process.env.PLATFORM_BASE_DOMAIN ?? 'localhost';
  resolveTenantSlug(host, base);
  const port = host.match(/:\d+$/)?.[0] ?? '';
  return `${base === 'localhost' ? 'http' : 'https'}://${slug}.${base}${port}${path}`;
}

export async function requestAddress(path: string) {
  const host = (await headers()).get('host') ?? '';
  const base = process.env.PLATFORM_BASE_DOMAIN ?? 'localhost';
  const slug = resolveTenantSlug(host, base);
  if (slug) return tenantAddress(slug, path);
  return `${base === 'localhost' ? 'http' : 'https'}://${host.toLowerCase()}${path}`;
}
