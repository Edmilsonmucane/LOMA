import { cookies } from 'next/headers';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getSite, portalDb, requestProof, sign } from '@/lib/portal/server';
import { publicPhone, publicDraftSchema } from '@/lib/domain/public-site';
import { simulate, formatMoney, formatPercent } from '@loma/loan-engine';
import { fileType } from '@/lib/domain/clients';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/supabase/database.types';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
function fail(error: string, status = 400) {
  return Response.json({ error }, { status, headers: noStore });
}
function dbError(error: { code: string }) {
  return fail(
    error.code === 'PT429'
      ? 'limit'
      : error.code === 'PT409'
        ? 'stale'
        : error.code === 'PT422'
          ? 'documents'
          : error.code === '23505'
            ? 'duplicate'
            : error.code === '42501'
              ? 'denied'
              : 'invalid',
    error.code === 'PT429' ? 429 : 400,
  );
}
function quote(
  site: NonNullable<Awaited<ReturnType<typeof getSite>>>,
  v: Record<string, unknown>,
) {
  const p = site.products.find((p) => p.id === v.product);
  if (!p) throw new Error('Product');
  const q = simulate({
    principal: BigInt(String(v.principal)),
    periods: Number(v.periods),
    startDate: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Maputo',
    }).format(new Date()),
    terms: p.terms,
  });
  return {
    payment: formatMoney(q.instalments[0]?.total ?? 0n),
    total: formatMoney(q.total),
    interest: formatMoney(q.interest),
    fees: formatMoney(q.fees + q.taxes),
    annual: formatPercent(q.annualRate),
    disbursed: formatMoney(q.disbursed),
  };
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const site = await getSite();
  if (!site) return fail('denied', 404);
  if (action === 'quote') {
    try {
      return Response.json(
        quote(site, Object.fromEntries(new URL(request.url).searchParams)),
        { headers: noStore },
      );
    } catch {
      return fail('invalid');
    }
  }
  if (action === 'captcha') {
    const code = String(randomInt(100000, 999999));
    const requested = new URL(request.url).searchParams.get('id');
    if (!z.uuid().safeParse(requested).success) return fail('invalid');
    const id = String(requested);
    const time = Date.now();
    const value = `${id}.${time}.${sign(`${id}.${time}.${code}`)}`;
    const jar = await cookies();
    jar.set(`loma-captcha-${id}`, value, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.PLATFORM_BASE_DOMAIN !== 'localhost',
      path: '/',
      maxAge: 300,
    });
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64"><rect width="240" height="64" fill="#F6F5F2"/><path d="M0 18 L240 45 M0 49 L240 12" stroke="#6B6F76"/><text x="28" y="43" font-family="monospace" font-size="30" letter-spacing="8" fill="#15171A">${code}</text></svg>`,
      {
        headers: {
          ...noStore,
          'Content-Type': 'image/svg+xml',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
  if (action === 'session') {
    const db = await portalDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    return Response.json(
      { authenticated: !!user?.phone_confirmed_at },
      { headers: noStore },
    );
  }
  return fail('invalid', 404);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const origin = `${process.env.PLATFORM_BASE_DOMAIN === 'localhost' ? 'http' : 'https'}://${request.headers.get('host')}`;
  if (request.headers.get('origin') !== origin) return fail('denied', 403);
  const { action } = await params;
  const site = await getSite();
  if (!site) return fail('denied', 404);
  const reader = request.body?.getReader();
  if (!reader) return fail('invalid');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > (action === 'upload' ? 6000000 : 64000)) {
      await reader.cancel();
      return fail('size', 413);
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  if (action === 'upload') {
    const db = await portalDb();
    let form: FormData;
    try {
      form = await new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
        body: bytes,
      }).formData();
    } catch {
      return fail('file');
    }
    const file = form.get('file');
    const draft = form.get('draft');
    const title = form.get('title');
    if (
      !(file instanceof File) ||
      !z.uuid().safeParse(draft).success ||
      typeof title !== 'string' ||
      title.trim().length < 2 ||
      title.length > 150 ||
      file.size < 1 ||
      file.size > 5242880
    )
      return fail('file');
    const blob = new Uint8Array(await file.arrayBuffer());
    const mime = fileType(blob);
    if (!mime) return fail('file');
    const { data, error } = await db.rpc('customer_reserve_document', {
      t: site.id,
      d_id: String(draft),
      metadata: {
        title,
        filename: file.name.slice(0, 200),
        mime_type: mime,
        size: file.size,
        expires_on: String(form.get('expires') ?? ''),
      } as Json,
    });
    if (error) return dbError(error);
    const d = data as { id: string; path: string };
    const upload = await db.storage
      .from('client-documents')
      .upload(d.path, blob, { contentType: mime, upsert: false });
    if (upload.error) return fail('file', 500);
    const complete = await db.rpc('customer_complete_document', {
      t: site.id,
      did: d.id,
    });
    if (complete.error) {
      await db.storage.from('client-documents').remove([d.path]);
      return dbError(complete.error);
    }
    return Response.json({ ok: true, title }, { headers: noStore });
  }
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(bytes.toString());
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error();
  } catch {
    return fail('invalid');
  }
  const db = await portalDb();
  if (action === 'otp' || action === 'lead') {
    const phone = publicPhone.safeParse(input.phone);
    if (!phone.success) return fail('invalid');
    const jar = await cookies();
    if (!z.uuid().safeParse(input.captchaId).success) return fail('captcha');
    const cookieName = `loma-captcha-${String(input.captchaId)}`;
    const value = jar.get(cookieName)?.value;
    jar.delete(cookieName);
    const [id, time, mac] = value?.split('.') ?? [];
    const expected = sign(`${id}.${time}.${String(input.captcha)}`);
    if (
      !mac ||
      Date.now() - Number(time) > 300000 ||
      !/^\d{6}$/.test(String(input.captcha)) ||
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    )
      return fail('captcha');
    const proof = await requestProof(site.id, phone.data, action);
    if (action === 'lead') {
      const parsed = z
        .object({
          name: z.string().trim().min(2).max(150),
          branch_id: z.uuid(),
          consent: z.literal(true),
        })
        .safeParse(input);
      if (!parsed.success) return fail('consent');
      const { error } = await db.rpc('capture_public_lead', {
        t: site.id,
        input: parsed.data,
        ...proof,
      });
      if (error) return dbError(error);
      return Response.json({ ok: true }, { headers: noStore });
    }
    const gate = await db.rpc('public_request_gate', { t: site.id, ...proof });
    if (gate.error) return dbError(gate.error);
    const { error } = await db.auth.signInWithOtp({
      phone: phone.data,
      options: {
        shouldCreateUser: true,
        ...(typeof input.captchaToken === 'string'
          ? { captchaToken: input.captchaToken }
          : {}),
      },
    });
    if (error)
      return fail(
        error.status === 429 ? 'limit' : 'sms',
        error.status === 429 ? 429 : 400,
      );
    return Response.json({ ok: true }, { headers: noStore });
  }
  if (action === 'verify') {
    const parsed = z
      .object({ phone: publicPhone, code: z.string().regex(/^\d{6}$/) })
      .safeParse(input);
    if (!parsed.success) return fail('invalid');
    const { error } = await db.auth.verifyOtp({
      phone: parsed.data.phone,
      token: parsed.data.code,
      type: 'sms',
    });
    if (error) return fail('code');
    const entered = await db.rpc('customer_enter', { t: site.id });
    if (entered.error) return dbError(entered.error);
    return Response.json({ ok: true }, { headers: noStore });
  }
  if (action === 'logout') {
    await db.auth.signOut();
    return Response.json({ ok: true }, { headers: noStore });
  }
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.phone_confirmed_at) return fail('denied', 401);
  if (action === 'save') {
    const data = publicDraftSchema.safeParse(input.data);
    const identity = z
      .object({ id: z.uuid(), revision: z.number().int().nonnegative() })
      .safeParse(input);
    if (!data.success || !identity.success) return fail('invalid');
    const p = site.products.find(
      (p) => p.versionId === data.data.product_version_id,
    );
    if (!p) return fail('stale');
    try {
      simulate({
        principal: BigInt(data.data.principal),
        periods: data.data.periods,
        startDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Maputo',
        }).format(new Date()),
        terms: p.terms,
      });
    } catch {
      return fail('invalid');
    }
    const { data: saved, error } = await db.rpc('customer_save_draft', {
      t: site.id,
      d_id: identity.data.id,
      input: data.data as Json,
      expected_revision: identity.data.revision,
    });
    if (error) return dbError(error);
    return Response.json(
      { ok: true, ...(saved as object) },
      { headers: noStore },
    );
  }
  if (action === 'submit') {
    const parsed = z
      .object({
        id: z.uuid(),
        revision: z.number().int().positive(),
        accepted: z.literal(true),
      })
      .safeParse(input);
    if (!parsed.success) return fail('consent');
    const proof = await requestProof(
      site.id,
      `+${user.phone?.replace(/^\+/, '')}`,
      'submit',
    );
    const { data, error } = await db.rpc('customer_submit', {
      t: site.id,
      d_id: parsed.data.id,
      expected_revision: parsed.data.revision,
      ...proof,
    });
    if (error) return dbError(error);
    revalidatePath('/app/applications');
    revalidatePath('/app/clients');
    return Response.json({ ok: true, id: data }, { headers: noStore });
  }
  return fail('invalid', 404);
}
