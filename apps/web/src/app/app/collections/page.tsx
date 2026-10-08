import Link from 'next/link';
import { CommunicationSearch } from '@/components/communication-search';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { collectionRowSchema, rulesSchema } from '@/lib/domain/communications';
import {
  CollectionDrawer,
  MessageDrawer,
} from '@/components/communication-controls';
import { communicationTemplates } from '@/lib/communications';
import { PaymentDrawer } from '@/components/payment-controls';
import { formatDate } from '@/lib/domain/dates';
import { formatMoney } from '@loma/loan-engine';
export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, tenant, permissions, membership } =
      await requirePermission('collections.manage'),
    t = await getTranslations('Communications'),
    q = await searchParams;
  const dates = await getTranslations('Dates'),
    months = Array.from({ length: 12 }, (_, i) => dates(`months.${i}`));
  const { data: config } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'communication')
    .eq('key', 'rules')
    .single();
  const rules = rulesSchema.parse(config?.value),
    parsedBucket = z.coerce
      .number()
      .int()
      .min(0)
      .max(rules.buckets.length)
      .safeParse(q.bucket),
    bucket =
      q.bucket === undefined || q.bucket === 'all' || !parsedBucket.success
        ? null
        : parsedBucket.data,
    min = bucket === null ? 1 : bucket ? rules.buckets[bucket - 1]! + 1 : 1,
    max = bucket === null ? 100000 : (rules.buckets[bucket] ?? 100000);
  const { data, error } = await db.rpc('collections_summary', {
    t: tenant.id,
    query: q.q ?? '',
    min_days: min,
    max_days: max,
    only_mine: q.mine === '1',
  });
  if (error) throw new Error('Collection lookup failed');
  const rows = z.array(collectionRowSchema).parse(data);
  const { data: targetsData, error: targetsError } = await db.rpc(
    'collection_targets',
    { t: tenant.id },
  );
  if (targetsError) throw new Error('Collection target lookup failed');
  const targets = z
    .array(
      z.object({
        user_id: z.uuid(),
        name: z.string(),
        target: z.string(),
        received: z.string(),
      }),
    )
    .parse(targetsData);
  const templates = await communicationTemplates(db, tenant.id);
  const { data: members } = await db
    .from('memberships')
    .select('user_id,display_name,branch_id,tenant_roles(permissions)')
    .eq('tenant_id', tenant.id)
    .eq('active', true);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('collections')}</h1>
          <p>{t('collectionsHelp')}</p>
        </div>
      </div>
      {!!targets.length && (
        <details className="collection-targets">
          <summary>{t('agentTargets')}</summary>
          <p className="muted">{t('targetsHelp')}</p>
          {targets.map((x) => (
            <div className="message-row" key={x.user_id}>
              <strong>{x.name}</strong>
              <span>
                {t('target')}: {formatMoney(BigInt(x.target))} · {t('received')}
                : {formatMoney(BigInt(x.received))}
              </span>
            </div>
          ))}
        </details>
      )}
      <form className="list-filters" action="/app/collections">
        <CommunicationSearch label={t('search')} initial={q.q ?? ''} />
        <label htmlFor="collection-bucket">{t('bucket')}</label>
        <select
          id="collection-bucket"
          name="bucket"
          defaultValue={bucket === null ? 'all' : String(bucket)}
        >
          <option value="all">{t('all')}</option>
          {[...rules.buckets, 100000].map((n, i) => (
            <option key={i} value={i}>
              {i === 0
                ? t('upToDays', { days: n })
                : n === 100000
                  ? t('overDays', { days: rules.buckets[i - 1]! })
                  : t('betweenDays', {
                      from: rules.buckets[i - 1]! + 1,
                      to: n,
                    })}
            </option>
          ))}
        </select>
        <label className="switch-row">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={q.mine === '1'}
          />
          {t('myPortfolio')}
        </label>
        <button className="ui-button ui-button-secondary">{t('filter')}</button>
        <Link href="/app/collections" className="ui-button ui-button-ghost">
          {t('all')}
        </Link>
      </form>
      <p className="muted">{t('collectionLimit')}</p>
      <div className="collection-list">
        {rows.map((row) => (
          <article className="collection-row" key={row.id}>
            <div>
              <Link className="client-name" href={`/app/loans/${row.id}`}>
                {row.name}
              </Link>
              <p className="overdue-label">
                {t('lateDays', { days: row.days })} ·{' '}
                {formatMoney(BigInt(row.amount))}
              </p>
              {row.assigned_to && (
                <small>
                  {members?.find((x) => x.user_id === row.assigned_to)
                    ?.display_name ?? t('agent')}{' '}
                  · {t('target')}: {formatMoney(BigInt(row.target))}
                </small>
              )}
              {row.activities[0] && (
                <p className="muted">
                  {t(`activities.${row.activities[0].kind}`)} ·{' '}
                  {row.activities[0].note}
                  {row.activities[0].due
                    ? ` · ${formatDate(row.activities[0].due, months)}`
                    : ''}
                </p>
              )}
            </div>
            <div className="form-actions">
              {row.phone && (
                <a
                  className="ui-button ui-button-ghost"
                  href={`tel:${row.phone}`}
                >
                  {t('call')}
                </a>
              )}
              <MessageDrawer
                templates={templates}
                client={{ id: row.client_id, name: row.name }}
                loan={row.id}
              />
              <CollectionDrawer
                row={row}
                canAssign={can(permissions, 'tenant.manage')}
                members={(members ?? [])
                  .filter((x) => !x.branch_id || x.branch_id === row.branch_id)
                  .map((x) => ({ id: x.user_id, name: x.display_name }))}
              />
              {can(permissions, 'payments.manage') && (
                <PaymentDrawer
                  loan={row.id}
                  suggested={row.amount}
                  client={row.name}
                  canPay
                />
              )}
            </div>
          </article>
        ))}
        {!rows.length && (
          <div className="empty-module">
            <p>{t('noOverdue')}</p>
            <Link className="ui-button ui-button-secondary" href="/app/loans">
              {t('viewLoans')}
            </Link>
          </div>
        )}
      </div>
      {membership?.branch_id && <p className="muted">{t('branchScope')}</p>}
    </>
  );
}
