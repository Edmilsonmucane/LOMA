import Link from 'next/link';
import { MessageDrawer } from '@/components/communication-controls';
import { communicationTemplates } from '@/lib/communications';
import { MoneyText } from '@/components/money-text';
import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { todaySchema } from '@/lib/domain/payments';
import { formatMoney } from '@loma/loan-engine';
import { formatDate } from '@/lib/domain/dates';
export default async function TodayPage() {
  const { db, tenant, permissions } = await getTenantContext();
  const t = await getTranslations('Today');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const { data, error } = await db.rpc('today_summary', { t: tenant.id });
  if (error) throw new Error('Today summary unavailable');
  const s = todaySchema.parse(data);
  const canMessage =
    can(permissions, 'messages.manage') ||
    can(permissions, 'collections.manage');
  const templates = canMessage
    ? await communicationTemplates(db, tenant.id)
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('help')}</p>
        </div>
        {(can(permissions, 'cash.manage') ||
          can(permissions, 'reports.read')) && (
          <Link className="ui-button ui-button-secondary" href="/app/cash">
            {t('cashView')}
          </Link>
        )}
      </div>
      <div className="today-summary">
        {(['due', 'overdue', 'pending', 'disbursed'] as const).map((k) => (
          <div key={k}>
            <span>{t(k)}</span>
            <strong className="numeric">
              {s[k] === null ? (
                t('unavailable')
              ) : k === 'pending' ? (
                s.pending
              ) : (
                <MoneyText text={formatMoney(BigInt(s[k] ?? '0'))} />
              )}
            </strong>
          </div>
        ))}
      </div>
      <section className="client-section">
        <h2>{t('attention')}</h2>
        {s.pending !== null && s.pending > 0 && (
          <div className="attention-row">
            <strong>
              {t('pending')}: {s.pending}
            </strong>
            <Link
              className="ui-button ui-button-secondary"
              href="/app/applications"
            >
              {t('reviewApplications')}
            </Link>
          </div>
        )}
        {!s.attention.length && <p className="ui-help">{t('empty')}</p>}
        {s.attention.map((r) => (
          <div className="attention-row" key={r.id}>
            <span>
              <strong>{r.name}</strong>
              <p>
                {formatMoney(BigInt(r.amount))} ·{' '}
                {formatDate(r.due_date, months)}
              </p>
            </span>
            <div className="form-actions">
              {canMessage && (
                <MessageDrawer
                  templates={templates}
                  client={{ id: r.client_id, name: r.name }}
                  loan={r.id}
                />
              )}
              {r.phone && /^\+?[0-9 ]+$/.test(r.phone) && (
                <a
                  className="ui-button ui-button-secondary"
                  href={`tel:${r.phone.replaceAll(' ', '')}`}
                >
                  {t('call')}
                </a>
              )}
              <Link
                className="ui-button ui-button-primary"
                href={`/app/loans/${r.id}${can(permissions, 'payments.manage') ? '?payment=1' : ''}`}
              >
                {t(can(permissions, 'payments.manage') ? 'payment' : 'loan')}
              </Link>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
