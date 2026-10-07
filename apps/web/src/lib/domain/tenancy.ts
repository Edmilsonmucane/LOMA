import { z } from 'zod';
export const permissionKeys = [
  'tenant.read',
  'tenant.manage',
  'users.manage',
  'audit.read',
  'clients.read',
  'clients.manage',
  'applications.read',
  'applications.manage',
  'loans.read',
  'payments.manage',
  'collections.manage',
  'messages.manage',
  'reports.read',
] as const;
export type Permission = (typeof permissionKeys)[number];
export const tenantSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z][a-z0-9-]{2,39}$/)
    .refine(
      (value) => !['www', 'admin', 'app', 'api', 'platform'].includes(value),
    ),
  presetId: z.uuid(),
  planId: z.uuid(),
});
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});
export const brandSchema = z.object({
  name: z.string().trim().min(2).max(100),
  accent: z.string().regex(/^#[a-f0-9]{6}$/i),
  legal_name: z.string().max(150),
  contact_phone: z.string().max(40),
  license_number: z.string().max(100),
  footer: z.string().max(300),
  logo_url: z.union([
    z.url().refine((url) => url.startsWith('https://')),
    z.literal(''),
  ]),
});
export const securitySchema = z.object({
  require_mfa: z.boolean(),
  session_hours: z.number().int().min(1).max(720),
  password_min_length: z.number().int().min(8).max(128),
});
export function resolveTenantSlug(
  host: string,
  baseDomain: string,
): string | null {
  const hostname = host.toLowerCase().replace(/:\d+$/, '');
  const base = baseDomain.toLowerCase();
  if (hostname === base || (hostname === '127.0.0.1' && base === 'localhost'))
    return null;
  if (!hostname.endsWith(`.${base}`)) throw new Error('Unsupported host');
  const slug = hostname.slice(0, -base.length - 1);
  if (
    !/^[a-z][a-z0-9-]{2,39}$/.test(slug) ||
    ['www', 'admin', 'app', 'api', 'platform'].includes(slug)
  )
    throw new Error('Invalid tenant subdomain');
  return slug;
}
export function can(
  permissions: readonly string[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}
