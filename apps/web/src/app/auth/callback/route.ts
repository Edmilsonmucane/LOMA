import { NextResponse, type NextRequest } from 'next/server';
import { getPublicTenant, requestAddress } from '@/lib/context';
import { supabaseServer } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  await getPublicTenant();
  const db = await supabaseServer();
  const code = request.nextUrl.searchParams.get('code');
  const hash = request.nextUrl.searchParams.get('token_hash');
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(await requestAddress('/auth/password'));
  }
  if (hash && request.nextUrl.searchParams.get('type') === 'invite') {
    const { error } = await db.auth.verifyOtp({
      token_hash: hash,
      type: 'invite',
    });
    if (!error)
      return NextResponse.redirect(await requestAddress('/auth/password'));
  }
  return NextResponse.redirect(await requestAddress('/login?reason=expired'));
}
