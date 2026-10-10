import { getSite, portalDb } from '@/lib/portal/server';
import { CustomerLogin } from '@/lib/portal/login';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { formatMoney } from '@loma/loan-engine';
import { formatDate } from '@/lib/domain/dates';
import { z } from 'zod';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page() {
  const site = await getSite();
  if (!site) notFound();
  const db = await portalDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.phone_confirmed_at) return <CustomerLogin />;
  const { data, error } = await db.rpc('customer_dashboard', { t: site.id });
  if (error) return <CustomerLogin />;
  const schema = z.object({
    name: z.string().nullable(),
    drafts: z.array(z.object({ id: z.string(), revision: z.number() })),
    applications: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        principal: z.string(),
        periods: z.number(),
        date: z.string(),
        product: z.string(),
        reason: z.string(),
      }),
    ),
    loans: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        balance: z.string(),
        instalments: z.array(
          z.object({ date: z.string(), balance: z.string() }),
        ),
        payments: z.array(
          z.object({
            date: z.string(),
            amount: z.string(),
            number: z.string(),
            reversed: z.boolean(),
          }),
        ),
      }),
    ),
  });
  const dash = schema.parse(data);
  const t = await getTranslations('Public');
  const a = await getTranslations('Applications');
  const dates = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => dates(`months.${i}`));
  return (
    <section className="public-account">
      <div className="public-account-heading">
        <div>
          <p className="eyebrow">{t('customerArea')}</p>
          <h1>{dash.name ?? t('yourAccount')}</h1>
        </div>
        <button data-logout className="ui-button ui-button-secondary">
          {t('logout')}
        </button>
      </div>
      <h2>{t('yourRequests')}</h2>
      {dash.drafts.map((d) => (
        <article className="public-account-row" key={d.id}>
          <span>{t('draft')}</span>
          <a href={`/request?draft=${d.id}`}>{t('resume')}</a>
        </article>
      ))}
      {dash.applications.map((p) => (
        <article className="public-account-row" key={p.id}>
          <div>
            <h3>{p.product}</h3>
            <p>
              {t('requestNumber', { number: p.id.slice(0, 8).toUpperCase() })} ·{' '}
              {formatDate(p.date, months)}
            </p>
            <p>{formatMoney(BigInt(p.principal))}</p>
            {p.reason && <p>{p.reason}</p>}
          </div>
          <span className="ui-badge">{a(`states.${p.status}`)}</span>
        </article>
      ))}
      {!dash.drafts.length && !dash.applications.length && (
        <p>{t('noRequests')}</p>
      )}
      <a className="ui-button ui-button-primary" href="/simulate">
        {t('newRequest')}
      </a>
      <h2>{t('yourLoans')}</h2>
      {dash.loans.map((l) => (
        <article className="public-account-loan" key={l.id}>
          <h3>{a(`loanStates.${l.status}`)}</h3>
          <p>
            {t('balance')} <strong>{formatMoney(BigInt(l.balance))}</strong>
          </p>
          <h4>{t('nextInstalments')}</h4>
          <ul>
            {l.instalments
              .filter((i) => BigInt(i.balance) > 0n)
              .slice(0, 6)
              .map((i, n) => (
                <li key={n}>
                  {formatDate(i.date, months)}{' '}
                  <strong>{formatMoney(BigInt(i.balance))}</strong>
                </li>
              ))}
          </ul>
          <details>
            <summary>{t('statement')}</summary>
            <ul>
              {l.payments.map((p, n) => (
                <li key={n}>
                  {formatDate(p.date, months)} ·{' '}
                  {t('receipt', { number: p.number })}{' '}
                  <strong>{formatMoney(BigInt(p.amount))}</strong>
                  {p.reversed && <span>{t('reversed')}</span>}
                </li>
              ))}
            </ul>
            {!l.payments.length && <p>{t('noPayments')}</p>}
          </details>
        </article>
      ))}
      {!dash.loans.length && <p>{t('noLoans')}</p>}
      <aside>
        <h2>{t('agencyContact')}</h2>
        <p>{site.name}</p>
        <a href={`tel:${site.phone.replace(/\s/g, '')}`}>
          {site.phone || t('contact')}
        </a>
      </aside>
    </section>
  );
}
