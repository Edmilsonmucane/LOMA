import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string; channel: string }> },
) {
  const p = z
    .object({ tenant: z.uuid(), channel: z.enum(['sms', 'whatsapp', 'email']) })
    .safeParse(await params);
  if (!p.success) return new Response(null, { status: 404 });
  if (Number(request.headers.get('content-length') ?? 0) > 100000)
    return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const x = await reader.read();
    if (x.done) break;
    size += x.value.length;
    if (size > 100000) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(x.value);
  }
  const payload = Buffer.concat(chunks).toString('utf8');
  const signature = (
    request.headers.get('x-hub-signature-256') ??
    request.headers.get('x-loma-signature') ??
    ''
  ).replace(/^sha256=/, '');
  const db = await supabaseServer();
  const { data, error } = await db.rpc('provider_callback', {
    t: p.data.tenant,
    ch: p.data.channel,
    payload,
    signature,
  });
  return new Response(null, {
    status: !error && data ? 204 : 403,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string; channel: string }> },
) {
  const p = await params;
  if (!z.uuid().safeParse(p.tenant).success || p.channel !== 'whatsapp')
    return new Response(null, { status: 404 });
  const q = new URL(request.url).searchParams;
  if (q.get('hub.mode') !== 'subscribe')
    return new Response(null, { status: 403 });
  const db = await supabaseServer();
  const { data, error } = await db.rpc('provider_challenge', {
    t: p.tenant,
    token: q.get('hub.verify_token') ?? '',
    challenge: q.get('hub.challenge') ?? '',
  });
  return new Response(!error ? data : null, {
    status: !error && data ? 200 : 403,
    headers: { 'Cache-Control': 'no-store' },
  });
}
