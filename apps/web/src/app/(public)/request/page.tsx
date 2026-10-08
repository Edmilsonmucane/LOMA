import { getSite, portalDb } from '@/lib/portal/server';
import { CustomerLogin } from '@/lib/portal/login';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { formatMoney } from '@loma/loan-engine';
import { publicDraftSchema } from '@/lib/domain/public-site';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    principal?: string;
    periods?: string;
    draft?: string;
  }>;
}) {
  const site = await getSite();
  if (!site) notFound();
  const db = await portalDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.phone_confirmed_at) return <CustomerLogin />;
  const { data, error } = await db.rpc('customer_dashboard', { t: site.id });
  if (error) return <CustomerLogin />;
  const t = await getTranslations('Public');
  const params = await searchParams;
  const dash = z
    .object({
      drafts: z.array(
        z.object({
          id: z.uuid(),
          revision: z.number(),
          data: publicDraftSchema,
        }),
      ),
      documents: z.array(z.object({ title: z.string(), status: z.string() })),
    })
    .parse(data);
  const saved = dash.drafts.find((d) => d.id === params.draft);
  const p =
    site.products.find((p) =>
      saved
        ? p.versionId === saved.data.product_version_id
        : p.id === params.product,
    ) ?? site.products[0];
  if (!p)
    return (
      <section>
        <h1>{t('apply')}</h1>
        <p>{t('noProducts')}</p>
      </section>
    );
  if (
    saved &&
    !site.products.some(
      (product) => product.versionId === saved.data.product_version_id,
    )
  )
    return (
      <section>
        <h1>{t('apply')}</h1>
        <p>{t('errors.stale')}</p>
        <a className="ui-button ui-button-primary" href="/simulate">
          {t('changeSimulation')}
        </a>
      </section>
    );
  const d = saved?.data;
  const id = saved?.id ?? randomUUID();
  const identity = d?.profile.identities[0];
  return (
    <section className="public-request">
      <p className="eyebrow">{p.name}</p>
      <h1>{t('apply')}</h1>
      <p>{t('draftHelp')}</p>
      <ol className="public-progress" aria-label={t('requestSteps')}>
        {['data', 'incomeStep', 'documentsStep', 'confirmation'].map(
          (step, i) => (
            <li key={step} data-step-marker={i}>
              {i + 1}. {t(step)}
            </li>
          ),
        )}
      </ol>
      <form
        method="post"
        data-request-form
        data-draft={id}
        data-revision={saved?.revision ?? 0}
        data-version={p.versionId}
        data-product={p.id}
        data-phone={`+${user.phone?.replace(/^\+/, '')}`}
        data-draft-purpose={t('draftPurpose')}
      >
        <fieldset data-step="0">
          <legend>{t('data')}</legend>
          <label htmlFor="request-name">{t('name')}</label>
          <input
            id="request-name"
            name="name"
            defaultValue={d?.name ?? ''}
            required
            minLength={2}
            maxLength={150}
            autoComplete="name"
          />
          <label htmlFor="birth">{t('birth')}</label>
          <input
            id="birth"
            name="birth_date"
            type="date"
            defaultValue={d?.birth_date ?? ''}
            autoComplete="bday"
          />
          <label htmlFor="identity-kind">{t('identityKind')}</label>
          <select
            id="identity-kind"
            name="identity_kind"
            defaultValue={identity?.kind ?? 'bi'}
          >
            {['bi', 'nuit', 'passport', 'dire'].map((k) => (
              <option key={k} value={k}>
                {t(`identity.${k}`)}
              </option>
            ))}
          </select>
          <label htmlFor="identity-value">{t('identityNumber')}</label>
          <input
            id="identity-value"
            name="identity_value"
            defaultValue={identity?.value ?? ''}
            maxLength={100}
          />
          <label htmlFor="request-branch">{t('branch')}</label>
          <select
            id="request-branch"
            name="branch_id"
            defaultValue={d?.branch_id ?? site.branches[0]?.id}
          >
            {site.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {['province', 'district', 'neighbourhood', 'address'].map((key) => (
            <label key={key}>
              {t(key)}
              <input
                name={key}
                defaultValue={d?.profile[key as 'province'] ?? ''}
                maxLength={key === 'address' ? 500 : 100}
                autoComplete={key === 'address' ? 'street-address' : 'off'}
              />
            </label>
          ))}
        </fieldset>
        <fieldset data-step="1" hidden>
          <legend>{t('incomeStep')}</legend>
          <label htmlFor="request-principal">{t('amount')}</label>
          <select
            id="request-principal"
            name="principal"
            defaultValue={
              d?.principal ?? params.principal ?? p.terms.minPrincipal
            }
          >
            {[
              ...new Set(
                [
                  d?.principal,
                  params.principal,
                  p.terms.minPrincipal,
                  p.terms.maxPrincipal,
                ].filter(
                  (v): v is string =>
                    !!v &&
                    /^\d+$/.test(v) &&
                    BigInt(v) >= BigInt(p.terms.minPrincipal) &&
                    BigInt(v) <= BigInt(p.terms.maxPrincipal),
                ),
              ),
            ].map((a) => (
              <option key={a} value={a}>
                {formatMoney(BigInt(a))}
              </option>
            ))}
          </select>
          <p className="ui-help">
            <a href={`/simulate?product=${p.id}`}>{t('changeSimulation')}</a>
          </p>
          <label htmlFor="request-periods">{t('duration')}</label>
          <input
            id="request-periods"
            name="periods"
            type="number"
            min={p.terms.minPeriods}
            max={p.terms.maxPeriods}
            defaultValue={d?.periods ?? params.periods ?? p.terms.minPeriods}
            required
          />
          <p className="ui-help">{t(`periodicity.${p.terms.periodicity}`)}</p>
          <label htmlFor="purpose">{t('purpose')}</label>
          <textarea
            id="purpose"
            name="purpose"
            defaultValue={d?.purpose ?? ''}
            minLength={2}
            maxLength={2000}
          />
          {['activity', 'employer', 'income', 'expenses'].map((key) => (
            <label key={key}>
              {t(key)}
              <input
                name={key}
                inputMode={
                  ['income', 'expenses'].includes(key) ? 'decimal' : undefined
                }
                defaultValue={
                  ['income', 'expenses'].includes(key)
                    ? formatMoney(
                        BigInt(d?.profile[key as 'income'] ?? '0'),
                      ).replace(' MT', '')
                    : (d?.profile[key as 'activity'] ?? '')
                }
                maxLength={150}
              />
            </label>
          ))}
          {p.terms.requirements.guarantees.length > 0 && (
            <p>{t('guaranteeHelp')}</p>
          )}
          {p.terms.requirements.guarantees.map((g) => (
            <label className="public-checkbox" key={g}>
              <input
                type="checkbox"
                name="guarantees"
                value={g}
                defaultChecked={d?.guarantees.includes(g) ?? false}
              />
              {g}
            </label>
          ))}
        </fieldset>
        <fieldset data-step="2" hidden>
          <legend>{t('documentsStep')}</legend>
          <p>{t('uploadHelp')}</p>
          <p>
            {p.terms.requirements.documents.join(' · ') || t('noDocuments')}
          </p>
          <label htmlFor="document-title">{t('documentTitle')}</label>
          <select id="document-title" name="document_title">
            {[
              ...new Set([
                ...p.terms.requirements.documents,
                t('otherDocument'),
              ]),
            ].map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
          <label htmlFor="document-expires">{t('documentExpires')}</label>
          <input id="document-expires" name="document_expires" type="date" />
          <label htmlFor="document-file">{t('documentFile')}</label>
          <input
            id="document-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
          />
          <button
            data-upload
            type="button"
            className="ui-button ui-button-secondary"
          >
            {t('upload')}
          </button>
          <ul data-documents>
            {dash.documents.map((doc, i) => (
              <li key={i}>{doc.title}</li>
            ))}
          </ul>
        </fieldset>
        <fieldset data-step="3" hidden>
          <legend>{t('confirmation')}</legend>
          <p>{t('confirmHelp')}</p>
          <div
            data-request-summary
            className="public-result"
            aria-live="polite"
          />
          <label className="public-checkbox">
            <input name="accepted" type="checkbox" />
            {t('acceptTerms')}{' '}
            <a href="/terms" target="_blank" rel="noreferrer">
              {t('terms')}
            </a>{' '}
            ·{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">
              {t('privacy')}
            </a>
          </label>
          <p className="ui-help">{t('notApproval')}</p>
        </fieldset>
        <div className="public-form-actions">
          <button
            type="button"
            data-back
            className="ui-button ui-button-secondary"
            hidden
          >
            {t('back')}
          </button>
          <button
            type="submit"
            disabled
            data-next
            className="ui-button ui-button-primary"
          >
            {t('continue')}
          </button>
          <a href="/customer">{t('saveExit')}</a>
        </div>
        <p data-status role="status" />
        <p data-error role="alert" hidden />
      </form>
      <noscript>
        <p>{t('jsRequired')}</p>
      </noscript>
    </section>
  );
}
