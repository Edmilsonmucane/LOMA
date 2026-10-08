import Link from 'next/link';
import { MoneyText } from '@/components/money-text';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { PaymentDrawer, ReverseDrawer } from '@/components/payment-controls';
import { loadLoanBalance } from '@/lib/loan-balance';
import { can } from '@/lib/domain/tenancy';
import { formatMoney } from '@loma/loan-engine';
import { Badge } from '@loma/ui';
import { requirePermission } from '@/lib/context';
import {
  contractSnapshotSchema,
  contractQuote,
} from '@/lib/domain/applications';
import { formatDate } from '@/lib/domain/dates';
import { LoanPlan } from '@/components/loan-plan';
export default async function LoanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { permissions } = await requirePermission('loans.read');
  const t = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const loaded = await loadLoanBalance(id);
  if (!loaded) notFound();
  const { loan, balance } = loaded;
  const p = await getTranslations('Payments');
  const query = await searchParams;
  const c = loan.contracts;
  const s = contractSnapshotSchema.parse(c.snapshot);
  return (
    <>
      <Link className="back-link" href="/app/loans">
        {t('backLoans')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{s.client.name}</h1>
          <p>{s.productName}</p>
        </div>
        <div className="form-actions">
          <PaymentDrawer
            loan={id}
            client={s.client.name}
            suggested={
              balance.rows.find((r) => BigInt(r.total) > 0n)?.total ?? '0'
            }
            canPay={can(permissions, 'payments.manage')}
            initialOpen={query.payment === '1'}
          />
          <a
            className="ui-button ui-button-secondary"
            href={`/api/contracts/${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('downloadContract')}
          </a>
        </div>
      </div>
      <Badge tone={balance.status === 'overdue' ? 'danger' : 'success'}>
        {t(`loanStates.${balance.status}`)}
      </Badge>
      <dl className="client-facts payment-summary">
        <div>
          <dt>{p('balance')}</dt>
          <dd>
            <MoneyText text={formatMoney(BigInt(balance.total))} />
          </dd>
        </div>
        <div>
          <dt>{p('credit')}</dt>
          <dd>{formatMoney(BigInt(balance.credit))}</dd>
        </div>
      </dl>
      <dl className="client-facts">
        <div>
          <dt>{t('disbursedOn')}</dt>
          <dd>{formatDate(loan.disbursed_on, months)}</dd>
        </div>
        <div>
          <dt>{t('method')}</dt>
          <dd>{t(`methods.${loan.method}`)}</dd>
        </div>
        <div>
          <dt>{t('reference')}</dt>
          <dd>{loan.reference}</dd>
        </div>
        <div>
          <dt>{t('signedOn')}</dt>
          <dd>{formatDate(loan.signed_on, months)}</dd>
        </div>
      </dl>
      <p className="ui-help">{t('snapshotHelp')}</p>
      <section className="client-section">
        <h2>{p('remainingPlan')}</h2>
        <div
          className="ui-table-scroll loan-plan-table"
          role="region"
          aria-label={p('remainingPlan')}
          tabIndex={0}
        >
          <table className="ui-table">
            <thead>
              <tr>
                {[
                  'number',
                  'date',
                  'principal',
                  'interest',
                  'fine',
                  'lateInterest',
                  'total',
                ].map((k) => (
                  <th key={k}>{p(k === 'interest' ? 'interestCharges' : k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balance.rows.map((r) => (
                <tr key={r.number}>
                  <td>{r.number === 0 ? p('separate') : r.number}</td>
                  <td>{formatDate(r.dueDate, months)}</td>
                  {(
                    [
                      'principal',
                      'interest',
                      'fine',
                      'lateInterest',
                      'total',
                    ] as const
                  ).map((k) => (
                    <td key={k} data-align="right">
                      {formatMoney(BigInt(r[k]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="client-section">
        <h2>{p('statement')}</h2>
        {!balance.payments.length ? (
          <p>{p('noPayments')}</p>
        ) : (
          <div className="payment-statement">
            {balance.payments.map((r) => (
              <div key={r.id}>
                <span>
                  <strong>{formatMoney(BigInt(r.amount))}</strong>
                  <p>
                    {formatDate(r.date, months)} · {t(`methods.${r.method}`)} ·{' '}
                    {r.reference}
                  </p>
                </span>
                <div className="form-actions">
                  {r.reversed && <Badge>{p('reversed')}</Badge>}
                  <a
                    className="ui-button ui-button-secondary"
                    href={`/api/receipts/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p('receipt')} {r.number}
                  </a>
                  {!r.reversed && can(permissions, 'payments.reverse') && (
                    <ReverseDrawer id={r.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <details className="client-section">
        <summary>{t('plan')}</summary>
        <LoanPlan quote={contractQuote(s, c.engine_version)} />
      </details>
    </>
  );
}
