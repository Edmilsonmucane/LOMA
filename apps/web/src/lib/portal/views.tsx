import { getTranslations } from 'next-intl/server';
import { simulate, formatMoney, formatPercent } from '@loma/loan-engine';
import { getSite } from './server';
export type PublicSite = NonNullable<Awaited<ReturnType<typeof getSite>>>;
export async function Simulator({
  site,
  selected,
  principal,
  periods,
}: {
  site: PublicSite;
  selected?: string | undefined;
  principal?: string | undefined;
  periods?: string | undefined;
}) {
  const t = await getTranslations('Public');
  const p = site.products.find((p) => p.id === selected) ?? site.products[0];
  if (!p)
    return (
      <div className="public-empty">
        <p>{t('noProducts')}</p>
        <a href="/contacts">{t('contact')}</a>
      </div>
    );
  let amount = principal ?? p.terms.minPrincipal;
  let count = Number(periods ?? p.terms.minPeriods);
  let q;
  try {
    q = simulate({
      principal: BigInt(amount),
      periods: count,
      startDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Maputo',
      }).format(new Date()),
      terms: p.terms,
    });
  } catch {
    amount = p.terms.minPrincipal;
    count = p.terms.minPeriods;
    q = simulate({
      principal: BigInt(amount),
      periods: count,
      startDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Maputo',
      }).format(new Date()),
      terms: p.terms,
    });
  }
  return (
    <section className="public-simulator" id="simulator">
      <div className="public-section-heading">
        <p className="eyebrow">{t('simulation')}</p>
        <h2>{t('simulateTitle')}</h2>
        <p>{t('quoteHelp')}</p>
      </div>
      <form
        method="get"
        action="/simulate"
        data-simulator
        data-products={JSON.stringify(
          site.products.map((p) => ({
            id: p.id,
            min: p.terms.minPrincipal,
            max: p.terms.maxPrincipal,
            minPeriods: p.terms.minPeriods,
            maxPeriods: p.terms.maxPeriods,
            periodicity: p.terms.periodicity,
          })),
        )}
      >
        <label htmlFor="product">{t('product')}</label>
        <select name="product" id="product" defaultValue={p.id}>
          {site.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor="principal">{t('amount')}</label>
        <input
          id="principal"
          name="principal"
          type="range"
          min={p.terms.minPrincipal}
          max={p.terms.maxPrincipal}
          step="1"
          defaultValue={amount}
        />
        <output data-amount htmlFor="principal">
          {formatMoney(BigInt(amount))}
        </output>
        <label htmlFor="periods">{t('duration')}</label>
        <input
          id="periods"
          name="periods"
          type="range"
          min={p.terms.minPeriods}
          max={p.terms.maxPeriods}
          step="1"
          defaultValue={count}
        />
        <output data-periods htmlFor="periods">
          {count} {t(`periodicity.${p.terms.periodicity}`)}
        </output>
        <noscript>
          <button className="ui-button ui-button-secondary" type="submit">
            {t('calculate')}
          </button>
        </noscript>
        <div className="public-result" aria-live="polite" aria-atomic="true">
          <p>
            {t('payment')}
            <strong data-quote="payment">
              {formatMoney(q.instalments[0]?.total ?? 0n).slice(0, -3)}{' '}
              <span className="money-unit">
                {formatMoney(q.instalments[0]?.total ?? 0n).slice(-2)}
              </span>
            </strong>
          </p>
          <dl>
            {[
              ['total', formatMoney(q.total)],
              ['interest', formatMoney(q.interest)],
              ['fees', formatMoney(q.fees + q.taxes)],
              ['annual', formatPercent(q.annualRate)],
              ['disbursed', formatMoney(q.disbursed)],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{t(key!)}</dt>
                <dd data-quote={key}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="ui-help">{t('rounding')}</p>
          <p data-error role="alert" hidden />
        </div>
        <a
          data-request
          className="ui-button ui-button-primary"
          href={`/request?product=${p.id}&principal=${amount}&periods=${count}`}
        >
          {t('apply')}
        </a>
        <p className="ui-help">{t('notApproval')}</p>
      </form>
    </section>
  );
}
export async function PublicSection({
  site,
  section,
}: {
  site: PublicSite;
  section: string;
}) {
  const t = await getTranslations('Public');
  if (section === 'simulator') return <Simulator site={site} />;
  if (section === 'products')
    return (
      <section id="products">
        <div className="public-section-heading">
          <p className="eyebrow">{t('products')}</p>
          <h2>{t('productsTitle')}</h2>
        </div>
        <div className="public-product-list">
          {site.products.map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {formatMoney(BigInt(p.terms.minPrincipal))} —{' '}
                {formatMoney(BigInt(p.terms.maxPrincipal))}
              </p>
              <p>
                {p.terms.minPeriods}–{p.terms.maxPeriods}{' '}
                {t(`periodicity.${p.terms.periodicity}`)}
              </p>
              <a href={`/simulate?product=${p.id}`}>
                {t('viewConditions')} <span aria-hidden>→</span>
              </a>
            </article>
          ))}
          {!site.products.length && <p>{t('noProducts')}</p>}
        </div>
      </section>
    );
  if (section === 'steps')
    return (
      <section>
        <div className="public-section-heading">
          <p className="eyebrow">{t('how')}</p>
          <h2>{t('stepsTitle')}</h2>
        </div>
        <ol className="public-steps">
          {site.site.steps.map((step, i) => (
            <li key={i}>
              <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  if (section === 'faq')
    return (
      <section>
        <div className="public-section-heading">
          <h2>{t('faq')}</h2>
        </div>
        {site.site.faq.map((item, i) => (
          <details className="public-faq" key={i}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    );
  return (
    <section>
      <div className="public-section-heading">
        <h2>{t('branches')}</h2>
        <p>{t('branchesHelp')}</p>
      </div>
      {site.branches.map((b) => (
        <article className="public-branch" key={b.id}>
          <h3>{b.name}</h3>
          {b.phone && (
            <a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a>
          )}
        </article>
      ))}
    </section>
  );
}
