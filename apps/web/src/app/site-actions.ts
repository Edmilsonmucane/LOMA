'use server';
import { requirePermission } from '@/lib/context';
import { siteSchema } from '@/lib/domain/public-site';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/supabase/database.types';
export async function saveSite(input: unknown, expected: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const settings = siteSchema.safeParse(input),
    old = siteSchema.safeParse(expected);
  if (!settings.success || !old.success)
    return { ok: false as const, error: 'invalid' };
  const { error } = await db.rpc('save_public_site', {
    t: tenant.id,
    settings: settings.data as Json,
    expected: old.data as Json,
  });
  if (error)
    return {
      ok: false as const,
      error: error.code === 'PT409' ? 'stale' : 'invalid',
    };
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
