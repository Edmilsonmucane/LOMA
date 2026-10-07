import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
export default async function Home() {
  const t = await getTranslations('Home');
  const app = await getTranslations('App');
  return (
    <main className="home">
      <p className="eyebrow">{t('eyebrow')}</p>
      <span className="home-status">{t('status')}</span>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <Link className="ui-button ui-button-primary" href="/login">
        {app('login')}
      </Link>
      {process.env.NODE_ENV === 'development' && (
        <Link className="ui-button ui-button-secondary" href="/design">
          {t('action')}
        </Link>
      )}
    </main>
  );
}
