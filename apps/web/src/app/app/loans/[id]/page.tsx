import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, tenant } = await requirePermission('loans.read');
  const t = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const { data: loan } = await db
    .from('loans')
    .select('*,contracts(*)')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!loan) notFound();
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
        <a
          className="ui-button ui-button-secondary"
          href={`/api/contracts/${c.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('downloadContract')}
        </a>
      </div>
      <Badge tone="success">{t(`loanStates.${loan.status}`)}</Badge>
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
      <LoanPlan quote={contractQuote(s, c.engine_version)} />
    </>
  );
}
