import { requirePermission } from '@/lib/context';
import { z } from 'zod';
import { clientSummary } from '@/lib/domain/clients';
export async function GET(request: Request) {
  const { db, tenant } = await requirePermission('clients.read');
  const p = new URL(request.url).searchParams;
  const parsed = z
    .object({
      q: z.string().max(150),
      classification: z.enum(['', 'regular', 'vip', 'blacklisted']),
      branch: z.union([z.uuid(), z.literal('')]),
      offset: z.coerce.number().int().min(0).max(1000000),
    })
    .safeParse({
      q: p.get('q') ?? '',
      classification: p.get('classification') ?? '',
      branch: p.get('branch') ?? '',
      offset: p.get('offset') ?? 0,
    });
  if (!parsed.success)
    return Response.json({ error: 'invalid' }, { status: 400 });
  const { data, error } = await db.rpc('search_clients', {
    t: tenant.id,
    query: parsed.data.q,
    selected_class: parsed.data.classification,
    ...(parsed.data.branch ? { selected_branch: parsed.data.branch } : {}),
    page_offset: parsed.data.offset,
    page_size: 50,
  });
  return Response.json(
    error ? { error: 'failed' } : { clients: (data ?? []).map(clientSummary) },
    {
      status: error ? 500 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
