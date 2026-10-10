'use server';
import { requirePermission } from '@/lib/context';
import { scoringSchema, evidenceSchema } from '@/lib/domain/scoring';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/supabase/database.types';
export async function saveScoring(input: unknown, expected: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const cfg = scoringSchema.safeParse(input),
    old = scoringSchema.safeParse(expected);
  if (!cfg.success || !old.success)
    return { ok: false as const, error: 'invalid' };
  const { error } = await db.rpc('save_scoring_configuration', {
    t: tenant.id,
    settings: cfg.data as Json,
    expected: old.data as Json,
  });
  if (error)
    return {
      ok: false as const,
      error: error.code === 'PT409' ? 'stale' : 'invalid',
    };
  revalidatePath('/app', 'layout');
  return { ok: true as const };
}
export async function saveEvidence(client: string, input: unknown) {
  const { db, tenant } = await requirePermission('clients.manage');
  const v = evidenceSchema.safeParse(input);
  if (!z.uuid().safeParse(client).success || !v.success)
    return { ok: false as const, error: 'invalid' };
  const { error } = await db.rpc('save_scoring_evidence', {
    t: tenant.id,
    cid: client,
    input: v.data as Json,
  });
  if (error) return { ok: false as const, error: 'invalid' };
  revalidatePath('/app', 'layout');
  return { ok: true as const };
}
