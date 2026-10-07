import { requirePermission } from '@/lib/context';
import { loanStates } from '@/lib/domain/applications';
export async function GET(request: Request) {
  const { db, tenant } = await requirePermission('loans.read');
  const p = new URL(request.url).searchParams;
  const query = (p.get('q') ?? '').slice(0, 150);
  const status = p.get('state') ?? '';
  const offset = Number(p.get('offset') ?? 0);
  if (
    (status && !loanStates.includes(status as (typeof loanStates)[number])) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    return new Response(null, { status: 400 });
  const { data, error } = await db.rpc('search_loans', {
    t: tenant.id,
    query,
    selected_status: status,
    page_offset: offset,
  });
  if (error) return new Response(null, { status: 403 });
  return Response.json(data, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
