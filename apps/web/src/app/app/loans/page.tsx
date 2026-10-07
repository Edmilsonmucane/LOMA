import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { ApplicationList } from '@/components/application-list';
export default async function LoansPage() {
  await requirePermission('loans.read');
  const t = await getTranslations('Applications');
  return (
    <>
      <div className="page-heading">
        <h1>{t('loans')}</h1>
      </div>
      <ApplicationList kind="loans" />
    </>
  );
}
