import { randomUUID } from 'node:crypto';
import { PublicImage as Image } from '@/lib/portal/image';
import { getSite } from '@/lib/portal/server';
import { Simulator } from '@/lib/portal/views';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    principal?: string;
    periods?: string;
  }>;
}) {
  const site = await getSite();
  if (!site) notFound();
  const p = await searchParams;
  const t = await getTranslations('Public');
  const captchaId = randomUUID();
  return (
    <>
      <h1>{t('simulation')}</h1>
      <Simulator
        site={site}
        selected={p.product}
        principal={p.principal}
        periods={p.periods}
      />
      <section className="public-lead">
        <h2>{t('leadTitle')}</h2>
        <p>{t('leadHelp')}</p>
        <form method="post" data-lead data-captcha-id={captchaId}>
          <label htmlFor="lead-name">{t('name')}</label>
          <input
            id="lead-name"
            name="name"
            required
            minLength={2}
            maxLength={150}
            autoComplete="name"
          />
          <label htmlFor="lead-phone">{t('phone')}</label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
          />
          <label htmlFor="lead-branch">{t('branch')}</label>
          <select id="lead-branch" name="branch_id">
            {site.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="public-checkbox">
            <input type="checkbox" name="consent" required />
            {t('leadConsent')}
          </label>
          <Image
            loading="eager"
            src={`/api/public/captcha?id=${captchaId}`}
            width="240"
            height="64"
            alt={t('captchaImage')}
          />
          <label htmlFor="lead-captcha">{t('captcha')}</label>
          <input
            id="lead-captcha"
            name="captcha"
            required
            pattern="[0-9]{6}"
            inputMode="numeric"
            maxLength={6}
          />
          <button
            disabled
            type="submit"
            className="ui-button ui-button-secondary"
          >
            {t('leadAction')}
          </button>
          <p role="status" data-status />
          <p data-error role="alert" hidden />
        </form>
      </section>
    </>
  );
}
