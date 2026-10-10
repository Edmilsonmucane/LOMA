import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { supabaseServer } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { setPassword } from '@/app/actions';
export default async function PasswordPage() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const t = await getTranslations('App');
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1>{t('setPassword')}</h1>
        <p className="ui-help">{t('passwordHelp')}</p>
        <ActionForm
          action={setPassword}
          submitLabel="savePassword"
          fields={[
            {
              name: 'password',
              label: 'newPassword',
              type: 'password',
              required: true,
            },
          ]}
        />
      </div>
    </main>
  );
}
