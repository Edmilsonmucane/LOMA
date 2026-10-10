import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resolveTenantSlug } from './lib/domain/tenancy';
export async function proxy(request: NextRequest) {
  try {
    resolveTenantSlug(
      request.headers.get('host') ?? '',
      process.env.PLATFORM_BASE_DOMAIN ?? 'localhost',
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const forwarded = new Headers(request.headers);
  forwarded.set('x-loma-path', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: forwarded } });
  const customer = /^\/(customer|request)(\/|$)/.test(request.nextUrl.pathname);
  if (
    !customer &&
    !/^\/(app|platform|login|auth)(\/|$)/.test(request.nextUrl.pathname)
  )
    return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookieOptions: {
      ...(customer ? { name: 'sb-loma-customer' } : {}),
      httpOnly: true,
      secure: process.env.PLATFORM_BASE_DOMAIN !== 'localhost',
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        forwarded.set('cookie', request.headers.get('cookie') ?? '');
        response = NextResponse.next({ request: { headers: forwarded } });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|site.js|sw.js|icon.svg).*)',
  ],
};
