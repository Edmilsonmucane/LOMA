import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
export default async function Home() {
  const t = await getTranslations('Home');
  return (
    <main className="home">
      <p className="eyebrow">{t('eyebrow')}</p>
      <span className="home-status">{t('status')}</span>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      {process.env.NODE_ENV === 'development' && (
        <Link className="ui-button ui-button-primary" href="/design">
          {t('action')}
        </Link>
      )}
    </main>
  );
}
