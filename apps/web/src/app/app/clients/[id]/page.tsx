import Link from 'next/link';
import { ScorePanel } from '@/components/score-panel';
import { formatDate } from '@/lib/domain/dates';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@loma/ui';
import { formatMoney } from '@loma/loan-engine';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { clientSchema, formatPhone } from '@/lib/domain/clients';
import { ConsentDrawer } from '@/components/communication-controls';
import { ClientEditor } from '@/components/client-editor';
import {
  ClientActivity,
  ClientDocumentUpload,
} from '@/components/client-activity';
export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, tenant, permissions } = await requirePermission('clients.read');
  const t = await getTranslations('Clients');
  const communication = await getTranslations('Communications');
  const applications = await getTranslations('Applications');
  const { data: client } = await db
    .from('clients')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!client) notFound();
  const input = clientSchema.parse({
    name: client.name,
    branch_id: client.branch_id,
    birth_date: client.birth_date ?? '',
    classification: client.classification,
    profile: client.profile,
    consent: client.consent,
  });
  const [{ data: branches }, { data: events }, { data: documents }] =
    await Promise.all([
      db.from('branches').select('id,name').eq('tenant_id', tenant.id),
      db
        .from('client_events')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      db
        .from('client_documents')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('client_id', id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false }),
    ]);
  const photo = documents?.find((d) => d.kind === 'photo');
  const signedPhoto = photo
    ? await db.storage.from('client-documents').createSignedUrl(photo.path, 60)
    : null;
  const files = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await db.storage
        .from('client-documents')
        .createSignedUrl(doc.path, 60, { download: doc.filename });
      return { ...doc, url: data?.signedUrl };
    }),
  );
  const editable = can(permissions, 'clients.manage');
  const dateLabels = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) =>
    dateLabels(`months.${i}`),
  );
  const date = (value: string) => formatDate(value, months);
  return (
    <>
      <Link href="/app/clients" className="back-link">
        {t('back')}
      </Link>
      <div className="page-heading">
        <div className="client-heading">
          {signedPhoto?.data?.signedUrl && (
            <Image
              unoptimized
              src={signedPhoto.data.signedUrl}
              alt={t('photoOf', { name: client.name })}
              width={72}
              height={72}
            />
          )}
          <div>
            <h1>{client.name}</h1>
            <p className="ui-help">
              {branches?.find((b) => b.id === client.branch_id)?.name}
            </p>
          </div>
        </div>
        {editable && (
          <ClientEditor
            id={id}
            revision={client.revision}
            initial={input}
            branches={branches ?? []}
            defaultBranch={client.branch_id}
          />
        )}
      </div>
      <Badge
        tone={client.classification === 'blacklisted' ? 'danger' : 'neutral'}
      >
        {t(`classes.${client.classification}`)}
      </Badge>
      <div className="client-detail-grid">
        <section className="client-section">
          <h2>{t('identification')}</h2>
          <dl className="client-facts">
            <div>
              <dt>{t('birthDate')}</dt>
              <dd>
                {client.birth_date ? date(client.birth_date) : t('notProvided')}
              </dd>
            </div>
            {input.profile.identities.map((x) => (
              <div key={`${x.kind}${x.value}`}>
                <dt>{t(`identities.${x.kind}`)}</dt>
                <dd>{x.value}</dd>
              </div>
            ))}
          </dl>
          <h2>{t('contacts')}</h2>
          <dl className="client-facts">
            {input.profile.contacts.map((x) => (
              <div key={`${x.kind}${x.value}`}>
                <dt>{t(x.kind)}</dt>
                <dd>
                  {x.kind === 'phone' ? (
                    <a href={`tel:${x.value}`}>{formatPhone(x.value)}</a>
                  ) : (
                    <a href={`mailto:${x.value}`}>{x.value}</a>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="client-section">
          <h2>{t('addressTitle')}</h2>
          <dl className="client-facts">
            {(
              ['province', 'district', 'neighbourhood', 'address'] as const
            ).map((k) => (
              <div key={k}>
                <dt>{t(k)}</dt>
                <dd>{input.profile[k] || t('notProvided')}</dd>
              </div>
            ))}
          </dl>
          <h2>{t('activityTitle')}</h2>
          <dl className="client-facts">
            {(['activity', 'employer'] as const).map((k) => (
              <div key={k}>
                <dt>{t(k)}</dt>
                <dd>{input.profile[k] || t('notProvided')}</dd>
              </div>
            ))}
            {(['income', 'expenses'] as const).map((k) => (
              <div key={k}>
                <dt>{t(k)}</dt>
                <dd className="numeric">
                  {formatMoney(BigInt(input.profile[k]))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        {(['references', 'guarantors'] as const).map((k) => (
          <section key={k} className="client-section">
            <h2>{t(k)}</h2>
            {input.profile[k].length ? (
              input.profile[k].map((p, i) => (
                <div key={i}>
                  <h3>{p.name}</h3>
                  <p>
                    <a href={`tel:${p.phone}`}>{formatPhone(p.phone)}</a> ·{' '}
                    {p.relationship}
                  </p>
                </div>
              ))
            ) : (
              <p className="ui-help">{t('notProvided')}</p>
            )}
          </section>
        ))}
        <section className="client-section">
          <h2>{t('consentTitle')}</h2>
          {editable && (
            <ConsentDrawer client={{ id: client.id, name: client.name }} />
          )}
          <dl className="client-facts">
            {(['sms', 'whatsapp', 'email'] as const).map((k) => (
              <div key={k}>
                <dt>{t(`channels.${k}`)}</dt>
                <dd>
                  {t(
                    input.consent[k] &&
                      !(client.communication_blocks as Record<string, boolean>)[
                        k
                      ]
                      ? 'allowed'
                      : 'notAllowed',
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="ui-help">
            {input.consent.source || t('noConsentSource')}
          </p>
        </section>
        <section className="client-section">
          <div className="section-heading">
            <h2>{t('documents')}</h2>
            {editable && <ClientDocumentUpload id={id} />}
          </div>
          {files.length ? (
            files.map((d) => (
              <div key={d.id} className="client-document">
                <strong>{d.title}</strong>
                <span className="ui-help">
                  {d.expires_on
                    ? t('validUntil', { date: date(d.expires_on) })
                    : t('noExpiry')}
                </span>
                {d.expires_on &&
                  d.expires_on <
                    new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Africa/Maputo',
                    }).format(new Date()) && (
                    <Badge tone="warning">{t('expired')}</Badge>
                  )}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    {t('openDocument')}
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="ui-help">{t('noDocuments')}</p>
          )}
          <p className="ui-help">{t('signedHelp')}</p>
        </section>
      </div>
      <ScorePanel client={id} />
      <section className="client-section">
        <h2>{t('timeline')}</h2>
        {editable && <ClientActivity id={id} />}
        <ol className="client-timeline">
          {(events ?? []).map((event) => {
            const detail = event.detail as {
              application_id?: string;
              loan_id?: string;
              amount?: string;
              reason?: string;
              status?: string;
              note?: string;
              channel?: 'sms' | 'email' | 'whatsapp';
              message_state?: string;
              activity?: string;
              due?: string;
              title?: string;
              current?: {
                sms: boolean;
                whatsapp: boolean;
                email: boolean;
                source: string;
              };
            };
            return (
              <li key={event.id}>
                <time dateTime={event.created_at}>
                  {date(event.created_at)}
                </time>
                <div>
                  <strong>{t(`events.${event.kind}`)}</strong>
                  {event.actor_id && (
                    <span className="ui-help">
                      {' '}
                      · {event.actor_name || t('recordedByStaff')}
                    </span>
                  )}
                  {detail.application_id && detail.status && (
                    <p>
                      <Link href={`/app/applications/${detail.application_id}`}>
                        {applications(`states.${detail.status}`)}
                      </Link>
                    </p>
                  )}
                  {detail.loan_id && (
                    <p>
                      <Link href={`/app/loans/${detail.loan_id}`}>
                        {detail.amount
                          ? formatMoney(BigInt(detail.amount))
                          : applications('loans')}
                      </Link>
                      {detail.reason && <> · {detail.reason}</>}
                    </p>
                  )}
                  {detail.note && <p>{detail.note}</p>}
                  {detail.activity && (
                    <p>
                      {communication(`activities.${detail.activity}`)}
                      {detail.due ? ` · ${date(detail.due)}` : ''}
                    </p>
                  )}
                  {detail.channel && detail.message_state && (
                    <p>
                      {communication(detail.channel)} ·{' '}
                      {communication(`states.${detail.message_state}`)}
                    </p>
                  )}
                  {detail.title && <p>{detail.title}</p>}
                  {detail.current && (
                    <p>
                      {(['sms', 'whatsapp', 'email'] as const)
                        .map(
                          (k) =>
                            `${t(`channels.${k}`)}: ${t(detail.current![k] ? 'allowed' : 'notAllowed')}`,
                        )
                        .join(' · ')}
                      {detail.current.source
                        ? ` · ${detail.current.source}`
                        : ''}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
