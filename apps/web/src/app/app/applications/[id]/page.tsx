import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@loma/ui';
import { simulate, formatMoney } from '@loma/loan-engine';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { termsSchema } from '@/lib/domain/products';
import { activeProducts } from '@/lib/active-products';
import { clientSchema } from '@/lib/domain/clients';
import {
  contractQuote,
  contractSnapshotSchema,
  paymentCapacity,
} from '@/lib/domain/applications';
import { formatDate } from '@/lib/domain/dates';
import { ApplicationControls } from '@/components/application-controls';
import { ApplicationEditor } from '@/components/application-editor';
import { LoanPlan } from '@/components/loan-plan';
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, tenant, permissions, user, membership } =
    await requirePermission('applications.read');
  const t = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const { data: a } = await db
    .from('applications')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!a) notFound();
  const [
    { data: c },
    { data: v },
    { data: contract },
    { data: docs },
    { data: events },
    { data: roles },
  ] = await Promise.all([
    db
      .from('clients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', a.client_id)
      .maybeSingle(),
    db
      .from('product_versions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', a.product_version_id)
      .single(),
    db
      .from('contracts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('application_id', id)
      .maybeSingle(),
    db
      .from('client_documents')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('client_id', a.client_id)
      .eq('status', 'ready'),
    db
      .from('application_events')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('application_id', id)
      .order('created_at'),
    db.from('tenant_roles').select('key,name').eq('tenant_id', tenant.id),
  ]);
  if (!v) notFound();
  const terms = termsSchema.parse(v.terms);
  const editableProducts =
    a.status === 'draft' ? await activeProducts(db, tenant.id) : [];
  const snap = contract
    ? contractSnapshotSchema.parse(contract.snapshot)
    : null;
  const quote = snap
    ? contractQuote(snap, contract!.engine_version)
    : simulate({
        principal: BigInt(a.principal),
        periods: a.periods,
        startDate: a.start_date,
        terms,
      });
  const client = c
    ? clientSchema.parse({ ...c, birth_date: c.birth_date ?? '' })
    : null;
  const requiredRole = terms.approvalLevels.find(
    (x) => BigInt(a.principal) <= BigInt(x.upTo),
  )?.role;
  const canDecide =
    user.id !== a.created_by &&
    (membership?.tenant_roles.key === requiredRole ||
      membership?.tenant_roles.key === 'manager');
  const signed = await Promise.all(
    (docs ?? []).map(async (x) => ({
      id: x.id,
      title: x.title,
      expires: x.expires_on,
      url: (
        await db.storage
          .from('client-documents')
          .createSignedUrl(x.path, 60, { download: x.filename })
      ).data?.signedUrl,
    })),
  );
  return (
    <>
      <Link className="back-link" href="/app/applications">
        {t('back')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{snap?.client.name ?? c?.name ?? t('clientRestricted')}</h1>
          <p className="ui-help">
            {v.name} · {t('version', { version: v.version })}
          </p>
        </div>
        {contract && (
          <a
            className="ui-button ui-button-secondary"
            href={`/api/contracts/${contract.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('downloadContract')}
          </a>
        )}
        {a.status === 'draft' &&
          can(permissions, 'applications.manage') &&
          c && (
            <ApplicationEditor
              id={id}
              revision={a.revision}
              clients={[{ id: c.id, name: c.name }]}
              products={editableProducts}
              initial={{
                client_id: c.id,
                product_id: v.product_id,
                product_version_id: v.id,
                principal: a.principal,
                periods: a.periods,
                start_date: a.start_date,
                purpose: a.purpose,
                guarantees: a.guarantees,
              }}
            />
          )}
      </div>
      <Badge>{t(`states.${a.status}`)}</Badge>
      <div className="client-detail-grid">
        <section className="client-section">
          <h2>{t('analysis')}</h2>
          <dl className="client-facts">
            <div>
              <dt>{t('purpose')}</dt>
              <dd>{a.purpose}</dd>
            </div>
            <div>
              <dt>{t('startDate')}</dt>
              <dd>{formatDate(a.start_date, months)}</dd>
            </div>
            <div>
              <dt>{t('approvalRole')}</dt>
              <dd>
                {roles?.find((r) => r.key === requiredRole)?.name ??
                  t('notProvided')}
              </dd>
            </div>
            {client && (
              <>
                <div>
                  <dt>{t('income')}</dt>
                  <dd>{formatMoney(BigInt(client.profile.income))}</dd>
                </div>
                <div>
                  <dt>{t('expenses')}</dt>
                  <dd>{formatMoney(BigInt(client.profile.expenses))}</dd>
                </div>
                <div>
                  <dt>{t('capacity')}</dt>
                  <dd>
                    {paymentCapacity(
                      quote.instalments.reduce(
                        (max, x) => (x.total > max ? x.total : max),
                        0n,
                      ),
                      BigInt(client.profile.income),
                    ) ?? t('noIncome')}
                  </dd>
                </div>
                <div>
                  <dt>{t('clientClass')}</dt>
                  <dd>
                    {(await getTranslations('Clients'))(
                      `classes.${client.classification}`,
                    )}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>{t('riskScore')}</dt>
              <dd>{t('scorePending')}</dd>
            </div>
          </dl>
          {c && (
            <Link
              className="ui-button ui-button-ghost"
              href={`/app/clients/${c.id}`}
            >
              {t('openClient')}
            </Link>
          )}
          <p className="ui-help">{t('capacityHelp')}</p>
          {a.opinion && (
            <>
              <h3>{t('opinion')}</h3>
              <p>{a.opinion}</p>
            </>
          )}
          {a.decision_reason && (
            <p>{t('reason', { reason: a.decision_reason })}</p>
          )}
        </section>
        <section className="client-section">
          <h2>{t('checklist')}</h2>
          {!terms.requirements.documents.length &&
            !terms.requirements.guarantees.length && (
              <p className="ui-help">{t('noRequirements')}</p>
            )}
          <dl className="client-facts">
            {terms.requirements.minAge !== null && (
              <div>
                <dt>{t('minAge', { age: terms.requirements.minAge })}</dt>
                <dd>
                  {client?.birth_date
                    ? formatDate(client.birth_date, months)
                    : t('notProvided')}
                </dd>
              </div>
            )}
            {terms.requirements.minIncome !== null && (
              <div>
                <dt>{t('minIncome')}</dt>
                <dd>{formatMoney(BigInt(terms.requirements.minIncome))}</dd>
              </div>
            )}
          </dl>
          <ul className="requirements-list">
            {terms.requirements.documents.map((req) => (
              <li key={req}>
                <span>{req}</span>
                <Badge
                  tone={
                    docs?.some(
                      (x) =>
                        x.title.trim().toLowerCase() ===
                          req.trim().toLowerCase() &&
                        (!x.expires_on || x.expires_on >= a.start_date),
                    )
                      ? 'success'
                      : 'warning'
                  }
                >
                  {t(
                    docs?.some(
                      (x) =>
                        x.title.trim().toLowerCase() ===
                          req.trim().toLowerCase() &&
                        (!x.expires_on || x.expires_on >= a.start_date),
                    )
                      ? 'verified'
                      : 'missing',
                  )}
                </Badge>
              </li>
            ))}
            {terms.requirements.guarantees.map((req) => (
              <li key={req}>
                <span>{req}</span>
                <Badge
                  tone={a.guarantees.includes(req) ? 'success' : 'warning'}
                >
                  {t(a.guarantees.includes(req) ? 'declared' : 'missing')}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="ui-help">{t('documentsHelp')}</p>
          {signed.map((x) => (
            <div className="client-document" key={x.id}>
              <strong>{x.title}</strong>
              {x.expires && <span>{formatDate(x.expires, months)}</span>}
              {x.url && (
                <a href={x.url} target="_blank" rel="noopener noreferrer">
                  {t('openDocument')}
                </a>
              )}
            </div>
          ))}
        </section>
      </div>
      <ApplicationControls
        id={id}
        revision={a.revision}
        status={a.status}
        canManage={can(permissions, 'applications.manage')}
        canDecide={canDecide}
        canDisburse={can(permissions, 'loans.disburse')}
        startDate={a.start_date}
        initialOpinion={a.opinion}
      />
      {contract && <p className="ui-help">{t('snapshotHelp')}</p>}
      <section className="client-section">
        <h2>{t('simulation')}</h2>
        <LoanPlan quote={quote} />
      </section>
      <section className="client-section">
        <h2>{t('history')}</h2>
        <ol className="client-timeline">
          {events?.map((e) => (
            <li key={e.id}>
              <time dateTime={e.created_at}>
                {formatDate(e.created_at, months)}
              </time>
              <div>
                <strong>{t(`states.${e.status}`)}</strong>
                <span className="ui-help"> · {e.actor_name}</span>
                {e.detail && <p>{e.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
