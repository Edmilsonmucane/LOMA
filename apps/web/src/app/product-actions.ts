'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/context';
import { validateProduct } from '@/lib/domain/products';
import type { Json } from '@/lib/supabase/database.types';
export async function saveProduct(
  input: unknown,
  identity: {
    id?: string;
    revision: number;
    status: 'draft' | 'active' | 'archived';
  },
) {
  const { db, tenant } = await requirePermission('tenant.manage');
  let product;
  try {
    product = validateProduct(input);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  const parsed = z
    .object({
      id: z.uuid().optional(),
      revision: z.number().int().min(0),
      status: z.enum(['draft', 'active', 'archived']),
    })
    .safeParse(identity);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await db.rpc('save_product', {
    t: tenant.id,
    product_name: product.name,
    conditions: product.terms as unknown as Json,
    expected_revision: parsed.data.revision,
    product_status: parsed.data.status,
    ...(parsed.data.id ? { selected_product: parsed.data.id } : {}),
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === 'PT409'
          ? 'stale'
          : error.code === '42501'
            ? 'denied'
            : 'invalid',
    };
  revalidatePath('/app/settings/products');
  revalidatePath('/app');
  return { ok: true };
}
