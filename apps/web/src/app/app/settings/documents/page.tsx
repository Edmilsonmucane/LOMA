import { ReceiptTemplateEditor } from '@/components/payment-controls';
import { receiptTemplateSchema } from '@/lib/domain/payments';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { templateSchema } from '@/lib/domain/applications';
import { ContractTemplateEditor } from '@/components/application-controls';
export default async function DocumentsPage() {
  const { db, tenant } = await requirePermission('tenant.manage');
  const t = await getTranslations('Applications');
  const { data } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'document')
    .eq('key', 'contract')
    .single();
  const s = templateSchema.parse(data?.value);
  const p = await getTranslations('Payments');
  const { data: receipt } = await db
    .from('tenant_configuration')
    .select('value')
    .eq('tenant_id', tenant.id)
    .eq('category', 'document')
    .eq('key', 'receipt')
    .maybeSingle();
  const receiptValue = receiptTemplateSchema.parse(
    receipt?.value ?? {
      title: p('receiptDefaultTitle'),
      body: p.raw('receiptDefaultBody'),
    },
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('templates')}</h1>
          <p>{t('templateHelp')}</p>
        </div>
      </div>
      <div className="settings-form-panel">
        <ContractTemplateEditor
          title={s.title}
          body={s.body.replaceAll('\\n', '\n')}
        />
      </div>
      <div className="settings-form-panel">
        <ReceiptTemplateEditor
          title={receiptValue.title}
          body={receiptValue.body}
        />
      </div>
    </>
  );
}
