'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/context';
import { clientSchema } from '@/lib/domain/clients';
import type { Json } from '@/lib/supabase/database.types';
function errorCode(code?: string) {
  return code === '23505'
    ? 'duplicate'
    : code === 'PT409'
      ? 'stale'
      : code === '42501'
        ? 'denied'
        : 'invalid';
}
export async function saveClient(
  input: unknown,
  identity: { id?: string; revision: number },
) {
  const { db, tenant } = await requirePermission('clients.manage');
  const parsed = clientSchema.safeParse(input);
  const meta = z
    .object({ id: z.uuid().optional(), revision: z.number().int().min(0) })
    .safeParse(identity);
  if (!parsed.success || !meta.success) return { ok: false, error: 'invalid' };
  const { data, error } = await db.rpc('save_client', {
    t: tenant.id,
    client_data: parsed.data as unknown as Json,
    expected_revision: meta.data.revision,
    ...(meta.data.id ? { selected_client: meta.data.id } : {}),
  });
  if (error) return { ok: false, error: errorCode(error.code) };
  revalidatePath('/app/clients');
  return { ok: true, id: data };
}
export async function addClientNote(id: string, note: string) {
  const { db, tenant } = await requirePermission('clients.manage');
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
  const { error } = await db.rpc('add_client_note', {
    t: tenant.id,
    c: id,
    note,
  });
  if (error) return { ok: false, error: errorCode(error.code) };
  revalidatePath(`/app/clients/${id}`);
  return { ok: true };
}
export async function importClients(input: unknown) {
  const { db, tenant } = await requirePermission('clients.manage');
  const parsed = z
    .array(z.object({ row: z.number().int().min(2), data: clientSchema }))
    .min(1)
    .max(1000)
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid', results: [] };
  const { data, error } = await db.rpc('import_clients', {
    t: tenant.id,
    rows: parsed.data as unknown as Json,
  });
  if (error) return { ok: false, error: errorCode(error.code), results: [] };
  revalidatePath('/app/clients');
  const results = z
    .array(
      z.object({
        row: z.number(),
        id: z.string().optional(),
        error: z.string().nullable(),
      }),
    )
    .parse(data);
  return { ok: true, results };
}
