import { headers } from 'next/headers';
import { PublicEnhancements } from '@/components/public-enhancements';
import { requestAddress } from '@/lib/context';
import { PublicImage as Image } from '@/lib/portal/image';
import { getTranslations, getMessages } from 'next-intl/server';
import { getSite } from '@/lib/portal/server';
import { deriveBrandTokens } from '@loma/ui/theme';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  if (!site) return {};
  const h = await headers();
  const url = await requestAddress(h.get('x-loma-path') ?? '/');
  return {
    metadataBase: new URL(await requestAddress('/')),
    alternates: { canonical: url },
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.site.intro,
    manifest: '/manifest.webmanifest',
    openGraph: {
      title: site.name,
      description: site.site.intro,
      type: 'website',
      url,
      locale: 'pt_MZ',
      images: [site.site.image || '/icon-512.png'],
    },
    icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
    twitter: {
      card: 'summary',
      title: site.name,
      description: site.site.intro,
      images: [site.site.image || '/icon-512.png'],
    },
  };
}
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getSite();
  if (!site) return children;
  const t = await getTranslations('Public');
  const tokens = deriveBrandTokens(site.accent);
  const messages = await getMessages();
  const home = await requestAddress('/');
  return (
    <div
      className={`public-site public-${site.site.theme}`}
      style={
        {
          '--accent': tokens.accent,
          '--on-accent': tokens.onAccent,
          '--accent-hover': tokens.accentHover,
          '--accent-soft': tokens.accentSoft,
        } as CSSProperties
      }
    >
      <a className="public-skip" href="#public-main">
        {t('skip')}
      </a>
      <header className="public-header">
        <a href={home} className="public-brand">
          {site.logo && <Image src={site.logo} width="36" height="36" alt="" />}
          <span>{site.name}</span>
        </a>
        <nav aria-label={t('navigation')}>
          <a href="/products">{t('products')}</a>
          <a href="/how-it-works">{t('how')}</a>
          <a href="/customer" className="public-customer-link">
            {t('customerArea')}
          </a>
        </nav>
      </header>
      <main id="public-main" className="public-main">
        {children}
      </main>
      <footer className="public-footer">
        <div>
          <strong>{site.legalName || site.name}</strong>
          {site.license && <p>{t('license', { number: site.license })}</p>}
          <p>{site.footer}</p>
        </div>
        <nav aria-label={t('footerNavigation')}>
          <a href="/faq">{t('faq')}</a>
          <a href="/branches">{t('branches')}</a>
          <a href="/contacts">{t('contact')}</a>
          <a href="/terms">{t('terms')}</a>
          <a href="/privacy">{t('privacy')}</a>
          <a href="/login">{t('staff')}</a>
        </nav>
      </footer>
      <script
        type="application/json"
        data-public-copy
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(messages.Public).replace(/</g, '\\u003c'),
        }}
      />
      <PublicEnhancements />
    </div>
  );
}
