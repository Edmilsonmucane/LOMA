'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/context';
import {
  centsSchema,
  paymentSchema,
  previewSchema,
  receiptTemplateSchema,
} from '@/lib/domain/payments';
import type { Json } from '@/lib/supabase/database.types';
function failure(error: { code: string } | null) {
  if (error?.code === 'PT413') return 'cashInsufficient';
  return error?.code === 'PT409'
    ? 'stale'
    : error?.code === '42501'
      ? 'denied'
      : error?.code === 'PT412'
        ? 'cashRequired'
        : 'invalid';
}
function refresh() {
  for (const path of ['/app', '/app/loans', '/app/clients', '/app/cash'])
    revalidatePath(path, 'layout');
}
export async function previewPayment(input: unknown) {
  const { db, tenant } = await requirePermission('payments.manage');
  const parsed = z
    .object({ loan: z.uuid(), amount: centsSchema })
    .strict()
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid' };
  const { data, error } = await db.rpc('preview_payment', {
    t: tenant.id,
    l: parsed.data.loan,
    amount: parsed.data.amount,
  });
  if (error) return { ok: false as const, error: failure(error) };
  return { ok: true as const, preview: previewSchema.parse(data) };
}
export async function recordPayment(input: unknown) {
  const { db, tenant } = await requirePermission('payments.manage');
  const p = paymentSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: 'invalid' };
  const x = p.data;
  const { data, error } = await db.rpc('record_payment', {
    t: tenant.id,
    l: x.loan,
    amount: x.amount,
    payment_method: x.method,
    payment_reference: x.reference,
    expected_revision: x.revision,
    expected_day: x.day,
    request_id: x.requestId,
  });
  if (error) return { ok: false as const, error: failure(error) };
  refresh();
  return { ok: true as const, id: data };
}
export async function reversePayment(input: unknown) {
  const { db, tenant } = await requirePermission('payments.reverse');
  const p = z
    .object({ id: z.uuid(), reason: z.string().trim().min(2).max(2000) })
    .strict()
    .safeParse(input);
  if (!p.success) return { ok: false as const, error: 'invalid' };
  const { error } = await db.rpc('reverse_payment', {
    t: tenant.id,
    p_id: p.data.id,
    reason: p.data.reason,
  });
  if (error) return { ok: false as const, error: failure(error) };
  refresh();
  return { ok: true as const };
}
export async function manageCash(input: unknown) {
  const { db, tenant } = await requirePermission('cash.manage');
  const p = z
    .object({
      branch: z.uuid(),
      operation: z.enum(['open', 'close', 'deposit']),
      amount: z.string().regex(/^\d+$/),
      reference: z.string().trim().max(2000),
      requestId: z.uuid(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return { ok: false as const, error: 'invalid' };
  const x = p.data;
  const { error } = await db.rpc('manage_cash', {
    t: tenant.id,
    b: x.branch,
    operation: x.operation,
    amount: x.amount,
    reference: x.reference,
    request_id: x.requestId,
  });
  if (error) return { ok: false as const, error: failure(error) };
  refresh();
  return { ok: true as const };
}
export async function saveReceiptTemplate(input: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const p = receiptTemplateSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: 'invalid' };
  const { error } = await db.from('tenant_configuration').upsert(
    {
      tenant_id: tenant.id,
      category: 'document',
      key: 'receipt',
      value: p.data as Json,
    },
    { onConflict: 'tenant_id,category,key' },
  );
  if (error) return { ok: false as const, error: failure(error) };
  revalidatePath('/app/settings/documents');
  return { ok: true as const };
}
