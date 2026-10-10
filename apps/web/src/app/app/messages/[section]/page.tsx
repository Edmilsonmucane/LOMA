import { formatPhone } from '@/lib/domain/clients';
import Link from 'next/link';
import { formatDate } from '@/lib/domain/dates';
import { CommunicationSearch } from '@/components/communication-search';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { automationSchema, leadSchema } from '@/lib/domain/communications';
import { communicationTemplates } from '@/lib/communications';
import {
  TemplateDrawer,
  AutomationDrawer,
  CampaignDrawer,
  CancelCampaign,
  LeadDrawer,
} from '@/components/communication-controls';
export default async function MessageSection({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  if (!['templates', 'automations', 'campaigns', 'leads'].includes(section))
    notFound();
  const { db, tenant, permissions } =
      await requirePermission('messages.manage'),
    t = await getTranslations('Communications'),
    q = await searchParams;
  const dates = await getTranslations('Dates'),
    months = Array.from({ length: 12 }, (_, i) => dates(`months.${i}`));
  const templates = await communicationTemplates(db, tenant.id),
    manage = can(permissions, 'tenant.manage');
  const { data: branches } = await db
    .from('branches')
    .select('id,name')
    .eq('tenant_id', tenant.id)
    .order('name');
  const { data: products } = await db
    .from('products')
    .select('id,name')
    .eq('tenant_id', tenant.id);
  const { data: autos } =
    section === 'automations'
      ? await db
          .from('tenant_configuration')
          .select('key,value')
          .eq('tenant_id', tenant.id)
          .eq('category', 'automation')
          .order('key')
      : { data: null };
  const { data: campaigns } =
    section === 'campaigns'
      ? await db
          .from('campaigns')
          .select('id,name,status,channel,scheduled_at')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: null };
  let leadsQuery = db
    .from('leads')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (q.q)
    leadsQuery = leadsQuery.ilike(
      'name',
      `%${q.q.replaceAll('%', '').replaceAll('_', '')}%`,
    );
  const { data: leads } =
    section === 'leads' ? await leadsQuery : { data: null };
  return (
    <>
      <Link className="back-link" href="/app/messages">
        {t('backMessages')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t(section)}</h1>
          <p>{t(`${section}Help`)}</p>
        </div>
        {section === 'templates' && manage && <TemplateDrawer />}
        {section === 'campaigns' && (
          <CampaignDrawer
            branches={branches ?? []}
            templates={templates}
            products={products ?? []}
          />
        )}{' '}
        {section === 'leads' && <LeadDrawer branches={branches ?? []} />}
      </div>
      <nav className="module-tabs" aria-label={t('messageSections')}>
        {['templates', 'automations', 'campaigns', 'leads'].map((x) => (
          <Link
            aria-current={section === x ? 'page' : undefined}
            key={x}
            href={`/app/messages/${x}`}
          >
            {t(x)}
          </Link>
        ))}
      </nav>
      {section === 'templates' && (
        <div className="message-history">
          {templates.map((x) => (
            <article className="message-row" key={x.key}>
              <div>
                <strong>{x.value.name}</strong>
                <p className="message-body">{x.value.body}</p>
                <small>{t(x.value.active ? 'active' : 'inactive')}</small>
              </div>
              {manage && <TemplateDrawer item={x} />}
            </article>
          ))}
        </div>
      )}
      {section === 'automations' && (
        <div className="message-history">
          {autos?.map((x) => {
            const value = automationSchema.parse(x.value);
            return (
              <article className="message-row" key={x.key}>
                <div>
                  <strong>{t(`events.${value.event}`)}</strong>
                  <p>
                    {value.event === 'due'
                      ? t('relativeDay', { days: value.offsetDays })
                      : templates.find((y) => y.key === value.template)?.value
                          .name}
                  </p>
                  <small>
                    {t(value.enabled ? 'active' : 'inactive')} ·{' '}
                    {t(value.channel)}
                  </small>
                </div>
                {manage && (
                  <AutomationDrawer
                    item={{ key: x.key, value }}
                    templates={templates}
                  />
                )}
              </article>
            );
          })}
          <Link
            className="ui-button ui-button-secondary"
            href="/app/settings/communication"
          >
            {t('rules')}
          </Link>
        </div>
      )}
      {section === 'campaigns' && (
        <div className="message-history">
          {campaigns?.map((x) => (
            <article className="message-row" key={x.id}>
              <div>
                <strong>{x.name}</strong>
                <p>
                  {t(`campaignStates.${x.status}`)} · {t(x.channel)}
                </p>
                <small>
                  {formatDate(
                    new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Africa/Maputo',
                    }).format(new Date(x.scheduled_at)),
                    months,
                  )}{' '}
                  ·{' '}
                  {new Intl.DateTimeFormat('pt-MZ', {
                    timeZone: 'Africa/Maputo',
                    timeStyle: 'short',
                  }).format(new Date(x.scheduled_at))}
                </small>
              </div>
              {x.status !== 'cancelled' && <CancelCampaign id={x.id} />}
            </article>
          ))}
          {!campaigns?.length && <p>{t('noCampaigns')}</p>}
        </div>
      )}
      {section === 'leads' && (
        <>
          <form className="list-filters">
            <CommunicationSearch label={t('search')} initial={q.q ?? ''} />
            <button className="ui-button ui-button-secondary">
              {t('filter')}
            </button>
          </form>
          <div className="message-history">
            {leads?.map((x) => (
              <article className="message-row" key={x.id}>
                <div>
                  <strong>{x.name}</strong>
                  <p>
                    {formatPhone(x.phone)} · {x.origin}
                  </p>
                  <small>{t(`leadStates.${x.status}`)}</small>
                  {x.client_id && (
                    <Link href={`/app/clients/${x.client_id}`}>
                      {t('viewClient')}
                    </Link>
                  )}
                </div>
                <LeadDrawer
                  branches={branches ?? []}
                  item={{
                    id: x.id,
                    revision: x.revision,
                    value: leadSchema.parse({
                      branch: x.branch_id,
                      name: x.name,
                      phone: x.phone,
                      origin: x.origin,
                      status: x.status,
                      client: x.client_id ?? '',
                      consent: x.consent,
                    }),
                  }}
                />
              </article>
            ))}
            {!leads?.length && <p>{t('noLeads')}</p>}
          </div>
        </>
      )}
    </>
  );
}
