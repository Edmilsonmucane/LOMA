'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, Button, EmptyState, Field, Table, Skeleton } from '@loma/ui';
import { ClientEditor } from './client-editor';
import { ClientImport } from './client-import';

import { formatPhone, type ClientSummary } from '@/lib/domain/clients';
export type ClientRow = ClientSummary;
export function ClientsList({
  initial,
  branches,
  canManage,
  defaultBranch,
}: {
  initial: ClientRow[];
  branches: { id: string; name: string }[];
  canManage: boolean;
  defaultBranch: string;
}) {
  const t = useTranslations('Clients');
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [classification, setClassification] = useState('');
  const [branch, setBranch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(
          `/api/clients/search?${new URLSearchParams({ q, classification, branch, offset: String(offset) })}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        setRows(data.clients);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, classification, branch, offset, initial]);
  return (
    <>
      <div className="client-tools">
        <Field
          label={t('search')}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <label className="ui-field">
          <span className="ui-label">{t('classification')}</span>
          <select
            className="ui-input"
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">{t('all')}</option>
            {['regular', 'vip', 'blacklisted'].map((k) => (
              <option key={k} value={k}>
                {t(`classes.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-label">{t('branch')}</span>
          <select
            className="ui-input"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">{t('allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {canManage && (
          <ClientEditor branches={branches} defaultBranch={defaultBranch} />
        )}
      </div>
      {canManage && (
        <ClientImport branches={branches} defaultBranch={defaultBranch} />
      )}
      <p className="ui-help" aria-live="polite">
        {t('range', {
          from: rows.length ? offset + 1 : 0,
          to: offset + rows.length,
        })}
      </p>
      {error ? (
        <p role="alert">{t('errors.failed')}</p>
      ) : loading ? (
        <Skeleton label={t('loading')} />
      ) : rows.length ? (
        <Table
          label={t('title')}
          rows={rows}
          columns={[
            {
              key: 'name',
              heading: t('name'),
              render: (row) => (
                <Link className="client-name" href={`/app/clients/${row.id}`}>
                  {row.name}
                </Link>
              ),
            },
            {
              key: 'phone',
              heading: t('phone'),
              render: (row) =>
                formatPhone(
                  row.profile.contacts.find((c) => c.kind === 'phone')?.value ??
                    '',
                ),
            },
            {
              key: 'place',
              heading: t('province'),
              render: (row) => row.profile.province,
            },
            {
              key: 'classification',
              heading: t('classification'),
              render: (row) => (
                <Badge
                  tone={
                    row.classification === 'blacklisted' ? 'danger' : 'neutral'
                  }
                >
                  {t(`classes.${row.classification}`)}
                </Badge>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title={t('empty')}
          description={t('emptyHelp')}
          action={null}
        />
      )}
      <div className="client-pagination">
        <Button
          variant="ghost"
          disabled={!offset || loading}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          {t('previous')}
        </Button>
        <Button
          variant="ghost"
          disabled={rows.length < 50 || loading}
          onClick={() => setOffset(offset + 50)}
        >
          {t('next')}
        </Button>
      </div>
    </>
  );
}
