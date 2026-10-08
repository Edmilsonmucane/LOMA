'use server';
import { createHmac } from 'node:crypto';
import { requirePermission } from '@/lib/context';
import { termsSchema } from '@/lib/domain/products';
import { z } from 'zod';
import { demoDataset } from '@/lib/domain/demo';
import { maputoToday } from '@/lib/domain/dates';
import { revalidatePath } from 'next/cache';
export async function resetDemo(expected: number) {
  const { db, tenant, user } = await requirePermission('tenant.manage');
  if (!tenant.is_demo || !Number.isSafeInteger(expected))
    return { ok: false as const, error: 'invalid' };
  const { data, error } = await db.rpc('demo_blueprint', { t: tenant.id });
  if (error) return { ok: false as const, error: 'invalid' };
  const blueprint = z
    .object({
      generation: z.number().int(),
      products: z
        .array(
          z.object({ key: z.string(), name: z.string(), terms: termsSchema }),
        )
        .length(4),
    })
    .parse(data);
  if (blueprint.generation !== expected)
    return { ok: false as const, error: 'stale' };
  const key = process.env.FINANCIAL_SIGNING_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    return { ok: false as const, error: 'unavailable' };
  const products = blueprint.products.map((p) => ({
    ...p,
    terms: {
      ...p.terms,
      requirements: { ...p.terms.requirements, documents: [], guarantees: [] },
    },
  }));
  const payload = JSON.stringify(
    {
      tenant: tenant.id,
      actor: user.id,
      generation: expected,
      expires: new Date(Date.now() + 300000).toISOString(),
      dataset: demoDataset(products, maputoToday()),
    },
    (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
  );
  const result = await db.rpc('reset_demo', {
    t: tenant.id,
    expected_generation: expected,
    payload,
    signature: createHmac('sha256', key)
      .update('demo:' + payload)
      .digest('hex'),
  });
  if (result.error)
    return {
      ok: false as const,
      error: result.error.code === 'PT409' ? 'stale' : 'invalid',
    };
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
