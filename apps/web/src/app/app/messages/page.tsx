import Link from 'next/link';
import { z } from 'zod';
import { CommunicationSearch } from '@/components/communication-search';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { MessageDrawer } from '@/components/communication-controls';
import { communicationTemplates } from '@/lib/communications';
import { formatMoney } from '@loma/loan-engine';
import { Badge } from '@loma/ui';
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, tenant } = await requirePermission('messages.manage'),
    t = await getTranslations('Communications'),
    q = await searchParams;
  const templates = await communicationTemplates(db, tenant.id);
  const { data: raw, error } = await db.rpc('message_history', {
    t: tenant.id,
    selected_state: q.state ?? '',
    query: q.q ?? '',
  });
  const data = z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        body: z.string(),
        status: z.enum([
          'queued',
          'accepted',
          'delivered',
          'failed',
          'suppressed',
          'uncertain',
        ]),
        channel: z.enum(['sms', 'whatsapp', 'email']),
        cost: z.string(),
        attempts: z.number(),
        reason: z.string().nullable(),
        created_at: z.string(),
      }),
    )
    .parse(raw);
  if (error) throw new Error('Message history lookup failed');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('messages')}</h1>
          <p>{t('messagesHelp')}</p>
        </div>
        <MessageDrawer templates={templates} />
      </div>
      <nav className="module-tabs" aria-label={t('messageSections')}>
        {['templates', 'automations', 'campaigns', 'leads'].map((x) => (
          <Link key={x} href={`/app/messages/${x}`}>
            {t(x)}
          </Link>
        ))}
      </nav>
      <form className="list-filters">
        <CommunicationSearch label={t('search')} initial={q.q ?? ''} />
        <label htmlFor="message-state">{t('status')}</label>
        <select id="message-state" name="state" defaultValue={q.state ?? ''}>
          <option value="">{t('all')}</option>
          {[
            'queued',
            'accepted',
            'delivered',
            'failed',
            'suppressed',
            'uncertain',
          ].map((x) => (
            <option key={x} value={x}>
              {t(`states.${x}`)}
            </option>
          ))}
        </select>
        <button className="ui-button ui-button-secondary">{t('filter')}</button>
      </form>
      <p className="muted">{t('historyLimit')}</p>
      <div className="message-history">
        {data?.map((x) => (
          <article className="message-row" key={x.id}>
            <div>
              <strong>{x.name}</strong>
              <p className="message-body">{x.body}</p>
              <small>
                {t(x.channel)} ·{' '}
                {x.status === 'uncertain'
                  ? t('unknownCost')
                  : formatMoney(BigInt(x.cost))}{' '}
                · {t('attempts', { count: x.attempts })}
              </small>
              {x.reason && <p className="muted">{t(`reasons.${x.reason}`)}</p>}
            </div>
            <Badge
              tone={
                ['failed', 'uncertain'].includes(x.status)
                  ? 'danger'
                  : x.status === 'accepted' || x.status === 'delivered'
                    ? 'success'
                    : 'neutral'
              }
            >
              {t(`states.${x.status}`)}
            </Badge>
          </article>
        ))}
        {!data?.length && (
          <div className="empty-module">
            <p>{t('noMessages')}</p>
            <Link
              className="ui-button ui-button-secondary"
              href="/app/messages/templates"
            >
              {t('viewTemplates')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
