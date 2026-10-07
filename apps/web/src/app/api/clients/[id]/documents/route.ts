import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/context';
import { fileType } from '@/lib/domain/clients';
import type { Json } from '@/lib/supabase/database.types';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    request.headers.get('origin') !==
    `${process.env.PLATFORM_BASE_DOMAIN === 'localhost' ? 'http' : 'https'}://${request.headers.get('host')}`
  )
    return Response.json({ error: 'denied' }, { status: 403 });
  const { db, tenant } = await requirePermission('clients.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: 'invalid' }, { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'file' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 6_000_000) {
      await reader.cancel();
      return Response.json({ error: 'size' }, { status: 413 });
    }
    chunks.push(value);
  }
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    return Response.json({ error: 'file' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > 5242880)
    return Response.json({ error: 'size' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = fileType(bytes);
  const meta = z
    .object({
      title: z.string().trim().min(2).max(150),
      kind: z.enum(['document', 'photo']),
      expires_on: z.union([z.iso.date(), z.literal('')]),
    })
    .safeParse(
      Object.fromEntries(
        ['title', 'kind', 'expires_on'].map((k) => [k, form.get(k) ?? '']),
      ),
    );
  if (
    !mime ||
    !meta.success ||
    (meta.data.kind === 'photo' && !mime.startsWith('image/'))
  )
    return Response.json({ error: 'file' }, { status: 400 });
  const { data: document, error } = await db.rpc('reserve_client_document', {
    t: tenant.id,
    c: id,
    document_data: {
      ...meta.data,
      filename: file.name.slice(0, 200),
      mime_type: mime,
      size: file.size,
    } as Json,
  });
  if (error || !document)
    return Response.json({ error: 'denied' }, { status: 403 });
  const { error: uploadError } = await db.storage
    .from('client-documents')
    .upload(document.path, bytes, { contentType: mime, upsert: false });
  if (uploadError) return Response.json({ error: 'upload' }, { status: 500 });
  const { error: completeError } = await db.rpc('complete_client_document', {
    t: tenant.id,
    did: document.id,
  });
  if (completeError) {
    await db.storage.from('client-documents').remove([document.path]);
    return Response.json({ error: 'upload' }, { status: 500 });
  }
  revalidatePath(`/app/clients/${id}`);
  return Response.json({ ok: true });
}
