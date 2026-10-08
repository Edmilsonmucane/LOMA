import { getSite } from '@/lib/portal/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
export default async function Page() {
  const site = await getSite();
  if (!site) notFound();
  const t = await getTranslations('Public');
  return (
    <section className="public-prose">
      <h1>{t('contact')}</h1>
      <p className="public-preserve">{site.phone}</p>
      <a
        className="ui-button ui-button-primary"
        href={`tel:${site.phone.replace(/\s/g, '')}`}
      >
        {t('call')}
      </a>
    </section>
  );
}
