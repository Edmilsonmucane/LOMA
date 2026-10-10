import Link from 'next/link';
import { z } from 'zod';
import { formatMoney } from '@loma/loan-engine';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import {
  reportFilterSchema,
  reportKinds,
  reportColumns,
  reportSummaryColumns,
  reportCell,
} from '@/lib/domain/reports';
import { readReport } from '@/lib/reports';
import { maputoToday } from '@/lib/domain/dates';
import { EmptyState } from '@loma/ui';
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, tenant } = await requirePermission('reports.read');
  const t = await getTranslations('Reports'),
    dates = await getTranslations('Dates');
  const raw = await searchParams,
    today = maputoToday();
  const defaults = {
    kind: 'arrears',
    from: today.slice(0, 8) + '01',
    to: today,
    branch: '',
    product: '',
    agent: '',
    client: '',
  };
  const parsed = reportFilterSchema.safeParse({ ...defaults, ...raw });
  const filter = parsed.success ? parsed.data : null;
  const result = filter ? await readReport(filter) : null;
  const clientSearch = typeof raw.q === 'string' ? raw.q.slice(0, 100) : '';
  const { data: optionData } = await db.rpc('report_filter_options', {
    t: tenant.id,
    q: clientSearch,
    ...(filter?.client ? { selected: filter.client } : {}),
  });
  const choice = z.array(z.object({ id: z.uuid(), name: z.string() }));
  const options = z
    .object({
      branches: choice,
      products: choice,
      agents: choice,
      clients: choice,
    })
    .parse(optionData);
  const values = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(raw).filter(([, v]) => typeof v === 'string'),
    ),
  };
  const labels = Object.fromEntries(
    [
      'bucket',
      'count',
      'principal',
      'balance',
      'provision',
      'date',
      'source',
      'amount',
      'client',
      'product',
      'branch',
      'agent',
      'reference',
      'state',
      'opening',
      'expected',
      'counted',
      'difference',
      'reason',
      'payment',
      'disbursement',
      'reversal',
      'open',
      'closed',
    ].map((k) => [k, t(k)]),
  );
  const months = Array.from({ length: 12 }, (_, i) => dates(`months.${i}`));
  const report = result?.report;
  const query = filter ? new URLSearchParams(filter).toString() : '';
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('help')}</p>
        </div>
      </div>
      <form className="report-filters" method="get">
        <label>
          {t('type')}
          <select aria-label={t('type')} name="kind" defaultValue={values.kind}>
            {reportKinds.map((k) => (
              <option key={k} value={k}>
                {t(`types.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('from')}
          <input name="from" type="date" defaultValue={values.from} required />
        </label>
        <label>
          {t('to')}
          <input name="to" type="date" defaultValue={values.to} required />
        </label>
        {(['branch', 'product', 'agent', 'client'] as const).map((k) => (
          <label key={k}>
            {t(k)}
            <select aria-label={t(k)} name={k} defaultValue={values[k]}>
              <option value="">{t('all')}</option>
              {(k === 'branch'
                ? options.branches
                : k === 'product'
                  ? options.products
                  : k === 'agent'
                    ? options.agents
                    : options.clients
              ).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          {t('clientSearch')}
          <input name="q" maxLength={100} defaultValue={clientSearch} />
        </label>
        <button className="ui-button ui-button-primary" type="submit">
          {t('apply')}
        </button>
      </form>
      <p className="ui-help">{t('filterHelp')}</p>
      {!report ? (
        <p className="ui-error" role="alert">
          {t(`errors.${result?.error ?? 'invalid'}`)}
        </p>
      ) : (
        <>
          <div className="report-toolbar">
            <div>
              <h2>{t(`types.${report.kind}`)}</h2>
              <p>
                {t('asOf', {
                  date: reportCell('date', report.asOf, labels, months),
                })}{' '}
                · {t('rows', { count: report.count })}
              </p>
            </div>
            <div className="row-actions">
              <Link
                className="ui-button ui-button-secondary"
                href={`/api/reports?${query}&format=csv`}
              >
                {t('csv')}
              </Link>
              <Link
                className="ui-button ui-button-secondary"
                href={`/api/reports?${query}&format=pdf`}
              >
                {t('pdf')}
              </Link>
            </div>
          </div>
          {report.truncated && <p role="status">{t('truncated')}</p>}
          {!report.rows.length ? (
            <EmptyState
              title={t('empty')}
              description={t('emptyHelp')}
              action={null}
            />
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label={t(`types.${report.kind}`)}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    {reportColumns[report.kind].map((c) => (
                      <th key={c}>{labels[c]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={i}>
                      {reportColumns[report.kind].map((c) => (
                        <td key={c} className="tabular">
                          {reportCell(c, r[c] ?? '', labels, months)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="report-totals">
            {reportSummaryColumns[report.kind].map((key) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd className="tabular">
                  {formatMoney(BigInt(report.summary[key] ?? '0'))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="ui-help">
            {t('balanceHelp')}{' '}
            {['arrears', 'portfolio'].includes(report.kind) &&
              t('provisionHelp', {
                basis: t(
                  report.provisionBasis === 'principal'
                    ? 'principal'
                    : 'balance',
                ),
              })}
          </p>
        </>
      )}
    </>
  );
}
