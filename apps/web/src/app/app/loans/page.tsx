import Link from 'next/link';
import { can } from '@/lib/domain/tenancy';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { ApplicationList } from '@/components/application-list';
export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { permissions } = await requirePermission('loans.read');
  const paymentMode =
    (await searchParams).payment === '1' && can(permissions, 'payments.manage');
  const t = await getTranslations('Applications');
  const p = await getTranslations('Payments');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{paymentMode ? p('register') : t('loans')}</h1>
          {paymentMode && <p>{p('chooseClient')}</p>}
        </div>
        {!paymentMode && can(permissions, 'payments.manage') && (
          <Link
            className="ui-button ui-button-primary"
            href="/app/loans?payment=1"
          >
            {p('register')}
          </Link>
        )}
      </div>
      <ApplicationList kind="loans" paymentMode={paymentMode} />
    </>
  );
}
