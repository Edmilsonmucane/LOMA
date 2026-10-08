import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { cashSchema } from '@/lib/domain/payments';
import { CashControl } from '@/components/cash-controls';
import { formatMoney } from '@loma/loan-engine';
import { Badge } from '@loma/ui';
export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { db, tenant, permissions } = await getTenantContext();
  if (!can(permissions, 'cash.manage') && !can(permissions, 'reports.read'))
    notFound();
  const t = await getTranslations('Cash');
  const a = await getTranslations('Applications');
  const query = await searchParams;
  const { data: branches } = await db
    .from('branches')
    .select('id,name')
    .eq('tenant_id', tenant.id)
    .order('name');
  const branch = branches?.find((b) => b.id === query.branch) ?? branches?.[0];
  if (!branch) return null;
  const { data, error } = await db.rpc('cash_summary', {
    t: tenant.id,
    b: branch.id,
  });
  if (error) throw new Error('Cash summary unavailable');
  const cash = data ? cashSchema.parse(data) : null;
  return (
    <>
      <Link className="back-link" href="/app">
        {t('back')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('help')}</p>
        </div>
        {can(permissions, 'cash.manage') &&
          (!cash ? (
            <CashControl branch={branch.id} operation="open" />
          ) : !cash.closed ? (
            <CashControl
              branch={branch.id}
              operation="close"
              expected={cash.expected}
            />
          ) : (
            <Badge>{t('closed')}</Badge>
          ))}
      </div>
      <nav className="branch-tabs" aria-label={t('branch')}>
        {branches?.map((b) => (
          <Link
            key={b.id}
            href={`/app/cash?branch=${b.id}`}
            aria-current={b.id === branch.id ? 'page' : undefined}
          >
            {b.name}
          </Link>
        ))}
      </nav>
      {!cash ? (
        <p>{t('notOpen')}</p>
      ) : (
        <>
          <dl className="client-facts">
            <div>
              <dt>{t('opening')}</dt>
              <dd>{formatMoney(BigInt(cash.opening))}</dd>
            </div>
            <div>
              <dt>{t('expected')}</dt>
              <dd>{formatMoney(BigInt(cash.expected))}</dd>
            </div>
            {cash.closed && (
              <>
                <div>
                  <dt>{t('counted')}</dt>
                  <dd>{formatMoney(BigInt(cash.counted ?? '0'))}</dd>
                </div>
                <div>
                  <dt>{t('difference')}</dt>
                  <dd>
                    {formatMoney(
                      BigInt(cash.counted ?? '0') - BigInt(cash.expected),
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {cash.reason && <p>{cash.reason}</p>}
          {!cash.closed && can(permissions, 'cash.manage') && (
            <CashControl branch={branch.id} operation="deposit" />
          )}
          <section className="client-section">
            <h2>{t('movements')}</h2>
            {!cash.movements.length ? (
              <p>{t('noMovements')}</p>
            ) : (
              <div
                className="ui-table-scroll loan-plan-table"
                role="region"
                aria-label={t('movements')}
                tabIndex={0}
              >
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>{t('movements')}</th>
                      <th>{t('method')}</th>
                      <th>{t('referenceColumn')}</th>
                      <th>{t('amountColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cash.movements.map((r) => (
                      <tr key={r.id}>
                        <td>{t(`sources.${r.source}`)}</td>
                        <td>{a(`methods.${r.method}`)}</td>
                        <td>{r.reference}</td>
                        <td data-align="right">
                          {formatMoney(BigInt(r.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
