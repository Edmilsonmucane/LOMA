'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Field, Table, Skeleton, EmptyState } from '@loma/ui';
import { formatMoney } from '@loma/loan-engine';
import { applicationStates, loanStates } from '@/lib/domain/applications';
import { formatDate } from '@/lib/domain/dates';
type Row = {
  id: string;
  status: string;
  principal: string;
  periods: number;
  start_date: string;
  created_at: string;
  client_name: string;
  product_name: string;
};
export function ApplicationList({
  kind = 'applications',
}: {
  kind?: 'applications' | 'loans';
}) {
  const states = kind === 'loans' ? loanStates : applicationStates;
  const stateKey = kind === 'loans' ? 'loanStates' : 'states';
  const t = useTranslations('Applications');
  const d = useTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [board, setBoard] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await fetch(
          `/api/${kind}?${new URLSearchParams({ q: query, state: status, offset: String(offset) })}`,
          { signal: abort.signal },
        );
        if (!r.ok) throw new Error();
        setRows(await r.json());
      } catch {
        if (!abort.signal.aborted) setError(true);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, status, offset, retry, kind]);
  const visible = rows.slice(0, 50);
  return (
    <>
      <div className="client-filters">
        <Field
          label={t(kind === 'loans' ? 'searchLoans' : 'search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
        />
        <label className="ui-field">
          <span className="ui-label">{t('state')}</span>
          <select
            className="ui-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">{t('allStates')}</option>
            {states.map((s) => (
              <option value={s} key={s}>
                {t(`${stateKey}.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {kind === 'applications' && (
          <>
            {' '}
            <Button
              variant="secondary"
              aria-pressed={board}
              onClick={() => setBoard(!board)}
            >
              {t(board ? 'list' : 'board')}
            </Button>
          </>
        )}
      </div>
      {loading ? (
        <div
          className="application-loading"
          aria-label={t(kind === 'loans' ? 'loadingLoans' : 'loading')}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="application-row-skeleton" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title={t('loadError')}
          description={t('retryHelp')}
          action={
            <Button onClick={() => setRetry(retry + 1)}>{t('retry')}</Button>
          }
        />
      ) : !visible.length ? (
        <EmptyState
          title={t(kind === 'loans' ? 'noLoans' : 'empty')}
          description={t(kind === 'loans' ? 'noLoansHelp' : 'emptyHelp')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setStatus('');
                setOffset(0);
              }}
            >
              {t('clearFilters')}
            </Button>
          }
        />
      ) : board ? (
        <div className="application-board">
          {states
            .filter((s) => visible.some((r) => r.status === s))
            .map((s) => (
              <section key={s}>
                <h2>{t(`${stateKey}.${s}`)}</h2>
                {visible
                  .filter((r) => r.status === s)
                  .map((r) => (
                    <Link
                      className="application-card"
                      href={`/app/${kind}/${r.id}`}
                      key={r.id}
                    >
                      <strong>{r.client_name}</strong>
                      <span className="ui-help">{r.product_name}</span>
                      <span className="numeric">
                        {formatMoney(BigInt(r.principal))}
                      </span>
                    </Link>
                  ))}
              </section>
            ))}
        </div>
      ) : (
        <Table
          label={t(kind === 'loans' ? 'loans' : 'title')}
          rows={visible}
          columns={[
            {
              key: 'client',
              heading: t('client'),
              render: (r) => (
                <Link className="client-name" href={`/app/${kind}/${r.id}`}>
                  {r.client_name}
                </Link>
              ),
            },
            {
              key: 'product',
              heading: t('product'),
              render: (r) => r.product_name,
            },
            {
              key: 'amount',
              heading: t('amount'),
              align: 'right',
              render: (r) => formatMoney(BigInt(r.principal)),
            },
            {
              key: 'date',
              heading: t(kind === 'loans' ? 'disbursedOn' : 'startDate'),
              render: (r) => formatDate(r.start_date, months),
            },
            {
              key: 'status',
              heading: t('state'),
              render: (r) => (
                <Badge
                  tone={
                    ['approved', 'active'].includes(r.status)
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {t(`${stateKey}.${r.status}`)}
                </Badge>
              ),
            },
          ]}
        />
      )}
      <div className="form-actions">
        <Button
          variant="ghost"
          disabled={!offset || loading}
          onClick={() => setOffset(offset - 50)}
        >
          {t('previous')}
        </Button>
        <span className="ui-help">{t('page', { page: offset / 50 + 1 })}</span>
        <Button
          variant="ghost"
          disabled={rows.length <= 50 || loading}
          onClick={() => setOffset(offset + 50)}
        >
          {t('next')}
        </Button>
      </div>
      {board && <p className="ui-help">{t('boardHelp')}</p>}
    </>
  );
}
