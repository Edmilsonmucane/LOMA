import { getTranslations } from 'next-intl/server';
import { getPublicTenant } from '@/lib/context';
import { ActionForm } from '@/components/action-form';
import { login } from '../actions';
import { deriveBrandTokens } from '@loma/ui/theme';
import type { CSSProperties } from 'react';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const t = await getTranslations('App');
  const tenant = await getPublicTenant();
  const brand = deriveBrandTokens(tenant?.accent ?? '#0E5A4A');
  return (
    <main
      className="auth-page"
      style={
        {
          '--accent': brand.accent,
          '--accent-hover': brand.accentHover,
          '--on-accent': brand.onAccent,
        } as CSSProperties
      }
    >
      <p className="auth-brand">{tenant?.name ?? t('platformName')}</p>
      <div className="auth-panel">
        <p className="eyebrow">
          {t(tenant ? 'staffAccess' : 'platformAccess')}
        </p>
        <h1>{t('loginTitle')}</h1>
        <p className="ui-help">{t('loginHelp')}</p>
        {['expired', 'access'].includes(reason ?? '') && (
          <p className="ui-error" role="alert">
            {t(reason === 'expired' ? 'errors.expired' : 'errors.denied')}
          </p>
        )}
        <ActionForm
          kind="login"
          action={login}
          submitLabel="login"
          fields={[
            { name: 'email', label: 'email', type: 'email', required: true },
            {
              name: 'password',
              label: 'password',
              type: 'password',
              required: true,
            },
          ]}
        />
      </div>
      <p className="ui-help auth-footer">{t('privateAccess')}</p>
    </main>
  );
}
