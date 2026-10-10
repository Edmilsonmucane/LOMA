import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { supabaseServer } from '@/lib/supabase/server';
import { MfaForm } from '@/components/mfa-form';
export default async function MfaPage() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await db.auth.mfa.listFactors();
  const factor = data?.totp.find((item) => item.status === 'verified');
  const t = await getTranslations('App');
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1>{t('mfaTitle')}</h1>
        <p className="ui-help">{t('mfaHelp')}</p>
        <MfaForm {...(factor ? { verifiedFactor: factor.id } : {})} />
      </div>
    </main>
  );
}
