import { getTranslations } from 'next-intl/server';
import { getSite } from '@/lib/portal/server';
import { PublicSection } from '@/lib/portal/views';
import { notFound } from 'next/navigation';
export default async function Page() {
  const site = await getSite();
  if (!site) notFound();
  const t = await getTranslations('Public');
  return (
    <>
      <h1 className="public-page-title">{t('products')}</h1>
      <PublicSection site={site} section="products" />
    </>
  );
}
