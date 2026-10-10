import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { contractSnapshotSchema } from '@/lib/domain/applications';
import { contractPdf } from '@/lib/documents/contract-pdf';
import { z } from 'zod';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const { db, tenant } = await getTenantContext();
  const { data } = await db
    .from('contracts')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!data) return new Response(null, { status: 404 });
  const { error: accessError } = await db.rpc('log_contract_access', {
    t: tenant.id,
    c_id: id,
  });
  if (accessError) return new Response(null, { status: 403 });
  const t = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const keys = [
    'contract',
    'approvedOn',
    'license',
    'versionLabel',
    'amount',
    'disbursed',
    'total',
    'interest',
    'fees',
    'taxes',
    'separate',
    'cost',
    'annualRate',
    'plan',
    'number',
    'date',
    'principal',
    'interestPeriod',
    'payment',
    'capitalisedInterest',
    'guarantees',
  ];
  const bytes = await contractPdf({
    snapshot: contractSnapshotSchema.parse(data.snapshot),
    id,
    version: data.engine_version,
    approvedAt: data.approved_at,
    labels: Object.fromEntries(keys.map((k) => [k, t(k)])),
    months,
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrato-${id}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
