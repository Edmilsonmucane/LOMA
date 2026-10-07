'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/context';
import {
  applicationSchema,
  decisionSchema,
  disbursementSchema,
  templateSchema,
} from '@/lib/domain/applications';
import { simulate } from '@loma/loan-engine';
import { termsSchema } from '@/lib/domain/products';
import type { Json } from '@/lib/supabase/database.types';
function result(error: { code: string } | null, data?: string | null) {
  if (error)
    return {
      ok: false as const,
      error:
        error.code === 'PT409'
          ? 'stale'
          : error.code === '42501'
            ? 'denied'
            : 'invalid',
    };
  for (const path of ['/app/applications', '/app/loans', '/app/clients'])
    revalidatePath(path, 'layout');
  return { ok: true as const, id: data ?? undefined };
}
export async function saveApplication(
  input: unknown,
  identity: { id?: string; revision: number },
) {
  const { db, tenant } = await requirePermission('applications.manage');
  const parsed = applicationSchema.safeParse(input);
  const ident = z
    .object({ id: z.uuid().optional(), revision: z.number().int().min(0) })
    .safeParse(identity);
  if (!parsed.success || !ident.success)
    return { ok: false as const, error: 'invalid' };
  const { data: version } = await db
    .from('product_versions')
    .select('terms')
    .eq('tenant_id', tenant.id)
    .eq('id', parsed.data.product_version_id)
    .maybeSingle();
  try {
    simulate({
      principal: BigInt(parsed.data.principal),
      periods: parsed.data.periods,
      startDate: parsed.data.start_date,
      terms: termsSchema.parse(version?.terms),
    });
  } catch {
    return { ok: false as const, error: 'invalid' };
  }
  const { data, error } = await db.rpc('save_application', {
    t: tenant.id,
    input: parsed.data as Json,
    expected_revision: ident.data.revision,
    ...(ident.data.id ? { selected_application: ident.data.id } : {}),
  });
  return result(error, data);
}
export async function transitionApplication(input: unknown) {
  const { db, tenant } = await requirePermission('applications.manage');
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid' };
  const x = parsed.data;
  const { data, error } = await db.rpc('transition_application', {
    t: tenant.id,
    a_id: x.id,
    expected_revision: x.revision,
    next_status: x.status,
    note: x.note,
  });
  return result(error, data);
}
export async function disburseApplication(input: unknown) {
  const { db, tenant } = await requirePermission('loans.disburse');
  const parsed = disbursementSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid' };
  const x = parsed.data;
  const { data, error } = await db.rpc('disburse_application', {
    t: tenant.id,
    a_id: x.id,
    expected_revision: x.revision,
    payment_method: x.method,
    payment_reference: x.reference,
    disbursement_date: x.date,
    signature_date: x.signed,
  });
  return result(error, data);
}
export async function saveContractTemplate(input: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid' };
  const { error } = await db.from('tenant_configuration').upsert(
    {
      tenant_id: tenant.id,
      category: 'document',
      key: 'contract',
      value: parsed.data,
    },
    { onConflict: 'tenant_id,category,key' },
  );
  revalidatePath('/app/settings/documents');
  return result(error);
}
