import { getTranslations } from 'next-intl/server';
import { formatMoney, formatPercent, type Quote } from '@loma/loan-engine';
import { formatDate } from '@/lib/domain/dates';
export async function LoanPlan({ quote }: { quote: Quote }) {
  const t = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  return (
    <>
      <dl className="client-facts loan-summary">
        {(
          [
            'requested',
            'disbursed',
            'total',
            'interest',
            'fees',
            'taxes',
            'separate',
            'cost',
          ] as const
        ).map((k) => (
          <div key={k}>
            <dt>{t(k === 'requested' ? 'amount' : k)}</dt>
            <dd className="numeric">{formatMoney(quote[k])}</dd>
          </div>
        ))}
        <div>
          <dt>{t('annualRate')}</dt>
          <dd>{formatPercent(quote.annualRate)}</dd>
        </div>
      </dl>
      <h2>{t('plan')}</h2>
      <div
        className="ui-table-scroll loan-plan-table"
        role="region"
        aria-label={t('plan')}
        tabIndex={0}
      >
        <table className="ui-table" aria-label={t('plan')}>
          <thead>
            <tr>
              {[
                'number',
                'date',
                'principal',
                'interestPeriod',
                'capitalisedInterest',
                'payment',
                'balance',
              ].map((k) => (
                <th
                  key={k}
                  scope="col"
                  data-align={
                    ['number', 'date'].includes(k) ? undefined : 'right'
                  }
                >
                  {t(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quote.instalments.map((x) => (
              <tr key={x.number}>
                <td>{x.number}</td>
                <td>{formatDate(x.dueDate, months)}</td>
                {[
                  x.principal,
                  x.interest,
                  x.capitalisedInterest,
                  x.total,
                  x.balance,
                ].map((v, i) => (
                  <td key={i} className="numeric" data-align="right">
                    {formatMoney(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
