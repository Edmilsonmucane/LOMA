import { requirePermission } from '@/lib/context';
import { applicationStates } from '@/lib/domain/applications';
export async function GET(request: Request) {
  const { db, tenant } = await requirePermission('applications.read');
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').slice(0, 150);
  const status = url.searchParams.get('state') ?? '';
  const offset = Number(url.searchParams.get('offset') ?? 0);
  if (
    (status &&
      !applicationStates.includes(
        status as (typeof applicationStates)[number],
      )) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    return new Response(null, { status: 400 });
  const { data, error } = await db.rpc('search_applications', {
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
