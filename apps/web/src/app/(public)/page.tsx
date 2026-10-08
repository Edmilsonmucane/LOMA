import { PublicImage as Image } from '@/lib/portal/image';
import { getSite } from '@/lib/portal/server';
import { PublicSection } from '@/lib/portal/views';
import { getTranslations } from 'next-intl/server';
export default async function Home() {
  const site = await getSite();
  if (site)
    return (
      <>
        <section className="public-hero">
          <p className="eyebrow">{site.name}</p>
          <h1>{site.site.title}</h1>
          <p>{site.site.intro}</p>
          {site.site.image && (
            <Image
              src={site.site.image}
              alt=""
              width="960"
              height="480"
              fetchPriority="low"
              loading="lazy"
            />
          )}
        </section>
        {site.site.sections.map((section) => (
          <PublicSection key={section} section={section} site={site} />
        ))}
      </>
    );
  const t = await getTranslations('Home');
  const app = await getTranslations('App');
  return (
    <main className="home">
      <p className="eyebrow">{t('eyebrow')}</p>
      <span className="home-status">{t('status')}</span>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <a className="ui-button ui-button-primary" href="/login">
        {app('login')}
      </a>
      {process.env.NODE_ENV === 'development' && (
        <a className="ui-button ui-button-secondary" href="/design">
          {t('action')}
        </a>
      )}
    </main>
  );
}
