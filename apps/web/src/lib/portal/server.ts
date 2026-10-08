import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { createHmac, createHash } from 'node:crypto';
import { supabaseServer } from '../supabase/server';
import { resolveTenantSlug } from '../domain/tenancy';
import { siteSchema } from '../domain/public-site';
import { termsSchema } from '../domain/products';
import { z } from 'zod';
import type { Database } from '../supabase/database.types';
const publicSiteSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  accent: z.string(),
  logo: z.string().nullable(),
  phone: z.string(),
  license: z.string(),
  legalName: z.string(),
  footer: z.string(),
  currency: z.string(),
  site: siteSchema,
  products: z.array(
    z.object({
      id: z.uuid(),
      versionId: z.uuid(),
      name: z.string(),
      terms: termsSchema,
    }),
  ),
  branches: z.array(
    z.object({ id: z.uuid(), name: z.string(), phone: z.string() }),
  ),
});
export const getSite = cache(async () => {
  const slug = resolveTenantSlug(
    (await headers()).get('host') ?? '',
    process.env.PLATFORM_BASE_DOMAIN ?? 'localhost',
  );
  if (!slug) return null;
  const db = await supabaseServer();
  const { data, error } = await db.rpc('public_site', { tenant_slug: slug });
  if (error) throw new Error('Public site unavailable');
  if (!data) notFound();
  return publicSiteSchema.parse(data);
});
export async function portalDb() {
  const jar = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-loma-customer',
        httpOnly: true,
        secure: process.env.PLATFORM_BASE_DOMAIN !== 'localhost',
        sameSite: 'lax',
        path: '/',
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Route handlers refresh customer session. */
          }
        },
      },
    },
  );
}
export async function requestProof(
  tenant: string,
  phone: string,
  action: string,
) {
  const h = await headers();
  const key = process.env.PUBLIC_REQUEST_SIGNING_KEY;
  if (!key) throw new Error('Public request signing key missing');
  const trusted = process.env.TRUSTED_CLIENT_IP_HEADER;
  const ip = trusted ? (h.get(trusted) ?? 'unknown') : 'local';
  const context = JSON.stringify({
    tenant,
    phone,
    action,
    time: Math.floor(Date.now() / 1000),
    ip: createHash('sha256').update(ip).digest('hex'),
  });
  return {
    context,
    signature: createHmac('sha256', key).update(context).digest('hex'),
  };
}
export function sign(value: string) {
  const key = process.env.PUBLIC_REQUEST_SIGNING_KEY;
  if (!key) throw new Error('Public request signing key missing');
  return createHmac('sha256', key).update(value).digest('hex');
}
